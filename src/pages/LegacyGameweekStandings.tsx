/**
 * Legacy Gameweek Fixtures
 *
 * Builds per-gameweek fixture/results tables from legacy_h2h_gameweek_results.
 */

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { Card } from "../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";

interface LegacyH2HGameweekRow {
  season: string;
  gameweek: number;
  manager_name: string;
  opponent_name: string;
  points_for: number;
  points_against: number;
  result: "W" | "D" | "L";
}

interface FixtureRow {
  season: string;
  gameweek: number;
  manager_1: string;
  manager_2: string;
  manager_1_points: number;
  manager_2_points: number;
  outcome: string;
}

function canonicalManagerName(name: string): string {
  const normalized = String(name || "").trim().toUpperCase();
  if (normalized === "MATTHEW") return "MATT";
  return normalized;
}

function normalizeSeason(value: unknown): string {
  return String(value || "").trim();
}

export default function LegacyGameweekStandings() {
  const [seasons, setSeasons] = useState<string[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string>("");
  const [fixtures, setFixtures] = useState<FixtureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSeasons() {
      try {
        const [h2hSeasonsRes, standingsSeasonsRes] = await Promise.all([
          supabase.from("legacy_h2h_gameweek_results").select("season"),
          supabase.from("legacy_season_standings").select("season").eq("competition_type", "league"),
        ]);

        if (h2hSeasonsRes.error) throw new Error(h2hSeasonsRes.error.message);
        if (standingsSeasonsRes.error) throw new Error(standingsSeasonsRes.error.message);

        const allSeasonValues = [
          ...((h2hSeasonsRes.data || []).map((row: any) => normalizeSeason(row.season))),
          ...((standingsSeasonsRes.data || []).map((row: any) => normalizeSeason(row.season))),
        ].filter(Boolean);

        const uniqueSeasons = Array.from(new Set(allSeasonValues)).sort().reverse();
        setSeasons(uniqueSeasons);
        if (uniqueSeasons.length > 0) setSelectedSeason(uniqueSeasons[0]);
      } catch (err: any) {
        setError(err.message || "Failed to load seasons");
      } finally {
        setLoading(false);
      }
    }

    loadSeasons();
  }, []);

  useEffect(() => {
    if (!selectedSeason) return;

    async function loadFixtures() {
      try {
        setLoading(true);
        setError(null);
        setFixtures([]);

        const { data, error: fixturesError } = await supabase
          .from("legacy_h2h_gameweek_results")
          .select("season, gameweek, manager_name, opponent_name, points_for, points_against, result")
          .eq("season", selectedSeason)
          .order("gameweek", { ascending: true })
          .order("manager_name", { ascending: true });

        if (fixturesError) throw new Error(fixturesError.message);

        // Double-guard against dirty rows: keep only exact selected season.
        const rowsForSeason = ((data as LegacyH2HGameweekRow[] | null) || []).filter(
          (row) => normalizeSeason(row.season) === normalizeSeason(selectedSeason),
        );

        const grouped = new Map<string, FixtureRow>();
        rowsForSeason.forEach((row) => {
          const manager = canonicalManagerName(row.manager_name);
          const opponent = canonicalManagerName(row.opponent_name);
          if (!manager || !opponent) return;

          const [left, right] = [manager, opponent].sort();
          const key = `${normalizeSeason(row.season)}__${row.gameweek}__${left}__${right}`;
          const managerIsLeft = manager === left;
          const managerPoints = Number(row.points_for || 0);
          const opponentPoints = Number(row.points_against || 0);

          if (grouped.has(key)) {
            // Duplicate mirrored row (or duplicate import). Keep first non-zero-oriented scores if present.
            const existing = grouped.get(key)!;
            if (existing.manager_1_points === 0 && existing.manager_2_points === 0) {
              existing.manager_1_points = managerIsLeft ? managerPoints : opponentPoints;
              existing.manager_2_points = managerIsLeft ? opponentPoints : managerPoints;
            }
            return;
          }

          grouped.set(key, {
            season: normalizeSeason(row.season),
            gameweek: Number(row.gameweek || 0),
            manager_1: left,
            manager_2: right,
            manager_1_points: managerIsLeft ? managerPoints : opponentPoints,
            manager_2_points: managerIsLeft ? opponentPoints : managerPoints,
            outcome: "Draw",
          });
        });

        const fixtureRows = Array.from(grouped.values())
          .map((row) => {
            const outcome =
              row.manager_1_points > row.manager_2_points
                ? `${row.manager_1} won`
                : row.manager_2_points > row.manager_1_points
                ? `${row.manager_2} won`
                : "Draw";
            return { ...row, outcome };
          })
          .sort((a, b) => a.gameweek - b.gameweek || a.manager_1.localeCompare(b.manager_1));

        setFixtures(fixtureRows);
      } catch (err: any) {
        setError(err.message || "Failed to load fixtures");
      } finally {
        setLoading(false);
      }
    }

    loadFixtures();
  }, [selectedSeason]);

  const fixturesByGameweek = useMemo(() => {
    return fixtures.reduce<Record<number, FixtureRow[]>>((acc, fixture) => {
      if (!acc[fixture.gameweek]) acc[fixture.gameweek] = [];
      acc[fixture.gameweek].push(fixture);
      return acc;
    }, {});
  }, [fixtures]);

  const gameweeks = useMemo(
    () => Object.keys(fixturesByGameweek).map(Number).sort((a, b) => a - b),
    [fixturesByGameweek],
  );

  if (loading && !selectedSeason) {
    return (
      <Card className="p-6">
        <h1 className="mb-4 text-xl font-semibold">Legacy Fixtures by Gameweek</h1>
        <p className="text-sm text-muted-foreground">Loading...</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <h1 className="mb-4 text-xl font-semibold">Legacy Fixtures by Gameweek</h1>
        <p className="text-sm text-destructive">{error}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Legacy Fixtures by Gameweek</h1>
        <p className="text-sm text-muted-foreground">Results from legacy H2H gameweek records.</p>
      </div>

      <Card className="p-4">
        <label className="text-sm font-medium mb-2 block">Season</label>
        <select
          value={selectedSeason}
          onChange={(e) => setSelectedSeason(e.target.value)}
          className="px-3 py-2 border rounded-md"
        >
          {seasons.map((season) => (
            <option key={season} value={season}>
              {season}
            </option>
          ))}
        </select>
      </Card>

      {loading ? (
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Loading fixtures...</p>
        </Card>
      ) : gameweeks.length === 0 ? (
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">No fixtures available for {selectedSeason}.</p>
        </Card>
      ) : (
        gameweeks.map((gw) => (
          <Card key={gw} className="p-4">
            <h2 className="text-lg font-semibold mb-3">Gameweek {gw}</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Manager 1</TableHead>
                  <TableHead>Manager 2</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead>Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fixturesByGameweek[gw].map((fixture) => (
                  <TableRow key={`${fixture.season}-${fixture.gameweek}-${fixture.manager_1}-${fixture.manager_2}`}>
                    <TableCell className="font-medium">{fixture.manager_1}</TableCell>
                    <TableCell className="font-medium">{fixture.manager_2}</TableCell>
                    <TableCell className="text-right">
                      {fixture.manager_1_points} - {fixture.manager_2_points}
                    </TableCell>
                    <TableCell>{fixture.outcome}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        ))
      )}
    </div>
  );
}
