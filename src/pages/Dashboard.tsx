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
import LivePlayerUpdates from "../components/LivePlayerUpdates";
import { ThisWeeksWaivers } from "../components/ThisWeeksWaivers";
import { BracketView } from "../components/BracketView";
import { PreviousWeekResults } from "../components/PreviousWeekResults";
import { CUP_START_GAMEWEEK } from "../lib/constants";
import { useCurrentGameweek } from "../lib/useCurrentGameweek";

export default function DashboardPage() {
  const { currentGameweek } = useCurrentGameweek();
  const showCup = currentGameweek >= CUP_START_GAMEWEEK;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-bold">FFA Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Current season snapshot powered by Draft data.
        </p>
      </div>
      
      <LivePlayerUpdates />
      <LeagueStandings />
      <PreviousWeekResults />
      <GobletStandings />
      {showCup ? <BracketView showLegacySelector={false} /> : null}
      
      <ThisWeekMatchups />
      <SeasonStatLeaders />

      
      <ThisWeeksWaivers />
      
    </div>
  );
}
