/**
 * Dashboard - Public Read-Only
 * 
 * Main dashboard page showing overview of league, cup, and analytics.
 * No authentication required.
 */

import React from "react";
import LeagueStandings from "../components/LeagueStandings";
import GobletStandings from "../components/GobletStandings";
import { ThisWeekMatchups } from "../components/ThisWeekMatchups";
import SeasonStatLeaders from "../components/SeasonStatLeaders";

export default function DashboardPage() {
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
