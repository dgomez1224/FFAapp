import React from "react";
import { DivisionStandingsPanel } from "./DivisionStandingsPanel";
import GobletStandings from "./GobletStandings";

export function HomepageStandings() {
  return (
    <section className="grid min-w-0 grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      <div className="min-w-0">
        <DivisionStandingsPanel division="division_one" compact heading="Division 1 Standings" />
      </div>
      <div className="min-w-0">
        <DivisionStandingsPanel division="division_two" compact heading="Division 2 Standings" />
      </div>
      <div className="min-w-0 md:col-span-2 lg:col-span-1">
        <GobletStandings compact />
      </div>
    </section>
  );
}
