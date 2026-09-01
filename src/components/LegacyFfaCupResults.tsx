import React from "react";
import { Card } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { useManagerCrestMap } from "../lib/useManagerCrestMap";
import {
  LEGACY_FFA_CUP_2025_CHAMPION_MANAGER,
  LEGACY_FFA_CUP_2025_CHAMPION_TEAM,
  LEGACY_FFA_CUP_2025_MATCHES,
  LEGACY_FFA_CUP_2025_PARTICIPANTS,
  LEGACY_FFA_CUP_2025_ROUNDS,
  type LegacyCupMatch,
  type LegacyCupRound,
} from "../lib/legacyFfaCup2025";

const ROUND_LABEL: Record<LegacyCupRound, string> = {
  "Quarter-Final": "Quarter-Finals",
  "Semi-Final": "Semi-Finals",
  Final: "Final",
  "Third Place": "Third Place",
};

function MatchRow({ match }: { match: LegacyCupMatch }) {
  const homeWon = match.winner === match.home_team;
  const awayWon = match.winner === match.away_team;
  return (
    <div className="rounded-md border bg-background p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className={homeWon ? "font-semibold" : "text-muted-foreground"}>
          {match.home_team}
          <span className="ml-1 text-[11px] font-normal uppercase tracking-wide">{match.home_manager}</span>
        </span>
        {homeWon ? <span className="text-[11px] font-semibold text-emerald-600">Won</span> : null}
      </div>
      <div className="my-1 text-center text-[10px] uppercase tracking-wide text-muted-foreground">vs</div>
      <div className="flex items-center justify-between gap-2">
        <span className={awayWon ? "font-semibold" : "text-muted-foreground"}>
          {match.away_team}
          <span className="ml-1 text-[11px] font-normal uppercase tracking-wide">{match.away_manager}</span>
        </span>
        {awayWon ? <span className="text-[11px] font-semibold text-emerald-600">Won</span> : null}
      </div>
    </div>
  );
}

export function LegacyFfaCupResults() {
  const { getCrest } = useManagerCrestMap();
  const group = [...LEGACY_FFA_CUP_2025_PARTICIPANTS].sort((a, b) => {
    if (a.advanced !== b.advanced) return a.advanced ? -1 : 1;
    return (a.seed ?? 99) - (b.seed ?? 99);
  });

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h2 className="text-lg font-semibold">2025/26 Bench Boost Cup</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Single elimination · 8 knockout teams · Champion: {LEGACY_FFA_CUP_2025_CHAMPION_TEAM} (
          {LEGACY_FFA_CUP_2025_CHAMPION_MANAGER})
        </p>
      </Card>

      <Card className="p-4">
        <h2 className="mb-1 text-lg font-semibold">Group Stage</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          All 10 league members played the group stage. The top eight were seeded into the knockout bracket.
        </p>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Seed</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.map((team) => (
                <TableRow
                  key={team.team_name}
                  className={team.advanced ? "bg-green-50 font-medium dark:bg-green-950/40" : undefined}
                >
                  <TableCell>{team.seed != null ? team.seed : "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getCrest(team.manager_name) ? (
                        <img
                          src={getCrest(team.manager_name)!}
                          alt=""
                          className="h-5 w-5 rounded object-cover border"
                        />
                      ) : null}
                      <span>{team.team_name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{team.manager_name}</TableCell>
                  <TableCell className="text-center text-xs">
                    {team.advanced ? "Advanced" : "Eliminated"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {LEGACY_FFA_CUP_2025_ROUNDS.map((round) => {
        const matches = LEGACY_FFA_CUP_2025_MATCHES.filter((m) => m.round === round);
        return (
          <Card key={round} className="p-4">
            <h3 className="mb-3 text-base font-semibold">{ROUND_LABEL[round]}</h3>
            <div className={`grid gap-3 ${matches.length > 1 ? "sm:grid-cols-2" : "max-w-lg"}`}>
              {matches.map((match) => (
                <MatchRow key={match.match_order} match={match} />
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
