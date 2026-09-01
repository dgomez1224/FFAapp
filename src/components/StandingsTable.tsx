import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { useManagerCrestMap } from "../lib/useManagerCrestMap";
import type { Standing } from "../lib/useDivisionStandings";
import type { Division } from "../lib/divisions";

type StandingsTableProps = {
  rows: Standing[];
  division?: Division;
  baselineById: Record<string, Standing>;
  fromRanks?: Record<string, number> | null;
  showRankMovement?: boolean;
  showLiveColumns: boolean;
};

function ZoneCell({
  className,
  zoneBg,
  accent,
  children,
}: {
  className?: string;
  zoneBg?: string;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <TableCell
      className={className}
      style={
        zoneBg
          ? {
              backgroundColor: zoneBg,
              boxShadow: accent ? `inset 4px 0 0 ${accent}` : undefined,
            }
          : undefined
      }
    >
      {children}
    </TableCell>
  );
}

export function StandingsTable({
  rows,
  division,
  baselineById,
  fromRanks,
  showRankMovement = false,
  showLiveColumns,
}: StandingsTableProps) {
  const { getCrest } = useManagerCrestMap();

  return (
    <div className="fpl-table-container">
      <Table>
        <TableHeader>
          <TableRow className="fpl-table-header">
            <TableHead className="w-12">Rank</TableHead>
            <TableHead className="w-12 text-center">Δ</TableHead>
            <TableHead>Manager</TableHead>
            <TableHead>Team</TableHead>
            <TableHead className="text-right">P</TableHead>
            <TableHead className="text-right">W</TableHead>
            <TableHead className="text-right">D</TableHead>
            <TableHead className="text-right">L</TableHead>
            <TableHead className="text-right">Pts</TableHead>
            <TableHead className="text-right">For</TableHead>
            <TableHead className="text-right">Against</TableHead>
            <TableHead className="text-right">Avg Δ Win</TableHead>
            <TableHead className="text-right">Avg Δ Loss</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="fpl-table-body">
          {rows.map((standing, index) => {
            const baseline = baselineById[standing.team_id];
            const baselineRank = fromRanks?.[standing.team_id] ?? null;
            const currentRank = standing.rank;
            const moved = baselineRank != null ? baselineRank - currentRank : 0;
            const isRelegation = division === "division_one" && rows.length >= 2 && index >= rows.length - 2;
            const isPromotion = division === "division_two" && index < 2;
            const zoneBg = isRelegation ? "#FFE6E6" : isPromotion ? "#E6FFE6" : undefined;
            const zoneAccent = isRelegation ? "#dc2626" : isPromotion ? "#16a34a" : undefined;
            const zoneClass = isRelegation
              ? "relegation-zone"
              : isPromotion
              ? "promotion-zone"
              : "";
            const zoneTitle = isRelegation
              ? "Relegation zone — bottom two in Division One drop to Division Two"
              : isPromotion
              ? "Promotion zone — top two in Division Two go up to Division One"
              : undefined;

            let deltaSymbol = "—";
            let deltaClass = "text-muted-foreground";
            if (showRankMovement && baselineRank != null) {
              if (moved > 0) {
                deltaSymbol = `↑${moved}`;
                deltaClass = "text-emerald-500 font-semibold";
              } else if (moved < 0) {
                deltaSymbol = `↓${Math.abs(moved)}`;
                deltaClass = "text-red-500 font-semibold";
              }
            }

            const winsChanged = showLiveColumns && baseline && standing.wins > baseline.wins;
            const drawsChanged = showLiveColumns && baseline && standing.draws > baseline.draws;
            const lossesChanged = showLiveColumns && baseline && standing.losses > baseline.losses;
            const pointsChanged = showLiveColumns && baseline && standing.points > baseline.points;
            const forChanged = showLiveColumns && baseline && standing.points_for > baseline.points_for;
            const againstChanged = showLiveColumns && baseline && standing.points_against > baseline.points_against;

            return (
              <TableRow
                key={standing.team_id}
                className={zoneClass}
                title={zoneTitle}
                style={zoneBg ? { backgroundColor: zoneBg } : undefined}
              >
                <ZoneCell className="fpl-rank text-center" zoneBg={zoneBg} accent={zoneAccent}>
                  {standing.rank}
                </ZoneCell>
                <ZoneCell className={`text-center ${deltaClass}`} zoneBg={zoneBg}>
                  {deltaSymbol}
                </ZoneCell>
                <ZoneCell className="fpl-manager-name" zoneBg={zoneBg}>
                  {standing.manager_name || "—"}
                </ZoneCell>
                <ZoneCell className="fpl-manager-name" zoneBg={zoneBg}>
                  <div className="flex items-center gap-2">
                    {getCrest(standing.manager_name) ? (
                      <img
                        src={getCrest(standing.manager_name)!}
                        alt=""
                        className="h-4 w-4 rounded object-cover border"
                      />
                    ) : null}
                    <span>{standing.entry_name || "—"}</span>
                  </div>
                </ZoneCell>
                <ZoneCell className="fpl-numeric" zoneBg={zoneBg}>{standing.played}</ZoneCell>
                <ZoneCell className={`fpl-numeric${winsChanged ? " text-emerald-500 font-semibold" : ""}`} zoneBg={zoneBg}>
                  {standing.wins}
                </ZoneCell>
                <ZoneCell className={`fpl-numeric${drawsChanged ? " text-muted-foreground font-semibold" : ""}`} zoneBg={zoneBg}>
                  {standing.draws}
                </ZoneCell>
                <ZoneCell className={`fpl-numeric${lossesChanged ? " text-red-500 font-semibold" : ""}`} zoneBg={zoneBg}>
                  {standing.losses}
                </ZoneCell>
                <ZoneCell className={`fpl-points${pointsChanged ? " text-emerald-500 font-semibold" : ""}`} zoneBg={zoneBg}>
                  {standing.points}
                </ZoneCell>
                <ZoneCell className={`fpl-numeric${forChanged ? " text-emerald-500 font-semibold" : ""}`} zoneBg={zoneBg}>
                  {standing.points_for}
                </ZoneCell>
                <ZoneCell className={`fpl-numeric${againstChanged ? " text-red-500 font-semibold" : ""}`} zoneBg={zoneBg}>
                  {standing.points_against}
                </ZoneCell>
                <ZoneCell className="fpl-numeric" zoneBg={zoneBg}>
                  {standing.avg_margin_victory != null ? standing.avg_margin_victory.toFixed(1) : "—"}
                </ZoneCell>
                <ZoneCell className="fpl-numeric" zoneBg={zoneBg}>
                  {standing.avg_margin_defeat != null ? standing.avg_margin_defeat.toFixed(1) : "—"}
                </ZoneCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
