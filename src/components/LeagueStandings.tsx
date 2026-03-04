/**
 * League Standings - Public Read-Only
 * 
 * Displays the main FPL league standings based on the static entry ID.
 * Shows all managers, teams, and points in a public table.
 */

import React, { useEffect, useMemo, useState } from "react";
import { getSupabaseFunctionHeaders, supabaseUrl } from "../lib/supabaseClient";
import { Card } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { EDGE_FUNCTIONS_BASE, DRAFT_BASE_URL, LEAGUE_ID } from "../lib/constants";
import { useManagerCrestMap } from "../lib/useManagerCrestMap";

interface Standing {
  team_id: string;
  rank: number;
  manager_name?: string;
  entry_name?: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  points_for: number;
  points_against: number;
  avg_margin_victory?: number | null;
  avg_margin_defeat?: number | null;
}

interface LeagueStandingsResponse {
  standings: Standing[];
  source: "database" | "draft" | "classic";
}

function computeLiveStandingsFromMatches(
  baseline: Standing[],
  matches: any[],
  currentGameweek: number
): Standing[] {
  if (!baseline.length || !matches.length || !currentGameweek) {
    return baseline;
  }

  const byId: Record<string, Standing> = {};
  baseline.forEach((row) => {
    byId[row.team_id] = { ...row };
  });

  const currentMatches = matches.filter(
    (m: any) => Number(m?.event) === currentGameweek
  );

  currentMatches.forEach((m: any) => {
    const team1Id = m?.league_entry_1 ?? m?.entry_1 ?? m?.home;
    const team2Id = m?.league_entry_2 ?? m?.entry_2 ?? m?.away;
    if (team1Id == null || team2Id == null) return;

    const key1 = String(team1Id);
    const key2 = String(team2Id);

    if (!byId[key1]) {
      byId[key1] = {
        team_id: key1,
        rank: baseline.length + 1,
        manager_name: "",
        entry_name: "",
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        points: 0,
        points_for: 0,
        points_against: 0,
        avg_margin_victory: null,
        avg_margin_defeat: null,
      };
    }
    if (!byId[key2]) {
      byId[key2] = {
        team_id: key2,
        rank: baseline.length + 1,
        manager_name: "",
        entry_name: "",
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        points: 0,
        points_for: 0,
        points_against: 0,
        avg_margin_victory: null,
        avg_margin_defeat: null,
      };
    }

    const row1 = byId[key1];
    const row2 = byId[key2];

    const rawP1 =
      m?.league_entry_1_points ??
      m?.score_1 ??
      m?.home_score ??
      0;
    const rawP2 =
      m?.league_entry_2_points ??
      m?.score_2 ??
      m?.away_score ??
      0;

    const p1 = typeof rawP1 === "number" ? rawP1 : Number(rawP1) || 0;
    const p2 = typeof rawP2 === "number" ? rawP2 : Number(rawP2) || 0;

    // Apply FOR / AGAINST from current gameweek snapshot
    row1.points_for += p1;
    row1.points_against += p2;
    row2.points_for += p2;
    row2.points_against += p1;

    // Apply W/D/L + league points as if fixtures ended now
    if (p1 > p2) {
      row1.wins += 1;
      row1.points += 3;
      row2.losses += 1;
    } else if (p2 > p1) {
      row2.wins += 1;
      row2.points += 3;
      row1.losses += 1;
    } else {
      row1.draws += 1;
      row2.draws += 1;
      row1.points += 1;
      row2.points += 1;
    }

    row1.played += 1;
    row2.played += 1;
  });

  const live = Object.values(byId).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.points_for - a.points_for;
  });

  return live.map((row, index) => ({
    ...row,
    rank: index + 1,
  }));
}

export default function LeagueStandings() {
  const [data, setData] = useState<LeagueStandingsResponse | null>(null);
  const [liveStandings, setLiveStandings] = useState<Standing[] | null>(null);
  const [isLiveGameweek, setIsLiveGameweek] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getCrest } = useManagerCrestMap();

  const baselineStandings = data?.standings || [];
  const baselineById = useMemo(() => {
    const map: Record<string, Standing> = {};
    baselineStandings.forEach((s) => {
      map[s.team_id] = s;
    });
    return map;
  }, [baselineStandings]);
  const rowsToRender = isLiveGameweek && liveStandings ? liveStandings : baselineStandings;

  useEffect(() => {
    async function fetchStandings() {
      try {
        setLoading(true);
        setError(null);

        const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/h2h-standings`;
        const res = await fetch(url, { headers: getSupabaseFunctionHeaders() });
        const payload: LeagueStandingsResponse = await res.json();

        if (!res.ok || payload?.error) {
          throw new Error(payload?.error?.message || "Failed to fetch league standings");
        }

        setData(payload);

        // Determine whether the current gameweek is live using league details
        try {
          const gwRes = await fetch(
            `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/current-gameweek`,
            { headers: getSupabaseFunctionHeaders() }
          );
          const gwData = gwRes.ok ? await gwRes.json() : null;
          const currentGw = gwData?.current_gameweek || 0;

          let matches: any[] = [];
          let leagueEntries: any[] = [];
          try {
            const matchRes = await fetch(
              `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/league-standings/matches`,
              { headers: getSupabaseFunctionHeaders() }
            );
            if (matchRes.ok) {
              const matchJson = await matchRes.json();
              matches = Array.isArray(matchJson?.matches) ? matchJson.matches : [];
              leagueEntries = Array.isArray(matchJson?.league_entries)
                ? matchJson.league_entries
                : [];
            }
          } catch {
            matches = [];
          }
          const hasLiveMatch =
            currentGw &&
            matches.some(
              (m: any) =>
                Number(m?.event) === currentGw &&
                m?.started === null &&
                m?.finished === false
            );

          if (!(gwData?.current_gameweek || 0) || !hasLiveMatch || !payload.standings?.length) {
            setIsLiveGameweek(false);
            setLiveStandings(null);
          } else {
            const live = computeLiveStandingsFromMatches(
              payload.standings,
              matches,
              currentGw
            );
            setIsLiveGameweek(true);
            setLiveStandings(live);
          }
        } catch {
          setIsLiveGameweek(false);
          setLiveStandings(null);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load league standings");
      } finally {
        setLoading(false);
      }
    }

    fetchStandings();
    const interval = setInterval(() => {
      fetchStandings();
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card className="p-6">
        <h1 className="mb-4 text-xl font-semibold">League Standings</h1>
        <p className="text-sm text-muted-foreground">Loading standings...</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <h1 className="mb-4 text-xl font-semibold">League Standings</h1>
        <p className="text-sm text-destructive">{error}</p>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-semibold">League Standings</h1>
        <p className="text-sm text-muted-foreground">Ranked by league points, then points for.</p>
      </div>

      <Card className="p-4">
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
              {rowsToRender.map((standing) => {
                const baseline = baselineById[standing.team_id];
                const baselineRank = baseline?.rank ?? null;
                const liveRank = standing.rank;
                const delta =
                  baselineRank != null ? baselineRank - liveRank : 0;

                let deltaSymbol = "—";
                let deltaClass = "text-muted-foreground";
                if (isLiveGameweek && baselineRank != null) {
                  if (delta > 0) {
                    deltaSymbol = "↑";
                    deltaClass = "text-emerald-500";
                  } else if (delta < 0) {
                    deltaSymbol = "↓";
                    deltaClass = "text-red-500";
                  } else {
                    deltaSymbol = "—";
                    deltaClass = "text-muted-foreground";
                  }
                }

                const winsChanged =
                  isLiveGameweek && baseline && standing.wins > baseline.wins;
                const drawsChanged =
                  isLiveGameweek && baseline && standing.draws !== baseline.draws;
                const lossesChanged =
                  isLiveGameweek && baseline && standing.losses > baseline.losses;
                const pointsChanged =
                  isLiveGameweek && baseline && standing.points > baseline.points;
                const forChanged =
                  isLiveGameweek &&
                  baseline &&
                  standing.points_for > baseline.points_for;
                const againstChanged =
                  isLiveGameweek &&
                  baseline &&
                  standing.points_against > baseline.points_against;

                return (
                  <TableRow key={standing.team_id}>
                    <TableCell className="fpl-rank text-center">
                      {standing.rank}
                    </TableCell>
                    <TableCell className={`text-center ${deltaClass}`}>
                      {deltaSymbol}
                    </TableCell>
                    <TableCell className="fpl-manager-name">
                      {standing.manager_name || "—"}
                    </TableCell>
                    <TableCell className="fpl-manager-name">
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
                  </TableCell>
                    <TableCell className="fpl-numeric">
                      {standing.played}
                    </TableCell>
                    <TableCell
                      className={`fpl-numeric${
                        winsChanged ? " text-emerald-500 font-semibold" : ""
                      }`}
                    >
                      {standing.wins}
                    </TableCell>
                    <TableCell
                      className={`fpl-numeric${
                        drawsChanged ? " text-muted-foreground font-semibold" : ""
                      }`}
                    >
                      {standing.draws}
                    </TableCell>
                    <TableCell
                      className={`fpl-numeric${
                        lossesChanged ? " text-red-500 font-semibold" : ""
                      }`}
                    >
                      {standing.losses}
                    </TableCell>
                    <TableCell
                      className={`fpl-points${
                        pointsChanged ? " text-emerald-500 font-semibold" : ""
                      }`}
                    >
                      {standing.points}
                    </TableCell>
                    <TableCell
                      className={`fpl-numeric${
                        forChanged ? " text-emerald-500 font-semibold" : ""
                      }`}
                    >
                      {standing.points_for}
                    </TableCell>
                    <TableCell
                      className={`fpl-numeric${
                        againstChanged ? " text-red-500 font-semibold" : ""
                      }`}
                    >
                      {standing.points_against}
                    </TableCell>
                    <TableCell className="fpl-numeric">
                      {standing.avg_margin_victory != null
                        ? standing.avg_margin_victory.toFixed(1)
                        : "—"}
                    </TableCell>
                    <TableCell className="fpl-numeric">
                      {standing.avg_margin_defeat != null
                        ? standing.avg_margin_defeat.toFixed(1)
                        : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
