/**
 * This Week's Matchups - Public Read-Only
 */

import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getSupabaseFunctionHeaders, supabaseUrl } from "../lib/supabaseClient";
import { EDGE_FUNCTIONS_BASE } from "../lib/constants";
import { Card } from "./ui/card";
import { useManagerCrestMap } from "../lib/useManagerCrestMap";
import type { LiveDataResponse } from "../lib/types/api";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./ui/hover-card";
import { summarizeMatchupHighlights } from "./LivePlayerUpdates";

interface MatchupRow {
  fixture_id?: string;
  team_1_id: string;
  team_2_id: string;
  gameweek?: number;
  team_1_points: number;
  team_2_points: number;
  team_1_rank?: number | null;
  team_2_rank?: number | null;
  winner_id: string | null;
  team_1: { entry_name: string; manager_name: string } | null;
  team_2: { entry_name: string; manager_name: string } | null;
  live_team_1_points?: number;
  live_team_2_points?: number;
  live_highlights?: Array<{
    player_id: number;
    player_name: string;
    player_image_url?: string | null;
    action: string;
    points: number;
    fixture_score: string;
  }>;
}

interface MatchupsResponse {
  gameweek: number;
  matchups: MatchupRow[];
}

type FormResult = "W" | "D" | "L";

interface RecordRow {
  wins: number;
  draws: number;
  losses: number;
}

interface H2HStandingsResponse {
  gameweek: number;
  matchups: Array<{
    team_1_id: string;
    team_2_id: string;
    current_season_record_1: RecordRow;
    current_season_record_2: RecordRow;
    all_time_record_1: RecordRow;
    all_time_record_2: RecordRow;
  }>;
}

const POLL_INTERVAL_MS = 10000;

const avatarFallback = (name: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "Player")}&background=1f2937&color=ffffff&size=128&bold=true`;
const sanitizeImageUrl = (url?: string | null) => String(url || "").replace(/^http:\/\//i, "https://").trim();

export function ThisWeekMatchups() {
  const [data, setData] = useState<MatchupsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const { getCrest } = useManagerCrestMap();

  const loadMatchups = useCallback(async (silent = false) => {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const [matchupsRes, rivalriesRes] = await Promise.all([
        fetch(`${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/h2h-matchups`, { headers: getSupabaseFunctionHeaders() }),
        fetch(`${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/h2h-rivalries`, { headers: getSupabaseFunctionHeaders() }),
      ]);
      const payload: MatchupsResponse = await matchupsRes.json();
      const rivalryPayload: H2HStandingsResponse = await rivalriesRes.json();

      if (!matchupsRes.ok || (payload as any)?.error) {
        throw new Error((payload as any)?.error?.message || "Failed to fetch matchups");
      }
      if (!rivalriesRes.ok || (rivalryPayload as any)?.error) {
        throw new Error((rivalryPayload as any)?.error?.message || "Failed to fetch rivalry data");
      }

      const startsByPlayerId: Record<number, number> = {};
      try {
        const liveUrl = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/api/live?event=${payload.gameweek}`;
        const liveRes = await fetch(liveUrl, { headers: getSupabaseFunctionHeaders() });
        if (liveRes.ok) {
          const livePayload: LiveDataResponse = await liveRes.json();
          (livePayload.elements || []).forEach((el) => {
            startsByPlayerId[el.element] = Number(el.stats?.starts || 0);
          });
        }
      } catch {
        // Non-blocking
      }

      const detailPayloads = await Promise.all(
        (payload.matchups || []).map(async (m) => {
          const params = new URLSearchParams({
            type: "league",
            gameweek: String(m.gameweek || payload.gameweek),
            team1: String(m.team_1_id),
            team2: String(m.team_2_id),
          });
          const detailUrl = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/fixtures/matchup?${params.toString()}`;
          const detailRes = await fetch(detailUrl, { headers: getSupabaseFunctionHeaders() });
          if (!detailRes.ok) return null;
          const detail = await detailRes.json();
          if (detail?.error) return null;
          const team1LeagueLive = (detail?.team_1?.lineup || []).reduce(
            (sum: number, player: any) => sum + (player?.is_bench ? 0 : Number(player?.effective_points || 0)),
            0,
          );
          const team2LeagueLive = (detail?.team_2?.lineup || []).reduce(
            (sum: number, player: any) => sum + (player?.is_bench ? 0 : Number(player?.effective_points || 0)),
            0,
          );
          const detailForHighlights = {
            ...detail,
            matchup: {
              ...(detail?.matchup || {}),
              live_team_1_points: team1LeagueLive,
              live_team_2_points: team2LeagueLive,
            },
          };
          return {
            key: `${m.team_1_id}__${m.team_2_id}`,
            live_team_1_points: team1LeagueLive,
            live_team_2_points: team2LeagueLive,
            live_highlights: summarizeMatchupHighlights(detailForHighlights, startsByPlayerId, 8),
          };
        }),
      );

      const detailMap: Record<string, (typeof detailPayloads)[number]> = {};
      detailPayloads.filter(Boolean).forEach((row) => {
        if (!row) return;
        detailMap[String(row.key)] = row;
      });

      const rivalryMap: Record<string, any> = {};
      (rivalryPayload.matchups || []).forEach((m) => {
        rivalryMap[`${m.team_1_id}__${m.team_2_id}`] = m;
        rivalryMap[`${m.team_2_id}__${m.team_1_id}`] = {
          ...m,
          current_season_record_1: m.current_season_record_2,
          current_season_record_2: m.current_season_record_1,
          all_time_record_1: m.all_time_record_2,
          all_time_record_2: m.all_time_record_1,
        };
      });

      const merged: MatchupsResponse = {
        ...payload,
        matchups: (payload.matchups || []).map((m) => {
          const detail = detailMap[`${m.team_1_id}__${m.team_2_id}`];
          return {
            ...m,
            live_team_1_points: detail?.live_team_1_points,
            live_team_2_points: detail?.live_team_2_points,
            live_highlights: detail?.live_highlights || [],
            rivalry: rivalryMap[`${m.team_1_id}__${m.team_2_id}`] || null,
          };
        }),
      } as any;

      setData(merged);
      setLastUpdated(Date.now());
    } catch (err: any) {
      setError(err.message || "Failed to load matchups");
    } finally {
      if (silent) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const run = async (silent = false) => {
      if (!mounted) return;
      await loadMatchups(silent);
    };

    run(false);
    const timer = window.setInterval(() => run(true), POLL_INTERVAL_MS);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [loadMatchups]);

  if (loading) {
    return (
      <Card className="p-6">
        <h1 className="mb-4 text-xl font-semibold">This Week's Matchups</h1>
        <p className="text-sm text-muted-foreground">Loading matchups…</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <h1 className="mb-4 text-xl font-semibold">This Week's Matchups</h1>
        <p className="text-sm text-destructive">{error}</p>
      </Card>
    );
  }

  if (!data || data.matchups.length === 0) {
    return (
      <Card className="p-6">
        <h1 className="mb-4 text-xl font-semibold">This Week's Matchups</h1>
        <p className="text-sm text-muted-foreground">No matchups available yet.</p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">This Week's Matchups</h2>
          <p className="text-sm text-muted-foreground">Gameweek {data.gameweek}</p>
        </div>
        <div className="text-right">
          {refreshing ? <p className="text-xs text-muted-foreground">Updating...</p> : null}
          {lastUpdated ? <p className="text-[11px] text-muted-foreground">{new Date(lastUpdated).toLocaleTimeString()}</p> : null}
        </div>
      </div>
      <div className="space-y-3">
        {data.matchups.map((m, idx) => {
          const href = `/matchup/league/${m.gameweek || data.gameweek}/${m.team_1_id}/${m.team_2_id}`;
          const rivalry = (m as any).rivalry;
          const team1Form = ((rivalry?.recent_form_1 || []) as FormResult[]).slice(-5);
          const team2Form = ((rivalry?.recent_form_2 || []) as FormResult[]).slice(-5);
          const season1Wins = rivalry?.current_season_record_1?.wins ?? "—";
          const seasonDraws = rivalry?.current_season_record_1?.draws ?? "—";
          const season2Wins = rivalry?.current_season_record_2?.wins ?? "—";
          const allTime1Wins = rivalry?.all_time_record_1?.wins ?? "—";
          const allTimeDraws = rivalry?.all_time_record_1?.draws ?? "—";
          const allTime2Wins = rivalry?.all_time_record_2?.wins ?? "—";
          const score1 = Math.round(Number(m.live_team_1_points ?? m.team_1_points ?? 0));
          const score2 = Math.round(Number(m.live_team_2_points ?? m.team_2_points ?? 0));
          const highlights = m.live_highlights || [];

          return (
            <HoverCard key={`${m.team_1_id}-${m.team_2_id}-${idx}`} openDelay={120} closeDelay={100}>
              <HoverCardTrigger asChild>
                <Link
                  to={href}
                  className="block w-full rounded-md border bg-background/80 p-4 text-foreground no-underline transition-colors hover:bg-background hover:no-underline visited:text-foreground"
                >
                  <div className="mb-3 grid grid-cols-[1fr_auto_1fr] gap-4">
                    <div className="text-center">
                      <div className="mb-1 inline-flex items-center justify-center gap-1 text-sm font-semibold">
                        {getCrest(m.team_1?.manager_name) ? (
                          <img
                            src={getCrest(m.team_1?.manager_name)!}
                            alt=""
                            className="h-4 w-4 rounded object-cover border"
                          />
                        ) : null}
                        <span>{m.team_1?.entry_name || "—"}</span>
                        {m.team_1_rank != null ? <span className="text-[10px] text-muted-foreground">#{m.team_1_rank}</span> : null}
                      </div>
                      <div className="text-xs text-muted-foreground">{m.team_1?.manager_name || "—"}</div>
                      <div className="mt-1 flex items-center justify-center gap-1">
                        {team1Form.map((result, formIdx) => (
                          <span
                            key={`${m.team_1_id}-${formIdx}-${result}`}
                            className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white ${
                              result === "W" ? "bg-emerald-500" : result === "D" ? "bg-zinc-400" : "bg-rose-500"
                            }`}
                            title={result === "W" ? "Win" : result === "D" ? "Draw" : "Loss"}
                          >
                            {result}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-center">
                      <div className="w-20 text-center">
                        <div className="text-3xl font-bold leading-none">
                          <span>{score1}</span>
                          <span className="mx-1">-</span>
                          <span>{score2}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="mb-1 inline-flex items-center justify-center gap-1 text-sm font-semibold">
                        {getCrest(m.team_2?.manager_name) ? (
                          <img
                            src={getCrest(m.team_2?.manager_name)!}
                            alt=""
                            className="h-4 w-4 rounded object-cover border"
                          />
                        ) : null}
                        <span>{m.team_2?.entry_name || "—"}</span>
                        {m.team_2_rank != null ? <span className="text-[10px] text-muted-foreground">#{m.team_2_rank}</span> : null}
                      </div>
                      <div className="text-xs text-muted-foreground">{m.team_2?.manager_name || "—"}</div>
                      <div className="mt-1 flex items-center justify-center gap-1">
                        {team2Form.map((result, formIdx) => (
                          <span
                            key={`${m.team_2_id}-${formIdx}-${result}`}
                            className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white ${
                              result === "W" ? "bg-emerald-500" : result === "D" ? "bg-zinc-400" : "bg-rose-500"
                            }`}
                            title={result === "W" ? "Win" : result === "D" ? "Draw" : "Loss"}
                          >
                            {result}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 rounded-md border bg-background/70 p-2 text-xs">
                    <div className="space-y-1">
                      <div className="font-medium text-muted-foreground">Season</div>
                      <div className="grid grid-cols-[1fr_5rem_1fr] items-center gap-2">
                        <div className="text-center font-medium">{season1Wins}W</div>
                        <div className="text-center text-muted-foreground">{seasonDraws}D</div>
                        <div className="text-center font-medium">{season2Wins}W</div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="font-medium text-muted-foreground">All-Time</div>
                      <div className="grid grid-cols-[1fr_5rem_1fr] items-center gap-2">
                        <div className="text-center font-medium">{allTime1Wins}W</div>
                        <div className="text-center text-muted-foreground">{allTimeDraws}D</div>
                        <div className="text-center font-medium">{allTime2Wins}W</div>
                      </div>
                    </div>
                  </div>
                </Link>
              </HoverCardTrigger>

              <HoverCardContent className="w-[360px] max-w-[calc(100vw-1rem)] p-3" align="center" side="top">
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Matchup Player Highlights</p>
                  {highlights.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No highlight stats yet for this matchup.</p>
                  ) : (
                    <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                      {highlights.map((row) => (
                        <div key={`${row.player_id}-${row.action}`} className="grid grid-cols-[2.25rem_1fr_auto] items-center gap-2 rounded-md border p-2">
                          <img
                            src={sanitizeImageUrl(row.player_image_url) || avatarFallback(row.player_name)}
                            alt={row.player_name}
                            className="h-8 w-8 rounded-full border object-cover"
                            onError={(event) => {
                              (event.currentTarget as HTMLImageElement).src = avatarFallback(row.player_name);
                            }}
                          />
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium">{row.player_name}</p>
                            <p className="truncate text-[11px] text-muted-foreground">{row.action}</p>
                          </div>
                          <div className="text-right text-[11px]">
                            <p className="font-semibold">{row.points} pts</p>
                            <p className="text-muted-foreground">{row.fixture_score}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground">Hover preview is limited to players owned in this matchup.</p>
                </div>
              </HoverCardContent>
            </HoverCard>
          );
        })}
      </div>
    </Card>
  );
}
