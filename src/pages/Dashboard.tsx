/**
 * Dashboard - Public Read-Only
 *
 * League dashboard: fixture/update carousels, three standings panels, results, and waivers.
 * Cup/BBC content lives on the FFA Cup page.
 */

import React from "react";
import { ThisWeekMatchups } from "../components/ThisWeekMatchups";
import LivePlayerUpdates from "../components/LivePlayerUpdates";
import SeasonStatLeaders from "../components/SeasonStatLeaders";
import { ThisWeeksWaivers } from "../components/ThisWeeksWaivers";
import { PreviousWeekResults } from "../components/PreviousWeekResults";
import { HomepageStandings } from "../components/HomepageStandings";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <ThisWeekMatchups layout="carousel" />
      <LivePlayerUpdates layout="carousel" />
      <HomepageStandings />
      <SeasonStatLeaders />
      <PreviousWeekResults layout="carousel" />
      <ThisWeeksWaivers layout="carousel" />
    </div>
  );
}
