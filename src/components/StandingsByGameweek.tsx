/**
 * Standings by Gameweek - Flourish Embeds
 *
 * Season selector renders the Flourish visualizations provided.
 */

import React, { useState } from "react";
import { Card } from "./ui/card";

const SEASON_EMBEDS = [
  { season: "2021/22", id: "8292967" },
  { season: "2022/23", id: "10850560" },
  { season: "2023/24", id: "17184960" },
  { season: "2024/25", id: "23015586" },
  { season: "2025/26", id: "26707472" },
];

export default function StandingsByGameweek() {
  const [selectedSeason, setSelectedSeason] = useState(SEASON_EMBEDS[4].season);

  const current = SEASON_EMBEDS.find((s) => s.season === selectedSeason) ?? SEASON_EMBEDS[4];

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="mx-auto flex w-full max-w-screen-2xl flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Standings by Gameweek</h1>
          <p className="text-sm text-muted-foreground">
            Select a season to view the standings visualization.
          </p>
        </div>
        <select
          value={selectedSeason}
          onChange={(e) => setSelectedSeason(e.target.value)}
          className="px-3 py-1 border rounded-md text-sm"
        >
          {SEASON_EMBEDS.map((season) => (
            <option key={season.season} value={season.season}>
              {season.season}
            </option>
          ))}
        </select>
      </div>

      <Card className="mx-auto w-full max-w-screen-2xl overflow-hidden p-0">
        <iframe
          key={current.id}
          title={`${current.season} standings visualization`}
          src={`https://flo.uri.sh/visualisation/${current.id}/embed`}
          className="block w-full h-[calc(100vh-130px)] min-h-[900px] border-0"
          loading="lazy"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
        <div className="border-t p-3 text-sm text-muted-foreground">
          If the embed does not load,{" "}
          <a
            href={`https://flo.uri.sh/visualisation/${current.id}/embed`}
            target="_blank"
            rel="noreferrer"
            className="underline hover:no-underline"
          >
            open the {current.season} visualization in a new tab
          </a>
          .
        </div>
      </Card>
    </div>
  );
}
