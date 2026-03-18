/**
 * Football Pitch Lineup Component
 * Displays a football pitch with player positions and images
 */

import React, { useState } from "react";
import { getPlayerImage, getPlayerImageByIdOrName, getProxiedImageUrl } from "../lib/playerImage";
import pitchBg from "../assets/FPL Site Pitch.png";

export interface PitchPlayer {
  player_id: number;
  player_name: string;
  player_image_url?: string | null;
  position: number; // 1=GK, 2=DEF, 3=MID, 4=FWD
  raw_points: number;
  effective_points: number;
  is_captain: boolean;
  is_vice_captain: boolean;
  is_cup_captain: boolean;
  multiplier: number;
  goals_scored?: number;
  assists?: number;
  minutes?: number;
  is_auto_subbed_on?: boolean;
}

interface FootballPitchProps {
  players: PitchPlayer[];
  onPlayerClick?: (player: PitchPlayer) => void;
  showCaptain?: boolean;
}

const POSITION_NAMES: Record<number, string> = {
  1: "GK",
  2: "DEF",
  3: "MID",
  4: "FWD",
};

// Formation positions (4-3-3)
const FORMATION_Y: Record<number, number> = {
  1: 79,
  2: 61,
  3: 43,
  4: 25,
};

export function FootballPitch({ players, onPlayerClick, showCaptain = true }: FootballPitchProps) {
  const [playerImages, setPlayerImages] = useState<Record<number, string | null>>({});

  React.useEffect(() => {
    async function loadImages() {
      const images: Record<number, string | null> = {};
      await Promise.all(
        players.map(async (player) => {
          const directImageUrl = String(player.player_image_url || "").replace(/^http:\/\//i, "https://");
          const byIdOrName = await getPlayerImageByIdOrName(
            player.player_id,
            player.player_name,
            directImageUrl || null,
          );
          if (byIdOrName) {
            images[player.player_id] = byIdOrName;
            return;
          }
          images[player.player_id] = await getPlayerImage(player.player_name);
        }),
      );
      setPlayerImages(images);
    }
    loadImages();
  }, [players]);

  // Organize players by position
  const playersByPosition = players.reduce(
    (acc, player) => {
      if (!acc[player.position]) acc[player.position] = [];
      acc[player.position].push(player);
      return acc;
    },
    {} as Record<number, PitchPlayer[]>
  );

  const getPlayerPosition = (position: number, playerIndex: number): { x: number; y: number } => {
    const positionPlayers = playersByPosition[position] || [];
    const count = Math.max(1, positionPlayers.length);
    if (position === 1) {
      if (count === 1) return { x: 50, y: FORMATION_Y[1] };
      // Allow dual-GK display side-by-side for Pick Captain and Cup lineups.
      const startX = 42;
      const endX = 58;
      const step = count === 1 ? 0 : (endX - startX) / (count - 1);
      return { x: startX + step * playerIndex, y: FORMATION_Y[1] };
    }
    const startX = 20;
    const endX = 80;
    const step = count === 1 ? 0 : (endX - startX) / (count - 1);
    return {
      x: count === 1 ? 50 : startX + step * playerIndex,
      y: FORMATION_Y[position] || 50,
    };
  };

  return (
    <div
      className="relative w-full rounded-lg overflow-hidden"
      style={{
        backgroundImage: `url(${pitchBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Aspect-ratio spacer so the pitch has height */}
      <div className="w-full aspect-video" />

      {/* Players */}
      <div className="absolute inset-0 w-full h-full">
        {Object.entries(playersByPosition).map(([position, posPlayers]) =>
          posPlayers.map((player, playerIdx) => {
            const pos = getPlayerPosition(parseInt(position), playerIdx);
            const imageUrl = playerImages[player.player_id];
            const isCaptain = showCaptain && player.is_cup_captain && player.multiplier > 1;
            const isViceCaptain = showCaptain && !isCaptain && !!player.is_vice_captain;

            return (
              <button
                key={`${player.player_id}-${playerIdx}`}
                onClick={() => onPlayerClick?.(player)}
                className={`absolute transform -translate-x-1/2 -translate-y-1/2 group ${onPlayerClick ? "cursor-pointer" : "cursor-default"}`}
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                }}
                title={player.player_name}
              >
                {/* Image card with relative positioning for badges */}
                <div className="relative flex flex-col items-center">
                  <div
                    className={`
          relative overflow-hidden rounded-md shadow-lg
          transition-transform group-hover:scale-105
          w-7 h-10 sm:w-9 sm:h-12 md:w-10 md:h-13
          ${isCaptain
            ? "ring-2 ring-amber-400 ring-offset-1 ring-offset-transparent"
            : isViceCaptain
            ? "ring-2 ring-sky-400 ring-offset-1 ring-offset-transparent"
            : ""}
        `}
                  >
                    {/* Gradient overlay at bottom for text readability */}
                    <div className="absolute inset-x-0 bottom-0 h-1/3 z-10 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />

                    {/* Player image */}
                    {imageUrl ? (
                      <img
                        src={imageUrl ?? undefined}
                        alt={player.player_name}
                        className="w-full h-full object-cover object-top"
                        onError={(e) => {
                          const target = e.currentTarget;
                          (async () => {
                            try {
                              const name = player.player_name || (player as any).name || "";
                              const nameParts = name.trim().split(/\s+/);
                              const variants = [
                                name,
                                nameParts.length > 2 ? `${nameParts[0]} ${nameParts[1]}` : null,
                                nameParts.length > 1
                                  ? `${nameParts[0]} ${nameParts[nameParts.length - 1]}`
                                  : null,
                              ].filter(Boolean) as string[];
                              for (const v of [...new Set(variants)]) {
                                const r = await fetch(
                                  `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
                                    v,
                                  )}`,
                                );
                                const d = r.ok ? await r.json() : null;
                                if (d?.thumbnail?.source) {
                                  target.src = d.thumbnail.source;
                                  target.style.display = "";
                                  return;
                                }
                              }
                            } catch {
                              // fall through
                            }
                            target.style.display = "none";
                            const parent = target.parentElement;
                            if (parent && !parent.querySelector(".img-fallback")) {
                              const fb = document.createElement("div");
                              fb.className =
                                "img-fallback absolute inset-0 flex items-center justify-center bg-gray-700 text-white text-xs font-bold";
                              fb.textContent = (player.player_name || "?")
                                .split(" ")
                                .map((w: string) => w[0])
                                .slice(0, 2)
                                .join("")
                                .toUpperCase();
                              parent.appendChild(fb);
                            }
                          })();
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-700 flex items-center justify-center text-white text-xs font-bold">
                        {(player.player_name || "?")
                          .split(" ")
                          .map((w: string) => w[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Captain badge */}
                  {isCaptain && (
                    <div className="absolute -top-1.5 -right-1.5 z-20 w-5 h-5 rounded-full bg-amber-400 text-black text-[10px] font-bold flex items-center justify-center shadow-md">
                      C
                    </div>
                  )}
                  {/* Vice captain badge */}
                  {isViceCaptain && (
                    <div className="absolute -top-1.5 -right-1.5 z-20 w-5 h-5 rounded-full bg-sky-500 text-white text-[10px] font-bold flex items-center justify-center shadow-md">
                      V
                    </div>
                  )}
                  {/* Auto-subbed on badge */}
                  {player.is_auto_subbed_on && (
                    <div className="absolute -top-1.5 -left-1.5 z-20 w-5 h-5 rounded-full bg-green-500 text-white text-[10px] font-bold flex items-center justify-center shadow-md">
                      ↑
                    </div>
                  )}

                  {/* Surname */}
                  <span
                    className="mt-0.5 text-[8px] sm:text-[9px] font-semibold text-white leading-none text-center max-w-[40px] truncate"
                    style={{ textShadow: "0 1px 3px rgba(0,0,0,1)" }}
                  >
                    {player.player_name.split(" ").slice(-1)[0]}
                  </span>

                  {/* Points pill — color coded */}
                  <span
                    className={`
        mt-0.5 text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 
        rounded-full leading-none shadow-sm
        ${(player.raw_points ?? 0) >= 10
          ? "bg-amber-400 text-black"
          : (player.raw_points ?? 0) >= 6
          ? "bg-green-400 text-black"
          : (player.raw_points ?? 0) >= 2
          ? "bg-white text-black"
          : "bg-black/70 text-white"}
      `}
                  >
                    {player.raw_points ?? 0}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
