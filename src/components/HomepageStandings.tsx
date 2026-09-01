import React from "react";
import { DivisionStandingsPanel } from "./DivisionStandingsPanel";
import GobletStandings from "./GobletStandings";
import { TeamOfTheWeekPanel } from "../pages/TeamOfTheWeek";

export function HomepageStandings() {
  return (
    <section className="grid min-w-0 grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 lg:grid-rows-[auto_minmax(0,1fr)] lg:items-stretch">
      <div className="min-w-0">
        <DivisionStandingsPanel division="division_one" compact heading="Division 1 Standings" />
      </div>
      <div className="min-w-0">
        <DivisionStandingsPanel division="division_two" compact heading="Division 2 Standings" />
      </div>
      <div className="flex h-full min-h-0 min-w-0 flex-col md:col-span-2 lg:col-span-1 lg:row-span-2">
        <GobletStandings compact />
      </div>
      <div className="flex h-full min-h-0 min-w-0 flex-col md:col-span-2">
        <TeamOfTheWeekPanel compact fillHeight />
      </div>
    </section>
  );
}
