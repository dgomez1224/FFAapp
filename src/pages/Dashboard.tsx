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
import CupGroupStage from "../components/CupGroupStage";
import { ThisWeeksWaivers } from "../components/ThisWeeksWaivers";
import LivePlayerUpdates from "../components/LivePlayerUpdates";
import { BracketView } from "../components/BracketView";
import { PreviousWeekResults } from "../components/PreviousWeekResults";

export default function DashboardPage() {
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
      <BracketView showLegacySelector={false} />
      <GobletStandings />
      
      <ThisWeekMatchups />
      <SeasonStatLeaders />

      
      <ThisWeeksWaivers />
      
    </div>
  );
}
