import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getPlayerInitialsAbbrev,
  getProxiedImageUrl,
  handlePlayerImageErrorWithWikipediaFallback,
} from "../lib/playerImage";
import { Card } from "./ui/card";
import { EDGE_FUNCTIONS_BASE } from "../lib/constants";
import { getSupabaseFunctionHeaders, supabaseUrl } from "../lib/supabaseClient";
import type { LiveDataResponse } from "../lib/types/api";

type StatKey =
  | "goals_scored"
  | "assists"
  | "starts"
  | "penalties_saved"
  | "yellow_cards"
  | "red_cards"
  | "clean_sheets"
  | "defensive_returns"
  | "bonus_points"
  | "subbed_on"
  | "own_goals"
  | "keeper_saves"
  | "penalties_missed";

interface MatchupRow {
  team_1_id: string;
  team_2_id: string;
  team_1_entry_id?: string | null;
  team_2_entry_id?: string | null;
  gameweek?: number;
}

interface MatchupsResponse {
  gameweek: number;
  matchups: MatchupRow[];
}

interface LineupPlayer {
  player_id: number;
  player_name: string;
  player_image_url?: string | null;
  position: number;
  minutes: number;
  is_bench?: boolean;
  effective_points: number;
  defensive_contributions: number;
  clean_sheets: number;
  goals_scored: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
  penalties_saved: number;
  penalties_missed?: number;
  saves?: number;
  /** Fixture kickoff (ISO string) for event-time sorting */
  fixture_kickoff_time?: string | null;
  /** Minutes elapsed in fixture for event-time sorting */
  fixture_elapsed?: number;
}

interface MatchupPayload {
  type?: "league" | "cup";
  gameweek: number;
  matchup: {
    live_team_1_points: number;
    live_team_2_points: number;
    round?: string | null;
    team_1_points?: number | null;
    team_2_points?: number | null;
  };
  team_1: {
    manager_name: string;
    entry_name?: string | null;
    lineup: LineupPlayer[];
  };
  team_2: {
    manager_name: string;
    entry_name?: string | null;
    lineup: LineupPlayer[];
  };
}

interface PlayerSnapshot {
  key: string;
  player_id: number;
  player_name: string;
  player_image_url?: string | null;
  manager_name: string;
  team_name?: string | null;
  opp_team_name?: string | null;
  team_score: number;
  opp_score: number;
  points: number;
  is_bench: boolean;
  competition?: "league" | "cup";
  cup_round?: string | null;
  cup_team_points?: number | null;
  cup_opp_points?: number | null;
  cup_rank?: number | null;
  goals_scored: number;
  assists: number;
  starts: number;
  penalties_saved: number;
  yellow_cards: number;
  red_cards: number;
  clean_sheets: number;
  defensive_returns: number;
  bonus_points: number;
  own_goals: number;
  keeper_saves: number;
  penalties_missed: number;
  fixture_kickoff_time?: string | null;
  fixture_elapsed?: number;
}

interface UpdateRow {
  id: string;
  at: number;
  /** Real-world event time (kickoff + elapsed, or Date.now() if unknown). Always numeric; sort by this only. */
  event_time: number;
  news_added?: string | null;
  player_id: number;
  player_name: string;
  player_image_url?: string | null;
  manager_name: string;
  is_benched: boolean;
  team_name?: string | null;
  opp_team_name?: string | null;
  competition?: string;
  competition_detail?: string;
  action: string;
  statKey?: StatKey;
  points: number;
  fixture_score: string;
}

function computeEventTime(
  fixtureKickoff?: string | null,
  fixtureElapsed?: number,
): number {
  if (!fixtureKickoff) return Date.now();
  const kickoffMs = new Date(fixtureKickoff).getTime();
  if (!Number.isFinite(kickoffMs)) return Date.now();
  const elapsedMs = (fixtureElapsed ?? 0) * 60 * 1000;
  return kickoffMs + elapsedMs;
}

function sortUpdates(rows: UpdateRow[]): UpdateRow[] {
  return [...rows].sort((a, b) => {
    const diff = (b.event_time ?? (b as any).timestamp ?? 0) - (a.event_time ?? (a as any).timestamp ?? 0);
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id);
  });
}

const POLL_INTERVAL_MS = 300_000;
/** Keep all updates for the current gameweek (no cap in practice) */
const MAX_ROWS = 500;

const STAT_LABELS: Record<StatKey, string> = {
  goals_scored: "Goal",
  assists: "Assist",
  starts: "Start",
  penalties_saved: "Penalty Saved",
  yellow_cards: "Yellow Card",
  red_cards: "Red Card",
  clean_sheets: "Clean Sheet",
  defensive_returns: "Defensive Return",
  bonus_points: "Bonus",
  subbed_on: "Subbed On",
  own_goals: "Own Goal",
  keeper_saves: "Saves (3x)",
  penalties_missed: "Penalty Missed",
};

const STAT_ICONS: Record<StatKey, string> = {
  goals_scored: "⚽",
  assists: "👟",
  starts: "▶️",
  penalties_saved: "🧤",
  yellow_cards: "🟨",
  red_cards: "🟥",
  clean_sheets: "🛡️",
  defensive_returns: "🔒",
  bonus_points: "⭐",
  subbed_on: "↩️",
  own_goals: "⚽❌",
  keeper_saves: "🧤",
  penalties_missed: "❌⚽",
};

const STAT_PRIORITY: StatKey[] = [
  "red_cards",
  "own_goals",
  "goals_scored",
  "assists",
  "penalties_saved",
  "penalties_missed",
  "clean_sheets",
  "defensive_returns",
  "bonus_points",
  "keeper_saves",
  "subbed_on",
  "starts",
  "yellow_cards",
];

const avatarFallback = (name: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "Player")}&background=1f2937&color=ffffff&size=128&bold=true`;
const sanitizeImageUrl = (url?: string | null) => String(url || "").replace(/^http:\/\//i, "https://").trim();

function asRounded(value: number) {
  return Math.round(Number(value || 0));
}

/** Clean sheet only counts when the player's match is completed (90+ mins). Forwards (4) don't get CS. */
function hasCompletedCleanSheet(player: LineupPlayer) {
  return Number(player.position || 0) !== 4 && Number(player.clean_sheets || 0) > 0 && Number(player.minutes || 0) >= 90;
}

function hasDefensiveReturn(player: LineupPlayer) {
  const contributions = Number(player.defensive_contributions || 0);
  const position = Number(player.position || 0);
  if (position === 2) return contributions >= 10;
  if (position === 3 || position === 4) return contributions >= 12;
  return false;
}

function computeLeagueLiveScore(players: LineupPlayer[]) {
  return players.reduce((sum, player) => {
    if (player.is_bench) return sum;
    return sum + Number(player.effective_points || 0);
  }, 0);
}

export function summarizeMatchupHighlights(
  payload: MatchupPayload,
  startsByPlayerId: Record<number, number>,
  limit = 6,
): Array<{
  player_id: number;
  player_name: string;
  player_image_url?: string | null;
  action: string;
  points: number;
  fixture_score: string;
}> {
  const rows: Array<{
    player_id: number;
    player_name: string;
    player_image_url?: string | null;
    action: string;
    points: number;
    fixture_score: string;
    weight: number;
  }> = [];

  const append = (players: LineupPlayer[], teamScore: number, oppScore: number) => {
    players.forEach((player) => {
      const starts = Number(startsByPlayerId[player.player_id] || 0);
      const statMap: Record<StatKey, number> = {
        goals_scored: Number(player.goals_scored || 0),
        assists: Number(player.assists || 0),
        starts,
        penalties_saved: Number(player.penalties_saved || 0),
        yellow_cards: Number(player.yellow_cards || 0),
        red_cards: Number(player.red_cards || 0),
        clean_sheets: hasCompletedCleanSheet(player) ? 1 : 0,
        defensive_returns: hasDefensiveReturn(player) ? 1 : 0,
        bonus_points: 0,
        subbed_on: 0,
        own_goals: 0,
        keeper_saves: 0,
        penalties_missed: Number(player.penalties_missed || 0),
      };

      const key = STAT_PRIORITY.find((k) => statMap[k] > 0);
      if (!key) return;

      rows.push({
        player_id: player.player_id,
        player_name: player.player_name,
        player_image_url: player.player_image_url || null,
        action: `${STAT_LABELS[key]}${statMap[key] > 1 ? ` x${statMap[key]}` : ""}`,
        points: asRounded(player.effective_points),
        fixture_score: `${asRounded(teamScore)}-${asRounded(oppScore)}`,
        weight: STAT_PRIORITY.indexOf(key),
      });
    });
  };

  const team1Score = computeLeagueLiveScore(payload.team_1.lineup || []);
  const team2Score = computeLeagueLiveScore(payload.team_2.lineup || []);

  append(payload.team_1.lineup || [], team1Score, team2Score);
  append(payload.team_2.lineup || [], team2Score, team1Score);

  return rows
    .sort((a, b) => a.weight - b.weight || b.points - a.points || a.player_name.localeCompare(b.player_name))
    .slice(0, limit)
    .map(({ weight: _weight, ...rest }) => rest);
}

export default function LivePlayerUpdates() {
  const [rows, setRows] = useState<UpdateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameweek, setGameweek] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const previousRef = useRef<Record<string, PlayerSnapshot>>({});
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (silent = false): Promise<boolean> => {
    let eventFinished = true;
    if (!silent) {
      setLoading(true);
      setError(null);
    }

    try {
      // Check if any games are currently live before fetching matchups
      const gwRes = await fetch(
        `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/current-gameweek`,
        { headers: getSupabaseFunctionHeaders() },
      );
      const gwData = gwRes.ok ? await gwRes.json() : null;
      eventFinished =
        gwData?.current_event_finished === true || gwData?.event_finished === true;

      // Don't fetch matchup data if no active gameweek
      if (eventFinished) {
        return true;
      }

      const matchupsUrl = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/h2h-matchups`;
      const matchupsRes = await fetch(matchupsUrl, { headers: getSupabaseFunctionHeaders() });
      const matchupsPayload: MatchupsResponse = await matchupsRes.json();

      if (!matchupsRes.ok || (matchupsPayload as any)?.error) {
        throw new Error((matchupsPayload as any)?.error?.message || "Failed to fetch matchups");
      }

      setGameweek(matchupsPayload.gameweek);

      const liveUrl = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/api/live?event=${matchupsPayload.gameweek}`;
      const liveRes = await fetch(liveUrl, { headers: getSupabaseFunctionHeaders() });
      const livePayload: LiveDataResponse | null = liveRes.ok ? await liveRes.json() : null;
      const startsByPlayerId: Record<number, number> = {};
      const elementsObj = livePayload?.elements ?? {};
      Object.entries(elementsObj).forEach(([key, el]: [string, any]) => {
        const id = Number(key);
        if (id) startsByPlayerId[id] = Number(el?.stats?.starts ?? 0);
      });

      const detailPayloads = await Promise.all(
        (matchupsPayload.matchups || []).map(async (m) => {
          const params = new URLSearchParams({
            type: "league",
            gameweek: String(m.gameweek || matchupsPayload.gameweek),
            team1: String(m.team_1_entry_id || m.team_1_id),
            team2: String(m.team_2_entry_id || m.team_2_id),
          });
          const detailUrl = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/fixtures/matchup?${params.toString()}`;
          const detailRes = await fetch(detailUrl, { headers: getSupabaseFunctionHeaders() });
          if (!detailRes.ok) return null;
          const payload = await detailRes.json();
          if (payload?.error) return null;
          return payload as MatchupPayload;
        }),
      );

      const current: Record<string, PlayerSnapshot> = {};
      detailPayloads.filter(Boolean).forEach((payload) => {
        if (!payload) return;
        const t1 = asRounded(computeLeagueLiveScore(payload.team_1.lineup || []));
        const t2 = asRounded(computeLeagueLiveScore(payload.team_2.lineup || []));

        const compType = (payload.type === "cup" ? "cup" : "league") as "league" | "cup";
        const team1Name = payload.team_1.entry_name ?? payload.team_1.manager_name;
        const team2Name = payload.team_2.entry_name ?? payload.team_2.manager_name;

        payload.team_1.lineup.forEach((p) => {
          const key = `${payload.team_1.manager_name}-${p.player_id}`;
          current[key] = {
            key,
            player_id: p.player_id,
            player_name: p.player_name,
            player_image_url: p.player_image_url || null,
            manager_name: payload.team_1.manager_name,
            team_name: team1Name,
            opp_team_name: team2Name,
            team_score: t1,
            opp_score: t2,
            points: asRounded(p.effective_points),
            is_bench: !!p.is_bench,
            competition: compType,
            cup_round: payload.matchup?.round ?? null,
            cup_team_points: payload.matchup?.team_1_points ?? null,
            cup_opp_points: payload.matchup?.team_2_points ?? null,
            goals_scored: Number(p.goals_scored || 0),
            assists: Number(p.assists || 0),
            starts: Number(startsByPlayerId[p.player_id] || 0),
            penalties_saved: Number(p.penalties_saved || 0),
            penalties_missed: Number((p as any).penalties_missed || 0),
            yellow_cards: Number(p.yellow_cards || 0),
            red_cards: Number(p.red_cards || 0),
            clean_sheets: hasCompletedCleanSheet(p) ? 1 : 0,
            defensive_returns: hasDefensiveReturn(p) ? 1 : 0,
            keeper_saves: Math.floor(Number((p as any).saves || 0) / 3),
            bonus_points: Number((p as any).bonus || 0),
            fixture_kickoff_time: p.fixture_kickoff_time ?? null,
            fixture_elapsed: p.fixture_elapsed ?? 0,
          };
        });

        payload.team_2.lineup.forEach((p) => {
          const key = `${payload.team_2.manager_name}-${p.player_id}`;
          current[key] = {
            key,
            player_id: p.player_id,
            player_name: p.player_name,
            player_image_url: p.player_image_url || null,
            manager_name: payload.team_2.manager_name,
            team_name: team2Name,
            opp_team_name: team1Name,
            team_score: t2,
            opp_score: t1,
            points: asRounded(p.effective_points),
            is_bench: !!p.is_bench,
            competition: compType,
            cup_round: payload.matchup?.round ?? null,
            cup_team_points: payload.matchup?.team_2_points ?? null,
            cup_opp_points: payload.matchup?.team_1_points ?? null,
            goals_scored: Number(p.goals_scored || 0),
            assists: Number(p.assists || 0),
            starts: Number(startsByPlayerId[p.player_id] || 0),
            penalties_saved: Number(p.penalties_saved || 0),
            penalties_missed: Number((p as any).penalties_missed || 0),
            yellow_cards: Number(p.yellow_cards || 0),
            red_cards: Number(p.red_cards || 0),
            clean_sheets: hasCompletedCleanSheet(p) ? 1 : 0,
            defensive_returns: hasDefensiveReturn(p) ? 1 : 0,
            keeper_saves: Math.floor(Number((p as any).saves || 0) / 3),
            bonus_points: Number((p as any).bonus || 0),
            fixture_kickoff_time: p.fixture_kickoff_time ?? null,
            fixture_elapsed: p.fixture_elapsed ?? 0,
          };
        });
      });

      const now = Date.now();
      const previous = previousRef.current;

      const statKeys: StatKey[] = [
        "goals_scored",
        "assists",
        "starts",
        "penalties_saved",
        "penalties_missed",
        "yellow_cards",
        "red_cards",
        "clean_sheets",
        "defensive_returns",
        "bonus_points",
        "keeper_saves",
        "subbed_on",
        "own_goals",
      ];

      const compDetail = (snap: PlayerSnapshot) => {
        if (snap.competition === "cup" && snap.cup_round) {
          if (snap.cup_team_points != null && snap.cup_opp_points != null) {
            return `${snap.team_score}-${snap.opp_score} (${snap.cup_round})`;
          }
          return snap.cup_round;
        }
        return null;
      };

      const rawRows: Omit<UpdateRow, "at">[] = [];
      Object.values(current).forEach((snapshot) => {
        const oldSnapshot = previous[snapshot.key];
        const event_time = computeEventTime(
          snapshot.fixture_kickoff_time ?? undefined,
          snapshot.fixture_elapsed ?? undefined,
        );
        for (const key of statKeys) {
          const nextValue = Number(snapshot[key] || 0);
          const previousValue = Number(oldSnapshot?.[key] || 0);
          let delta = nextValue - previousValue;
          // Subbed on: switched from bench to XI with positive points increase
          if (key === "subbed_on") {
            if (oldSnapshot && oldSnapshot.is_bench && !snapshot.is_bench && snapshot.points > oldSnapshot.points) {
              delta = 1;
            } else {
              delta = 0;
            }
          }
          if (delta <= 0) continue;
          const detail = compDetail(snapshot);
          rawRows.push({
            id: `${snapshot.key}-${key}-${now}-${delta}`,
            event_time,
            player_id: snapshot.player_id,
            player_name: snapshot.player_name,
            player_image_url: snapshot.player_image_url,
            manager_name: snapshot.manager_name,
            is_benched: snapshot.is_bench,
            team_name: snapshot.team_name ?? null,
            opp_team_name: snapshot.opp_team_name ?? null,
            competition: snapshot.competition === "cup" ? "Cup" : "League",
            competition_detail: detail ?? undefined,
            action: `${STAT_LABELS[key]}${delta > 1 ? ` +${delta}` : ""}`,
            statKey: key,
            points: snapshot.points,
            fixture_score: `${snapshot.team_score}-${snapshot.opp_score}`,
          });
        }
      });

      const nextRows: UpdateRow[] = rawRows.map((row) => ({
        ...row,
        at: now,
      }));

      if (nextRows.length > 0) {
        setRows((prev) => [...nextRows, ...prev].slice(0, MAX_ROWS));
      }

      previousRef.current = current;
      setLastUpdated(now);
      setError(null);

      try {
        const gwRes = await fetch(
          `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/current-gameweek`,
          { headers: getSupabaseFunctionHeaders() }
        );
        const gwData = gwRes.ok ? await gwRes.json() : null;
        eventFinished = gwData?.event_finished === true || gwData?.current_event_finished === true;
      } catch {
        // default eventFinished stays true (no polling)
      }
    } catch (err: any) {
      if (!silent) {
        setError(err?.message || "Failed to load live updates");
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
    return eventFinished;
  }, []);

  useEffect(() => {
    let mounted = true;

    const run = (silent = false) => {
      if (!mounted) return Promise.resolve(true);
      return load(silent);
    };

    run(false).then((eventFinished) => {
      if (!eventFinished && mounted) {
        pollingIntervalRef.current = window.setInterval(() => run(true), POLL_INTERVAL_MS);
      }
    });

    return () => {
      mounted = false;
      if (pollingIntervalRef.current) {
        window.clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [load]);

  const visibleRows = useMemo(() => sortUpdates(rows), [rows]);

  if (loading) {
    return (
      <Card className="p-4">
        <h3 className="text-lg font-semibold">Latest Updates</h3>
        <p className="mt-2 text-sm text-muted-foreground">Loading live player updates...</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-4">
        <h3 className="text-lg font-semibold">Latest Updates</h3>
        <p className="mt-2 text-sm text-destructive">{error}</p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">Latest Updates</h3>
          <p className="text-xs text-muted-foreground">
            {gameweek ? `GW ${gameweek}` : "Live"} highlights for owned players
          </p>
        </div>
        {lastUpdated ? <p className="text-[11px] text-muted-foreground">Updated {new Date(lastUpdated).toLocaleTimeString()}</p> : null}
      </div>

      {visibleRows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No live stat events yet. Updates will appear as games progress.</p>
      ) : (
        <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
          {visibleRows.map((row) => (
            <div key={row.id} className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-2 rounded-md border bg-background/70 p-2">
              <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border bg-muted">
                {row.player_image_url ? (
                  <img
                    src={getProxiedImageUrl(row.player_image_url) ?? undefined}
                    alt={row.player_name}
                    className="h-full w-full object-cover"
                    onError={(e) =>
                      handlePlayerImageErrorWithWikipediaFallback(e, row.player_name, {
                        fallbackClassName:
                          "absolute inset-0 flex items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground",
                      })
                    }
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-[10px] font-bold text-muted-foreground">
                    {getPlayerInitialsAbbrev(row.player_name)}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {row.player_name}
                  <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                    ({row.is_benched ? "Benched" : "Started"})
                  </span>
                </p>
                <p className="truncate text-xs text-muted-foreground flex items-center gap-1.5">
                  {row.statKey && (
                    <span className="shrink-0 text-sm" title={row.action} aria-hidden>
                      {STAT_ICONS[row.statKey]}
                    </span>
                  )}
                  <span>{row.action}</span>
                  <span>•</span>
                  <span>{row.manager_name}</span>
                  {row.competition ? ` • ${row.competition}` : ""}
                  {row.competition_detail ? ` • ${row.competition_detail}` : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold">{row.points} pts</p>
                <p className="text-[11px] text-muted-foreground">
                  {[row.team_name, row.fixture_score, row.opp_team_name].filter(Boolean).join(" ")}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
