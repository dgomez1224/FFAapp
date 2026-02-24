/**
 * Home Page - Current Season Overview
 *
 * Public dashboard for current season standings, matchups, cup, and insights.
 */

import React from "react";
import LeagueStandings from "../components/LeagueStandings";
import GobletStandings from "../components/GobletStandings";
import { ThisWeekMatchups } from "../components/ThisWeekMatchups";
import SeasonStatLeaders from "../components/SeasonStatLeaders";

export default function Home() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">FFA Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Current season snapshot powered by Draft data.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <LeagueStandings />
        <GobletStandings />
        <SeasonStatLeaders />
      </div>

      <ThisWeekMatchups />
    </div>
  );
}
