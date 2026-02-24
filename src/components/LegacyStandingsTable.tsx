/**
 * Legacy Standings Table - FPL-Style
 * 
 * Shared table component for displaying league standings.
 * Uses FPL-style formatting: table-heavy, minimalist, data-first.
 */

import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

export interface StandingRow {
  rank: number | string; // Can be "C" for champion
  manager_name: string;
  wins: number;
  draws: number;
  losses: number;
  points_for?: number;
  points: number;
  [key: string]: any; // Allow additional columns
}

interface Props {
  standings: StandingRow[];
  showPointsFor?: boolean;
  title?: string;
  className?: string;
}

export function LegacyStandingsTable({ 
  standings, 
  showPointsFor = true, 
  title,
  className 
}: Props) {
  return (
    <div className={className}>
      {title && (
        <h3 className="text-lg font-semibold mb-3 text-gray-900">{title}</h3>
      )}
      <div className="fpl-table-container">
        <Table>
          <TableHeader>
            <TableRow className="fpl-table-header">
              <TableHead className="w-12 text-center">#</TableHead>
              <TableHead>Manager</TableHead>
              <TableHead className="text-right">W</TableHead>
              <TableHead className="text-right">D</TableHead>
              <TableHead className="text-right">L</TableHead>
              {showPointsFor && (
                <TableHead className="text-right">+</TableHead>
              )}
              <TableHead className="text-right font-semibold">PTS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="fpl-table-body">
            {standings.map((standing, index) => {
              const rank = standing.rank === "C" || standing.rank === 1 ? (
                <span className="font-bold text-blue-600">C</span>
              ) : (
                standing.rank
              );

              const isChampion = standing.rank === "C" || standing.rank === 1;

              return (
                <TableRow
                  key={`${standing.manager_name}-${index}`}
                  className={isChampion ? "champion bg-blue-50" : ""}
                >
                  <TableCell className="fpl-rank text-center">{rank}</TableCell>
                  <TableCell className="fpl-manager-name">
                    {standing.manager_name}
                  </TableCell>
                  <TableCell className="fpl-numeric">{standing.wins}</TableCell>
                  <TableCell className="fpl-numeric">{standing.draws}</TableCell>
                  <TableCell className="fpl-numeric">{standing.losses}</TableCell>
                  {showPointsFor && (
                    <TableCell className="fpl-numeric text-gray-500">
                      {standing.points_for ?? "–"}
                    </TableCell>
                  )}
                  <TableCell className="fpl-points">
                    {standing.points}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
