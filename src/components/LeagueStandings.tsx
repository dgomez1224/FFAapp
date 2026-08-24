/**
 * League Standings - Public Read-Only
 *
 * Displays Division One and Division Two standings side-by-side on desktop,
 * with a toggle on mobile.
 */

import React, { useState } from "react";
import { DivisionStandingsPanel } from "./DivisionStandingsPanel";
import leagueTrophy from "../assets/trophies/League Cup Icon.png";
import type { Division } from "../lib/divisions";
import { getDivisionLabel } from "../lib/divisions";

export default function LeagueStandings() {
  const [mobileDivision, setMobileDivision] = useState<Division>("division_one");

  function handleRefresh() {
    window.location.reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={leagueTrophy} alt="" className="h-10 w-10 object-contain" aria-hidden />
          <div>
            <h1 className="font-heading text-2xl font-semibold">League Standings</h1>
            <p className="text-sm text-muted-foreground">
              Division One and Division Two — ranked by league points, then points for.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 flex items-center gap-1"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Mobile: division toggle */}
      <div className="flex gap-2 md:hidden">
        {(["division_one", "division_two"] as Division[]).map((div) => (
          <button
            key={div}
            type="button"
            onClick={() => setMobileDivision(div)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              mobileDivision === div
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {getDivisionLabel(div)}
          </button>
        ))}
      </div>

      {/* Mobile: single division */}
      <div className="md:hidden">
        <DivisionStandingsPanel division={mobileDivision} compact />
      </div>

      {/* Desktop: side by side */}
      <div className="hidden md:grid md:grid-cols-2 md:gap-6">
        <DivisionStandingsPanel division="division_one" compact />
        <DivisionStandingsPanel division="division_two" compact />
      </div>
    </div>
  );
}
