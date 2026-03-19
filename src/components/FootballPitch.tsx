/**

- Football Pitch Lineup Component
- 
- Supports two orientations:
- - "portrait" (default): single team, GK at bottom, FWDs at top (cup/pick captain)
- - "landscape": used inside SharedPitch for H2H, each team occupies a half
- side="left"  → GK on far left,  FWDs toward center
- side="right" → GK on far right, FWDs toward center (mirrored)
  */

import React, { useState } from "react";
import { getPlayerImage, getPlayerImageByIdOrName } from "../lib/playerImage";
import pitchBg from "../assets/backgrounds/FPL Site Pitch.png";
import pitchBgPortrait from "../assets/backgrounds/FPL Site Pitch Portrait.png";

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
orientation?: "portrait" | "landscape";
side?: "left" | "right";
/** When true, renders no background (used inside SharedPitch which handles its own bg) */
noBackground?: boolean;
}

// Portrait: Y positions (GK at bottom=82, FWD at top=18)
const PORTRAIT_Y: Record<number, number> = {
1: 82,
2: 64,
3: 46,
4: 22,
};

// Landscape left half: X positions as % of FULL pitch width
// GK on far left, FWDs close to center (50%)
const LANDSCAPE_LEFT_X: Record<number, number> = {
1: 6,   // GK — near left edge
2: 20,  // DEF
3: 33,  // MID
4: 43,  // FWD — close to center line
};

// Landscape right half: X positions as % of FULL pitch width (mirrored)
const LANDSCAPE_RIGHT_X: Record<number, number> = {
1: 94,  // GK — near right edge
2: 80,  // DEF
3: 67,  // MID
4: 57,  // FWD — close to center line
};

function PlayerCard({
player,
imageUrl,
isCaptain,
isViceCaptain,
showCaptain,
onPlayerClick,
orientation,
}: {
player: PitchPlayer;
imageUrl: string | null;
isCaptain: boolean;
isViceCaptain: boolean;
showCaptain: boolean;
onPlayerClick?: (p: PitchPlayer) => void;
orientation: "portrait" | "landscape";
}) {
const surname = player.player_name.split(" ").slice(-1)[0];
const pts = player.raw_points ?? 0;
const ptsColor =
pts >= 10 ? "bg-amber-400 text-black" :
pts >= 6  ? "bg-green-400 text-black" :
pts >= 2  ? "bg-white text-black" :
"bg-black/70 text-white";

// Smaller cards in landscape (half-pitch is narrower)
const cardSize = orientation === "landscape"
? "w-7 h-9 sm:w-8 sm:h-11"
: "w-7 h-10 sm:w-9 sm:h-12 md:w-10 md:h-14";

return (
<button
onClick={() => onPlayerClick?.(player)}
className={`flex flex-col items-center group ${onPlayerClick ? "cursor-pointer" : "cursor-default"}`}
title={player.player_name}
>
<div className="relative">
{/* Image card */}
<div
className={`relative overflow-hidden rounded-md shadow-lg transition-transform group-hover:scale-105 ${cardSize} ${isCaptain ? "ring-2 ring-amber-400" : isViceCaptain ? "ring-2 ring-sky-400" : ""}`}
>
<div className="absolute inset-x-0 bottom-0 h-1/3 z-10 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
{imageUrl ? (
<img
src={imageUrl}
alt={player.player_name}
className="w-full h-full object-cover object-top"
onError={(e) => {
const target = e.currentTarget;
(async () => {
try {
const name = player.player_name || "";
const parts = name.trim().split(/\s+/);
const variants = [
name,
parts.length > 2 ? `${parts[0]} ${parts[1]}` : null,
parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : null,
].filter(Boolean) as string[];
for (const v of [...new Set(variants)]) {
const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(v)}`);
const d = r.ok ? await r.json() : null;
if (d?.thumbnail?.source) {
target.src = d.thumbnail.source;
target.style.display = "";
return;
}
}
} catch { /* fall through */ }
target.style.display = "none";
const parent = target.parentElement;
if (parent && !parent.querySelector(".img-fallback")) {
const fb = document.createElement("div");
fb.className = "img-fallback absolute inset-0 flex items-center justify-center bg-gray-700 text-white text-xs font-bold";
fb.textContent = (player.player_name || "?").split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
parent.appendChild(fb);
}
})();
}}
/>
) : (
<div className="w-full h-full bg-gray-700 flex items-center justify-center text-white text-xs font-bold">
{(player.player_name || "?").split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()}
</div>
)}
</div>

    {/* Badges */}
    {showCaptain && isCaptain && (
      <div className="absolute -top-1.5 -right-1.5 z-20 w-4 h-4 rounded-full bg-amber-400 text-black text-[9px] font-bold flex items-center justify-center shadow-md">C</div>
    )}
    {showCaptain && isViceCaptain && (
      <div className="absolute -top-1.5 -right-1.5 z-20 w-4 h-4 rounded-full bg-sky-500 text-white text-[9px] font-bold flex items-center justify-center shadow-md">V</div>
    )}
    {player.is_auto_subbed_on && (
      <div className="absolute -top-1.5 -left-1.5 z-20 w-4 h-4 rounded-full bg-green-500 text-white text-[9px] font-bold flex items-center justify-center shadow-md">↑</div>
    )}
  </div>

  {/* Surname */}
  <span
    className="mt-0.5 text-[8px] font-semibold text-white leading-none text-center max-w-[38px] truncate"
    style={{ textShadow: "0 1px 3px rgba(0,0,0,1)" }}
  >
    {surname}
  </span>

  {/* Points pill */}
  <span className={`mt-0.5 text-[8px] font-bold px-1 py-0.5 rounded-full leading-none shadow-sm ${ptsColor}`}>
    {pts}
  </span>
</button>

);
}

export function FootballPitch({
players,
onPlayerClick,
showCaptain = true,
orientation = "portrait",
side = "left",
noBackground = false,
}: FootballPitchProps) {
const [playerImages, setPlayerImages] = useState<Record<number, string | null>>({});

React.useEffect(() => {
async function loadImages() {
const images: Record<number, string | null> = {};
await Promise.all(
players.map(async (player) => {
const directUrl = String(player.player_image_url || "").replace(/^http:\/\//i, "https://");
const resolved = await getPlayerImageByIdOrName(player.player_id, player.player_name, directUrl || null);
if (resolved) { images[player.player_id] = resolved; return; }
images[player.player_id] = await getPlayerImage(player.player_name);
}),
);
setPlayerImages(images);
}
loadImages();
}, [players]);

const playersByPosition = players.reduce((acc, player) => {
if (!acc[player.position]) acc[player.position] = [];
acc[player.position].push(player);
return acc;
}, {} as Record<number, PitchPlayer[]>);

// Portrait: position as % of pitch height (Y), spread horizontally (X)
const getPortraitPos = (position: number, idx: number) => {
const posPlayers = playersByPosition[position] || [];
const count = Math.max(1, posPlayers.length);
const y = PORTRAIT_Y[position] || 50;
if (position === 1) {
if (count === 1) return { x: 50, y };
const startX = 40, endX = 60;
return { x: startX + ((endX - startX) / (count - 1)) * idx, y };
}
const startX = 12, endX = 88;
return { x: count === 1 ? 50 : startX + ((endX - startX) / (count - 1)) * idx, y };
};

// Landscape: position as % of pitch width (X), spread vertically (Y)
const getLandscapePos = (position: number, idx: number) => {
const posPlayers = playersByPosition[position] || [];
const count = Math.max(1, posPlayers.length);
const xMap = side === "left" ? LANDSCAPE_LEFT_X : LANDSCAPE_RIGHT_X;
const x = xMap[position] || 50;
const startY = 10, endY = 90;
return { x, y: count === 1 ? 50 : startY + ((endY - startY) / (count - 1)) * idx };
};

const getPos = (position: number, idx: number) =>
orientation === "landscape" ? getLandscapePos(position, idx) : getPortraitPos(position, idx);

return (
<div
className="relative w-full h-full rounded-lg overflow-hidden"
style={orientation === "portrait" ? { aspectRatio: "9/16" } : undefined}
>
{/* Pitch background — only when not delegated to parent */}
{!noBackground && (
orientation === "portrait" ? (
<img
src={pitchBgPortrait}
alt=""
className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
/>
) : (
<img
src={pitchBg}
alt=""
className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
/>
)
)}

  {/* Players layer */}
  <div className="absolute inset-0 w-full h-full">
    {Object.entries(playersByPosition).map(([position, posPlayers]) =>
      posPlayers.map((player, playerIdx) => {
        const pos = getPos(parseInt(position), playerIdx);
        const imageUrl = playerImages[player.player_id] ?? null;
        const isCaptain = showCaptain && player.is_cup_captain && player.multiplier > 1;
        const isViceCaptain = showCaptain && !isCaptain && !!player.is_vice_captain;

        return (
          <div
            key={`${player.player_id}-${playerIdx}`}
            className="absolute transform -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
          >
            <PlayerCard
              player={player}
              imageUrl={imageUrl}
              isCaptain={isCaptain}
              isViceCaptain={isViceCaptain}
              showCaptain={showCaptain}
              onPlayerClick={onPlayerClick}
              orientation={orientation}
            />
          </div>
        );
      })
    )}
  </div>
</div>

);
}