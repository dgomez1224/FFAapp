/**
 * League Standings - Public Read-Only
 * 
 * Displays the main FPL league standings based on the static entry ID.
 * Shows all managers, teams, and points in a public table.
 */

import React, { useEffect, useMemo, useState, useRef } from "react";
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
  currentGameweek: number,
  entryIdToTeamId: Record<string, string>
): Standing[] {
  if (!baseline.length || !matches.length || !currentGameweek) {
    return baseline;
  }

  const byId: Record<string, Standing> = {};
  baseline.forEach((row) => {
    byId[row.team_id] = { ...row };
  });

  const baselineIds = new Set(Object.keys(byId));

  const currentMatches = matches.filter(
    (m: any) => Number(m?.event) === currentGameweek
  );

  currentMatches.forEach((m: any) => {
    const rawTeam1 = m?.league_entry_1 ?? m?.entry_1 ?? m?.home;
    const rawTeam2 = m?.league_entry_2 ?? m?.entry_2 ?? m?.away;
    if (rawTeam1 == null || rawTeam2 == null) return;

    const entry1Id = String(rawTeam1);
    const entry2Id = String(rawTeam2);

    const key1 = entryIdToTeamId[entry1Id] ?? entry1Id;
    const key2 = entryIdToTeamId[entry2Id] ?? entry2Id;

    // Skip any match entry not in baseline
    if (!baselineIds.has(key1) && !baselineIds.has(key2)) return;

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
  const baselineRanksRef = useRef<Record<string, number> | null>(null);

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

        if (!res.ok || (payload as any)?.error) {
          throw new Error(payload?.error?.message || "Failed to fetch league standings");
        }

        let entryIdToTeamId: Record<string, string> = {};
        if (Array.isArray(payload.standings)) {
          payload.standings.forEach((s: any) => {
            const entryId = (s as any).entry_id;
            const teamId = (s as any).team_id;
            if (entryId != null && teamId) {
              entryIdToTeamId[String(entryId)] = String(teamId);
            }
          });
        }

        if (!baselineRanksRef.current && payload?.standings?.length) {
          const initial: Record<string, number> = {};
          payload.standings.forEach((s, index) => {
            initial[s.team_id] = index + 1;
          });
          baselineRanksRef.current = initial;
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

          // Overlay real names from draft API league entries when available.
          try {
            if (Array.isArray(leagueEntries) && leagueEntries.length && Array.isArray(payload.standings) && payload.standings.length) {
              const nameByEntryId: Record<string, { entry_name: string; manager_name: string }> = {};
              leagueEntries.forEach((e: any) => {
                const fplId = String(e.entry_id ?? e.entry ?? "").trim();
                if (!fplId) return;
                const firstName = String(e.player_first_name ?? "").trim();
                const lastName = String(e.player_last_name ?? "").trim();
                nameByEntryId[fplId] = {
                  entry_name: String(e.entry_name ?? "").trim() || fplId,
                  manager_name: [firstName, lastName].filter(Boolean).join(" ") || fplId,
                };
              });

              if (Object.keys(nameByEntryId).length > 0) {
                payload.standings = payload.standings.map((s: any) => {
                  const fplId = String((s as any).entry_id ?? "");
                  const names = fplId ? nameByEntryId[fplId] : null;
                  return names ? { ...s, ...names } : s;
                });
                // Re-set data with updated names for display and live overlays.
                setData({ ...payload });
              }
            }
          } catch {
            // Non-fatal: fall back to database names.
          }

          // If standings payload did not include entry_id mapping, derive it from league_entries/teams.
          if (!Object.keys(entryIdToTeamId).length && Array.isArray(leagueEntries)) {
            try {
              const teamsRes = await fetch(
                `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/league-standings`,
                { headers: getSupabaseFunctionHeaders() }
              );
              const teamsJson: any = teamsRes.ok ? await teamsRes.json() : null;
              const teams = Array.isArray(teamsJson?.teams) ? teamsJson.teams : [];
              teams.forEach((t: any) => {
                const entryId = t.entry_id ?? t.entry ?? null;
                const teamId = t.id ?? t.team_id ?? null;
                if (entryId != null && teamId) {
                  entryIdToTeamId[String(entryId)] = String(teamId);
                }
              });
            } catch {
              // Non-fatal; live standings will fall back to baseline.
            }
          }

          // Also map internal draft league_entry ids -> team UUIDs using league_entries.
          if (Array.isArray(leagueEntries) && leagueEntries.length && Object.keys(entryIdToTeamId).length) {
            const internalIdToTeamId: Record<string, string> = {};
            leagueEntries.forEach((e: any) => {
              const internalId = String(e.id ?? e.league_entry_id ?? "").trim();
              const fplId = String(e.entry_id ?? e.entry ?? "").trim();
              const teamId = fplId ? entryIdToTeamId[fplId] : undefined;
              if (internalId && teamId) {
                internalIdToTeamId[internalId] = teamId;
              }
            });
            Object.assign(entryIdToTeamId, internalIdToTeamId);
          }
          // Show live standings for the entire current gameweek (pre-match, live, or post-match)
          const hasCurrentGwMatches =
            currentGw > 0 &&
            matches.some((m: any) => Number(m?.event) === currentGw);

          if (!currentGw || !hasCurrentGwMatches || !payload.standings?.length) {
            setIsLiveGameweek(false);
            setLiveStandings(null);
          } else {
            const live = computeLiveStandingsFromMatches(
              payload.standings,
              matches,
              currentGw,
              entryIdToTeamId
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
    }, 300_000);
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
              {rowsToRender.map((standing, index) => {
                const baseline = baselineById[standing.team_id];
                const baselineRank =
                  baselineRanksRef.current?.[standing.team_id] ?? null;
                const currentRank = standing.rank;
                const moved =
                  baselineRank != null ? baselineRank - currentRank : 0;

                let deltaSymbol = "—";
                let deltaClass = "text-muted-foreground";
                if (isLiveGameweek && baselineRank != null) {
                  if (moved > 0) {
                    deltaSymbol = `↑${moved}`;
                    deltaClass = "text-emerald-500 font-semibold";
                  } else if (moved < 0) {
                    deltaSymbol = `↓${Math.abs(moved)}`;
                    deltaClass = "text-red-500 font-semibold";
                  } else {
                    deltaSymbol = "—";
                    deltaClass = "text-muted-foreground";
                  }
                }

                const winsChanged =
                  isLiveGameweek && baseline && standing.wins > baseline.wins;
                const drawsChanged =
                  isLiveGameweek && baseline && standing.draws > baseline.draws;
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
