/**
 * Cup Group Stage - Public Read-Only
 * 
 * Displays cup group stage standings with all 10 league members
 * automatically registered. No user registration required.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getSupabaseFunctionHeaders, supabaseUrl } from "../lib/supabaseClient";
import { Card } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { EDGE_FUNCTIONS_BASE } from "../lib/constants";
import { useManagerCrestMap } from "../lib/useManagerCrestMap";

interface CupStanding {
  team_id: string;
  entry_name: string;
  manager_name: string;
  manager_short_name: string;
  total_points: number;
  captain_points: number;
  played: number;
  wins?: number;
  draws?: number;
  losses?: number;
  plus?: number;
  rank: number;
}

interface CupGroupStageResponse {
  registeredCount: number;
  standings: CupStanding[];
  autoRegistered: boolean;
}

interface LineupPlayer {
  player_id: number;
  player_name: string;
  position: number;
  is_captain: boolean;
  is_vice_captain: boolean;
  is_cup_captain: boolean;
  raw_points: number;
  multiplier: number;
  effective_points: number;
}

interface LineupPayload {
  gameweek: number;
  total_points: number;
  team: { id: string; entry_name: string | null; manager_name: string | null };
  lineup: LineupPlayer[];
}

const POSITION_LABELS: Record<number, string> = {
  1: "GKP",
  2: "DEF",
  3: "MID",
  4: "FWD",
};

const REFRESH_INTERVAL = 30_000; // 30 seconds

export default function CupGroupStage() {
  const [data, setData] = useState<CupGroupStageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fixtureGameweek, setFixtureGameweek] = useState<number | null>(null);
  const [groupStageStart, setGroupStageStart] = useState<number | null>(null);
  const [groupStageEnd, setGroupStageEnd] = useState<number | null>(null);
  const [lineupsByTeam, setLineupsByTeam] = useState<Record<string, LineupPayload>>({});
  const [fixturesLoading, setFixturesLoading] = useState(false);
  const [currentGw, setCurrentGw] = useState<number | null>(null);
  const { getCrest } = useManagerCrestMap();

  useEffect(() => {
    fetch(
      `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/current-gameweek`,
      { headers: getSupabaseFunctionHeaders() }
    )
      .then((r) => r.json())
      .then((d) => setCurrentGw(d?.current_gameweek ?? null))
      .catch(() => {});
  }, []);

  const fetchStandings = async () => {
    try {
      setError(null);
      const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/cup-group-stage`;
      const res = await fetch(url, { headers: getSupabaseFunctionHeaders() });
      const payload: CupGroupStageResponse = await res.json();

      if (!res.ok || payload?.error) {
        throw new Error(payload?.error?.message || "Failed to fetch cup standings");
      }

      setData(payload);
      setLoading(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Unknown error");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStandings();
    const interval = setInterval(fetchStandings, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetch(
      `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/current-gameweek`,
      { headers: getSupabaseFunctionHeaders() }
    )
      .then((r) => r.json())
      .then((d) => {
        if (d?.current_gameweek != null) {
          setFixtureGameweek(Number(d.current_gameweek));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setGroupStageStart(29);
    setGroupStageEnd(32);
  }, []);

  // Fetch lineups for current GW when in group stage
  const isGroupStageGw =
    fixtureGameweek != null &&
    groupStageStart != null &&
    groupStageEnd != null &&
    fixtureGameweek >= groupStageStart &&
    fixtureGameweek <= groupStageEnd;

  useEffect(() => {
    if (!isGroupStageGw || !data?.standings?.length) return;

    const teamIds = data.standings.map((s) => s.team_id);
    setFixturesLoading(true);
    setLineupsByTeam({});

    let cancelled = false;
    (async () => {
      const gw = fixtureGameweek!;
      const next: Record<string, LineupPayload> = {};
      await Promise.all(
        teamIds.map(async (teamId) => {
          if (cancelled) return;
          try {
            const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/fixtures/lineup?team=${encodeURIComponent(teamId)}&gameweek=${gw}&type=cup`;
            const res = await fetch(url, { headers: getSupabaseFunctionHeaders() });
            const payload = await res.json();
            if (!cancelled && res.ok && !payload?.error) next[teamId] = payload as LineupPayload;
          } catch {
            // skip this team
          }
        })
      );
      if (!cancelled) {
        setLineupsByTeam(next);
      }
      if (!cancelled) setFixturesLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [isGroupStageGw, fixtureGameweek, data?.standings]);

  // Determine advancing threshold (top 80%)
  const advancingCount = data && data.standings.length > 0 ? Math.ceil(data.standings.length * 0.8) : 0;
  const hasStandings = data && data.standings.length > 0;
  const standings = data?.standings || [];

  const groupStageComplete = useMemo(() => {
    if (!standings.length || groupStageStart == null || groupStageEnd == null) return false;
    const expected = Math.max(1, groupStageEnd - groupStageStart + 1);
    const allPlayed = standings.every((s) => (s.played ?? 0) >= expected);
    const calendarPast = currentGw != null && currentGw > 0 && currentGw > groupStageEnd;
    return allPlayed || calendarPast;
  }, [standings, groupStageStart, groupStageEnd, currentGw]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Cup Group Stage</h1>
        <p className="text-sm text-muted-foreground">
          {data ? (
            <>
              All {data.registeredCount} league members are automatically registered.
              {hasStandings && ` Top ${advancingCount} advance.`}
            </>
          ) : (
            "All league members are automatically registered."
          )}
        </p>
      </div>

      {error && (
        <Card className="p-4">
          <p className="text-sm text-destructive">Error: {error}</p>
        </Card>
      )}

      <Card className="p-4">
        {loading && standings.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Loading group stage standings…</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Rank</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead className="text-right">W</TableHead>
                <TableHead className="text-right">D</TableHead>
                <TableHead className="text-right">L</TableHead>
                <TableHead className="text-right">+</TableHead>
                <TableHead className="text-right">Total Points</TableHead>
                <TableHead className="text-right">Captain Points</TableHead>
                <TableHead className="text-right">Played</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {standings.length > 0 ? (
                standings.map((team) => {
                  const advancing = hasStandings && team.rank <= advancingCount;
                  return (
                    <TableRow
                      key={team.team_id || team.manager_name}
                      className={advancing ? "bg-green-50 dark:bg-green-950/40 font-semibold" : ""}
                    >
                      <TableCell>{team.rank}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getCrest(team.manager_name) ? (
                            <img
                              src={getCrest(team.manager_name)!}
                              alt=""
                              className="h-4 w-4 rounded object-cover border"
                            />
                          ) : null}
                          {currentGw ? (
                            <Link
                              to={`/lineup/cup/${currentGw}/${team.team_id}`}
                              className="hover:underline text-primary"
                            >
                              {team.entry_name || team.manager_name || "—"}
                            </Link>
                          ) : (
                            <span>{team.entry_name || team.manager_name || "—"}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{team.manager_name}</TableCell>
                      <TableCell className="text-right">{team.wins ?? 0}</TableCell>
                      <TableCell className="text-right">{team.draws ?? 0}</TableCell>
                      <TableCell className="text-right">{team.losses ?? 0}</TableCell>
                      <TableCell className="text-right">{team.plus ?? 0}</TableCell>
                      <TableCell className="text-right font-medium">
                        {team.total_points}
                      </TableCell>
                      <TableCell className="text-right">{(team.captain_points ?? 0) * 2}</TableCell>
                      <TableCell className="text-right">{team.played}</TableCell>
                      <TableCell className="text-center">
                        {hasStandings ? (
                          advancing ? (
                            <span className="text-green-600 dark:text-green-400">
                              {groupStageComplete ? "Qualified" : "Advancing"}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Eliminated</span>
                          )
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                    {loading ? "Loading..." : "No league members found in database."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      {isGroupStageGw && fixtureGameweek != null && (
        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-4">GW{fixtureGameweek} Fixtures</h2>
          {fixturesLoading && Object.keys(lineupsByTeam).length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Loading lineups…</p>
          ) : (
            <div className="space-y-6">
              {standings.map((team) => {
                const lineup = lineupsByTeam[team.team_id];
                return (
                  <div key={team.team_id || team.manager_name} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getCrest(team.manager_name) ? (
                        <img
                          src={getCrest(team.manager_name)!}
                          alt=""
                          className="h-5 w-5 rounded object-cover border"
                        />
                      ) : null}
                      <span className="font-medium">{team.entry_name || team.manager_name}</span>
                      <span className="text-muted-foreground text-sm">{team.manager_name}</span>
                      {lineup != null && (
                        <span className="text-sm font-semibold ml-auto">
                          Total: {Math.round(lineup.total_points)} pts
                        </span>
                      )}
                    </div>
                    {lineup?.lineup?.length ? (
                      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1 text-sm">
                        {lineup.lineup.map((p) => (
                          <li key={p.player_id} className="flex items-center justify-between gap-2">
                            <span className="text-muted-foreground w-8">{POSITION_LABELS[p.position] ?? p.position}</span>
                            <span className="truncate">
                              {p.player_name}
                              {p.is_cup_captain && " (C)"}
                              {p.is_vice_captain && !p.is_cup_captain && " (VC)"}
                            </span>
                            <span className="font-medium tabular-nums">{Math.round(p.effective_points)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : lineup ? (
                      <p className="text-sm text-muted-foreground">No lineup data for this gameweek.</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Loading…</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
