/**
 * Football Pitch Lineup Component
 * Displays a football pitch with player positions and images
 */

import React, { useState } from "react";
import { getPlayerImage } from "../lib/playerImage";

export interface PitchPlayer {
  player_id: number;
  player_name: string;
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
  1: 88,
  2: 72,
  3: 50,
  4: 28,
};

export function FootballPitch({ players, onPlayerClick, showCaptain = true }: FootballPitchProps) {
  const [playerImages, setPlayerImages] = useState<Record<number, string | null>>({});

  React.useEffect(() => {
    async function loadImages() {
      const images: Record<number, string | null> = {};
      for (const player of players) {
        const url = await getPlayerImage(player.player_name);
        images[player.player_id] = url;
      }
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
    if (position === 1) return { x: 50, y: FORMATION_Y[1] };
    const startX = 18;
    const endX = 82;
    const step = count === 1 ? 0 : (endX - startX) / (count - 1);
    return {
      x: count === 1 ? 50 : startX + step * playerIndex,
      y: FORMATION_Y[position] || 50,
    };
  };

  const hasActiveMultiplier = showCaptain && players.some((p) => !!p.is_cup_captain && p.multiplier > 1);

  return (
    <div className="relative w-full bg-gradient-to-b from-green-500 to-green-600 rounded-lg overflow-hidden">
      {/* Pitch background */}
      <svg className="w-full h-auto aspect-video" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
        {/* Pitch outline */}
        <rect x="5" y="5" width="90" height="90" fill="currentColor" className="text-green-500" stroke="white" strokeWidth="0.5" />

        {/* Center line */}
        <line x1="50" y1="5" x2="50" y2="95" stroke="white" strokeWidth="0.3" />

        {/* Center circle */}
        <circle cx="50" cy="50" r="8" fill="none" stroke="white" strokeWidth="0.3" />
        <circle cx="50" cy="50" r="0.5" fill="white" />

        {/* Penalty areas */}
        <rect x="15" y="5" width="70" height="20" fill="none" stroke="white" strokeWidth="0.3" />
        <rect x="15" y="75" width="70" height="20" fill="none" stroke="white" strokeWidth="0.3" />

        {/* Goal areas */}
        <rect x="30" y="5" width="40" height="10" fill="none" stroke="white" strokeWidth="0.3" />
        <rect x="30" y="85" width="40" height="10" fill="none" stroke="white" strokeWidth="0.3" />
      </svg>

      {/* Players */}
      <div className="absolute inset-0 w-full h-full">
        {Object.entries(playersByPosition).map(([position, posPlayers]) =>
          posPlayers.map((player, playerIdx) => {
            const pos = getPlayerPosition(parseInt(position), playerIdx);
            const imageUrl = playerImages[player.player_id];
            const isCaptain = showCaptain && player.is_cup_captain && player.multiplier > 1;

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
                {/* Player circle with image */}
                <div
                  className={`relative w-12 h-12 rounded-full border-2 overflow-hidden flex items-center justify-center transition-transform group-hover:scale-110 ${
                    isCaptain ? "border-amber-400 ring-2 ring-amber-300" : "border-white"
                  }`}
                  style={{
                    background: isCaptain ? "rgba(251, 191, 36, 0.2)" : "rgba(255, 255, 255, 0.1)",
                  }}
                >
                  {imageUrl ? (
                    <img src={imageUrl} alt={player.player_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gray-400 flex items-center justify-center text-white text-xs font-bold">
                      {player.player_name.split(" ")[0].substring(0, 1)}
                    </div>
                  )}

                  {/* Captain badge */}
                  {isCaptain && (
                    <div className="absolute -top-1 -right-1 bg-amber-400 text-black text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      ⚡
                    </div>
                  )}
                </div>

                {/* Player info tooltip */}
                <div className="absolute -bottom-16 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  <div className="font-bold">{player.player_name}</div>
                  <div>{POSITION_NAMES[player.position]}</div>
                  <div className="text-yellow-300">{player.effective_points.toFixed(1)} pts</div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Legend */}
      {hasActiveMultiplier && (
        <div className="absolute bottom-2 left-2 text-xs text-white bg-black/40 rounded px-2 py-1">
          <div>⚡ = Captain</div>
        </div>
      )}
    </div>
  );
}
