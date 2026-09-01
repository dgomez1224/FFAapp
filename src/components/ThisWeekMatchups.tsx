/**
 * This Week's Matchups - Public Read-Only
 *
 * Unified H2H matchup container: division filters, live scores, win probability,
 * projected points, player breakdown, past H2H, highlights, and matchup links.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getSupabaseFunctionHeaders, supabaseUrl } from "../lib/supabaseClient";
import { EDGE_FUNCTIONS_BASE } from "../lib/constants";
import { ChevronDown } from "lucide-react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { cn } from "./ui/utils";
import { useManagerCrestMap } from "../lib/useManagerCrestMap";
import type { LiveDataResponse } from "../lib/types/api";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./ui/hover-card";
import {
  getPlayerInitialsAbbrev,
  getProxiedImageUrl,
  handlePlayerImageErrorWithWikipediaFallback,
} from "../lib/playerImage";
import { summarizeMatchupHighlights } from "./LivePlayerUpdates";
import { getDivisionLabel, getManagerDivision, type Division } from "../lib/divisions";
import {
  breakdownProjected,
  computeMatchupOdds,
  nextOddsModel,
  oddsModelMeta,
  type OddsModelId,
  type PlayerOddsInput,
  type WinProbs,
} from "../lib/matchupOdds";
import { DashboardCarousel } from "./carousels/DashboardCarousel";

type ViewMode = "all" | Division;

type LineupPlayerLite = {
  player_id: number;
  player_name: string;
  web_name?: string | null;
  player_image_url?: string | null;
  is_bench?: boolean;
  is_auto_subbed_off?: boolean;
  is_captain?: boolean;
  effective_points: number;
  minutes: number;
  fixture_elapsed?: number;
  fixture_started?: boolean;
  fixture_finished?: boolean;
  ep_this?: number;
  lineup_slot?: number | null;
};

type BreakdownPlayer = {
  player_id: number;
  name: string;
  points: number;
  projected: number;
  remaining: number;
  status: "done" | "live" | "upcoming";
  is_captain: boolean;
};

interface MatchupRow {
  fixture_id?: string;
  team_1_id: string;
  team_2_id: string;
  team_1_entry_id?: string | null;
  team_2_entry_id?: string | null;
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
  projected_team_1_points?: number;
  projected_team_2_points?: number;
  win_probability?: WinProbs;
  breakdown_1?: BreakdownPlayer[];
  breakdown_2?: BreakdownPlayer[];
  odds_players_1?: PlayerOddsInput[];
  odds_players_2?: PlayerOddsInput[];
  live_highlights?: Array<{
    player_id: number;
    player_name: string;
    player_image_url?: string | null;
    action: string;
    points: number;
    fixture_score: string;
  }>;
  rivalry?: {
    recent_form_1?: FormResult[];
    recent_form_2?: FormResult[];
    current_season_record_1?: RecordRow;
    current_season_record_2?: RecordRow;
    all_time_record_1?: RecordRow;
    all_time_record_2?: RecordRow;
  } | null;
}

interface MatchupsResponse {
  gameweek: number;
  matchups: MatchupRow[];
  division?: string;
}

type DivisionMatchups = {
  division: Division;
  gameweek: number;
  matchups: MatchupRow[];
};

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
    recent_form_1?: FormResult[];
    recent_form_2?: FormResult[];
  }>;
}

const POLL_INTERVAL_MS = 10000;

const VIEW_OPTIONS: Array<{ id: ViewMode; label: string }> = [
  { id: "all", label: "All league" },
  { id: "division_one", label: "Division 1" },
  { id: "division_two", label: "Division 2" },
];

const sanitizeImageUrl = (url?: string | null) => String(url || "").replace(/^http:\/\//i, "https://").trim();

function normalizeElementList(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    const nested = (value as { data?: unknown }).data;
    if (Array.isArray(nested)) return nested;
    return Object.values(value as Record<string, any>);
  }
  return [];
}

function contributingPlayers(lineup: LineupPlayerLite[] | undefined): LineupPlayerLite[] {
  return (lineup || []).filter((player) => !player?.is_bench && !player?.is_auto_subbed_off);
}

function playerStatus(player: LineupPlayerLite): BreakdownPlayer["status"] {
  if (player.fixture_finished || Number(player.fixture_elapsed ?? 0) >= 90) return "done";
  if (player.fixture_started || Number(player.minutes ?? 0) > 0 || Number(player.fixture_elapsed ?? 0) > 0) {
    return "live";
  }
  return "upcoming";
}

function remainingProjected(player: LineupPlayerLite, epThisById: Record<number, number>): number {
  const status = playerStatus(player);
  if (status === "done") return 0;
  const ep = Number(player.ep_this ?? epThisById[player.player_id] ?? 0);
  if (status === "upcoming") return Math.max(0, ep);
  const elapsed = Math.min(90, Math.max(Number(player.fixture_elapsed ?? 0), Number(player.minutes ?? 0)));
  return Math.max(0, ep * ((90 - elapsed) / 90));
}

function remainingFrac(player: LineupPlayerLite): number {
  const status = playerStatus(player);
  if (status === "done") return 0;
  if (status === "upcoming") return 1;
  const elapsed = Math.min(90, Math.max(Number(player.fixture_elapsed ?? 0), Number(player.minutes ?? 0)));
  return Math.max(0, (90 - elapsed) / 90);
}

function buildOddsPlayers(lineup: LineupPlayerLite[] | undefined, epThisById: Record<number, number>): PlayerOddsInput[] {
  return contributingPlayers(lineup)
    .slice()
    .sort((a, b) => (a.lineup_slot ?? 99) - (b.lineup_slot ?? 99))
    .map((player) => {
      const points = Number(player.effective_points || 0);
      const remaining = remainingProjected(player, epThisById);
      const shortName = String(player.web_name || player.player_name || "").trim();
      return {
        player_id: player.player_id,
        name: shortName || `Player ${player.player_id}`,
        points,
        remaining,
        frac: remainingFrac(player),
        status: playerStatus(player),
        is_captain: !!player.is_captain,
      };
    });
}

function toBreakdown(players: PlayerOddsInput[], model: OddsModelId): BreakdownPlayer[] {
  return players.map((player) => ({
    player_id: player.player_id,
    name: player.name,
    points: player.points,
    remaining: player.remaining,
    projected: breakdownProjected(player, model),
    status: player.status,
    is_captain: player.is_captain,
  }));
}

function dedupeMatchupsByPair<T extends { team_1_id: string; team_2_id: string }>(rows: T[]): T[] {
  const byKey = new Map<string, T>();
  rows.forEach((row) => {
    const key = [String(row.team_1_id), String(row.team_2_id)].sort().join("::");
    byKey.set(key, row);
  });
  return Array.from(byKey.values());
}

export function ThisWeekMatchups({ layout = "full" }: { layout?: "full" | "carousel" }) {
  const [divisionsData, setDivisionsData] = useState<DivisionMatchups[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [oddsModel, setOddsModel] = useState<OddsModelId>("heuristic");
  const [openBreakdowns, setOpenBreakdowns] = useState<Record<string, boolean>>({});
  const [gameweek, setGameweek] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { getCrest } = useManagerCrestMap();

  const loadMatchups = useCallback(async (silent = false): Promise<boolean> => {
    let gamesLive = false;
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const divisions: Division[] = ["division_one", "division_two"];
      const [divisionResults, epThisById] = await Promise.all([
        Promise.all(
          divisions.map(async (division) => {
            const params = new URLSearchParams({ division });
            const [matchupsRes, rivalriesRes] = await Promise.all([
              fetch(`${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/h2h-matchups?${params}`, {
                headers: getSupabaseFunctionHeaders(),
              }),
              fetch(`${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/h2h-rivalries?${params}`, {
                headers: getSupabaseFunctionHeaders(),
              }),
            ]);
            const payload: MatchupsResponse = await matchupsRes.json();
            const rivalryPayload: H2HStandingsResponse = await rivalriesRes.json();

            if (!matchupsRes.ok || (payload as any)?.error) {
              return {
                division,
                payload: { gameweek: 0, matchups: [] } as MatchupsResponse,
                rivalryPayload: { gameweek: 0, matchups: [] } as H2HStandingsResponse,
              };
            }
            if (!rivalriesRes.ok || (rivalryPayload as any)?.error) {
              return {
                division,
                payload,
                rivalryPayload: { gameweek: 0, matchups: [] } as H2HStandingsResponse,
              };
            }

            return { division, payload, rivalryPayload };
          }),
        ),
        (async () => {
          const map: Record<number, number> = {};
          try {
            const bootRes = await fetch(`${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/bootstrap-static`, {
              headers: getSupabaseFunctionHeaders(),
            });
            if (bootRes.ok) {
              const boot = await bootRes.json();
              normalizeElementList(boot?.elements?.data ?? boot?.elements ?? boot?.players).forEach((el: any) => {
                const id = Number(el?.id ?? el?.element ?? el?.element_id);
                const ep = Number.parseFloat(String(el?.ep_this ?? el?.ep_next ?? ""));
                if (id && Number.isFinite(ep)) map[id] = ep;
              });
            }
          } catch {
            // Non-blocking; lineup ep_this is the primary source after deploy.
          }
          return map;
        })(),
      ]);

      const gw = divisionResults[0]?.payload.gameweek ?? 1;
      setGameweek(gw);

      const startsByPlayerId: Record<number, number> = {};
      try {
        const liveUrl = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/api/live?event=${gw}`;
        const liveRes = await fetch(liveUrl, { headers: getSupabaseFunctionHeaders() });
        if (liveRes.ok) {
          const livePayload: LiveDataResponse = await liveRes.json();
          const elementsObj = livePayload?.elements ?? {};
          Object.entries(elementsObj as any).forEach(([key, el]: [string, any]) => {
            const id = Number(key);
            if (!id) return;
            startsByPlayerId[id] = Number(el?.stats?.starts ?? 0);
          });
          const fixtures = (livePayload?.fixtures ?? []) as any[];
          gamesLive = fixtures.some((f: any) => f.started && !f.finished);
        }
      } catch {
        // Non-blocking
      }

      const mergedDivisions: DivisionMatchups[] = await Promise.all(
        divisionResults.map(async ({ division, payload, rivalryPayload }) => {
          const detailPayloads = await Promise.all(
            dedupeMatchupsByPair(payload.matchups || []).map(async (m) => {
              const params = new URLSearchParams({
                type: "league",
                gameweek: String(m.gameweek || payload.gameweek),
                team1: String(m.team_1_entry_id || m.team_1_id),
                team2: String(m.team_2_entry_id || m.team_2_id),
              });
              const detailUrl = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/fixtures/matchup?${params.toString()}`;
              const detailRes = await fetch(detailUrl, { headers: getSupabaseFunctionHeaders() });
              if (!detailRes.ok) return null;
              const detail = await detailRes.json();
              if (detail?.error) return null;
              const lineup1 = (detail?.team_1?.lineup || []) as LineupPlayerLite[];
              const lineup2 = (detail?.team_2?.lineup || []) as LineupPlayerLite[];
              const team1LeagueLive = contributingPlayers(lineup1).reduce(
                (sum, player) => sum + Number(player?.effective_points || 0),
                0,
              );
              const team2LeagueLive = contributingPlayers(lineup2).reduce(
                (sum, player) => sum + Number(player?.effective_points || 0),
                0,
              );
              const odds_players_1 = buildOddsPlayers(lineup1, epThisById);
              const odds_players_2 = buildOddsPlayers(lineup2, epThisById);
              const baseline = computeMatchupOdds(odds_players_1, odds_players_2, "heuristic");
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
                projected_team_1_points: baseline.proj1,
                projected_team_2_points: baseline.proj2,
                win_probability: baseline.probs,
                odds_players_1,
                odds_players_2,
                breakdown_1: toBreakdown(odds_players_1, "heuristic"),
                breakdown_2: toBreakdown(odds_players_2, "heuristic"),
                live_highlights: summarizeMatchupHighlights(detailForHighlights, startsByPlayerId, 8),
              };
            }),
          );

          const detailMap: Record<string, (typeof detailPayloads)[number]> = {};
          detailPayloads.filter(Boolean).forEach((row) => {
            if (!row) return;
            detailMap[String(row.key)] = row;
          });

          const rivalryMap: Record<string, NonNullable<MatchupRow["rivalry"]>> = {};
          (rivalryPayload.matchups || []).forEach((m) => {
            rivalryMap[`${m.team_1_id}__${m.team_2_id}`] = m;
            rivalryMap[`${m.team_2_id}__${m.team_1_id}`] = {
              ...m,
              current_season_record_1: m.current_season_record_2,
              current_season_record_2: m.current_season_record_1,
              all_time_record_1: m.all_time_record_2,
              all_time_record_2: m.all_time_record_1,
              recent_form_1: m.recent_form_2,
              recent_form_2: m.recent_form_1,
            };
          });

          const matchups = dedupeMatchupsByPair(payload.matchups || []).map((m) => {
            const detail = detailMap[`${m.team_1_id}__${m.team_2_id}`];
            const live1 = detail?.live_team_1_points;
            const live2 = detail?.live_team_2_points;
            const proj1 = detail?.projected_team_1_points ?? live1 ?? Number(m.team_1_points || 0);
            const proj2 = detail?.projected_team_2_points ?? live2 ?? Number(m.team_2_points || 0);
            return {
              ...m,
              live_team_1_points: live1,
              live_team_2_points: live2,
              projected_team_1_points: proj1,
              projected_team_2_points: proj2,
              win_probability: detail?.win_probability,
              odds_players_1: detail?.odds_players_1 || [],
              odds_players_2: detail?.odds_players_2 || [],
              breakdown_1: detail?.breakdown_1 || [],
              breakdown_2: detail?.breakdown_2 || [],
              live_highlights: detail?.live_highlights || [],
              rivalry: rivalryMap[`${m.team_1_id}__${m.team_2_id}`] || null,
            };
          });

          return {
            division,
            gameweek: payload.gameweek,
            matchups: matchups.filter((row) => {
              const homeDiv = getManagerDivision(row.team_1?.manager_name || "");
              const awayDiv = getManagerDivision(row.team_2?.manager_name || "");
              if (homeDiv && awayDiv) return homeDiv === division && awayDiv === division;
              if (homeDiv) return homeDiv === division;
              if (awayDiv) return awayDiv === division;
              return false;
            }),
          };
        }),
      );

      setDivisionsData(mergedDivisions);
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
    return gamesLive;
  }, []);

  useEffect(() => {
    let mounted = true;

    const run = async (silent = false): Promise<boolean> => {
      if (!mounted) return false;
      return loadMatchups(silent);
    };

    let timer: ReturnType<typeof setInterval> | null = null;

    run(false).then((gamesLive) => {
      if (gamesLive && mounted) {
        timer = window.setInterval(() => run(true), POLL_INTERVAL_MS);
        pollingIntervalRef.current = timer;
      }
    });

    return () => {
      mounted = false;
      if (timer) {
        window.clearInterval(timer);
      }
    };
  }, [loadMatchups]);

  const visibleBlocks = useMemo(() => {
    if (viewMode === "all") return divisionsData.filter((block) => block.matchups.length > 0);
    return divisionsData.filter((block) => block.division === viewMode);
  }, [divisionsData, viewMode]);

  const renderBreakdownColumn = (rows: BreakdownPlayer[]) => (
    <div className="space-y-1">
      {rows.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">No lineup yet.</p>
      ) : (
        rows.map((player) => (
          <div key={player.player_id} className="flex items-center justify-between gap-1 text-[11px] leading-tight">
            <span className="min-w-0 truncate">
              {player.name}
              {player.is_captain ? " (C)" : ""}
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {player.status === "upcoming" || oddsModel === "gaussian-excl"
                ? `${player.projected.toFixed(1)} exp`
                : `${Math.round(player.points)} pts`}
              {player.status === "live" ? " · live" : ""}
            </span>
          </div>
        ))
      )}
    </div>
  );

  const renderMatchup = (m: MatchupRow, dataGw: number, idx: number) => {
    const href = `/matchup/league/${m.gameweek || dataGw}/${m.team_1_entry_id || m.team_1_id}/${m.team_2_entry_id || m.team_2_id}`;
    const rivalry = m.rivalry;
    const team1Form = (rivalry?.recent_form_1 || []).slice(-5);
    const team2Form = (rivalry?.recent_form_2 || []).slice(-5);
    const season1Wins = rivalry?.current_season_record_1?.wins ?? "—";
    const seasonDraws = rivalry?.current_season_record_1?.draws ?? "—";
    const season2Wins = rivalry?.current_season_record_2?.wins ?? "—";
    const allTime1Wins = rivalry?.all_time_record_1?.wins ?? "—";
    const allTimeDraws = rivalry?.all_time_record_1?.draws ?? "—";
    const allTime2Wins = rivalry?.all_time_record_2?.wins ?? "—";
    const score1 = Math.round(Number(m.live_team_1_points ?? m.team_1_points ?? 0));
    const score2 = Math.round(Number(m.live_team_2_points ?? m.team_2_points ?? 0));
    const computed = computeMatchupOdds(m.odds_players_1 || [], m.odds_players_2 || [], oddsModel);
    const proj1 = computed.proj1;
    const proj2 = computed.proj2;
    const probs: WinProbs = computed.probs;
    const highlights = m.live_highlights || [];
    const breakdown1 = toBreakdown(m.odds_players_1 || [], oddsModel);
    const breakdown2 = toBreakdown(m.odds_players_2 || [], oddsModel);
    const matchupKey = `${m.team_1_id}-${m.team_2_id}`;
    const breakdownOpen = !!openBreakdowns[matchupKey];

    return (
      <div key={`${m.team_1_id}-${m.team_2_id}-${idx}`} className="rounded-md border bg-background/80">
      <HoverCard openDelay={120} closeDelay={100}>
        <HoverCardTrigger asChild>
          <Link
            to={href}
            className="block w-full p-4 pb-2 text-foreground no-underline transition-colors hover:bg-background hover:no-underline visited:text-foreground"
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
                  {m.team_1_rank != null ? (
                    <span className="text-[10px] text-muted-foreground">#{m.team_1_rank}</span>
                  ) : null}
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
                  {m.team_2_rank != null ? (
                    <span className="text-[10px] text-muted-foreground">#{m.team_2_rank}</span>
                  ) : null}
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

            <div className="mb-3 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                <span>Win probability</span>
                <span>
                  {computed.twoWay
                    ? `${probs.team1}% · ${probs.team2}%`
                    : `${probs.team1}% · ${probs.draw}% draw · ${probs.team2}%`}
                </span>
              </div>
              <div className="flex h-6 overflow-hidden rounded-full bg-muted">
                {probs.team1 > 0 ? (
                  <div
                    className="flex items-center justify-center bg-emerald-500 px-0.5 text-[10px] font-bold leading-none text-white tabular-nums"
                    style={{ width: `${probs.team1}%` }}
                    title={`${m.team_1?.entry_name || "Home"} ${probs.team1}%`}
                  >
                    {probs.team1}%
                  </div>
                ) : null}
                {!computed.twoWay && probs.draw > 0 ? (
                  <div
                    className="flex items-center justify-center bg-zinc-400 px-0.5 text-[10px] font-bold leading-none text-white tabular-nums"
                    style={{ width: `${probs.draw}%` }}
                    title={`Draw ${probs.draw}%`}
                  >
                    {probs.draw}%
                  </div>
                ) : null}
                {probs.team2 > 0 ? (
                  <div
                    className="flex items-center justify-center bg-sky-500 px-0.5 text-[10px] font-bold leading-none text-white tabular-nums"
                    style={{ width: `${probs.team2}%` }}
                    title={`${m.team_2?.entry_name || "Away"} ${probs.team2}%`}
                  >
                    {probs.team2}%
                  </div>
                ) : null}
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs">
                <div className="text-center font-medium tabular-nums">{proj1.toFixed(1)}</div>
                <div className="text-[11px] text-muted-foreground">
                  {oddsModel === "gaussian-excl" ? "Remaining exp." : "Projected pts"}
                </div>
                <div className="text-center font-medium tabular-nums">{proj2.toFixed(1)}</div>
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
                    <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border bg-muted">
                      {row.player_image_url ? (
                        <img
                          src={getProxiedImageUrl(sanitizeImageUrl(row.player_image_url)) ?? undefined}
                          alt={row.player_name}
                          className="h-full w-full object-cover"
                          onError={(e) =>
                            handlePlayerImageErrorWithWikipediaFallback(e, row.player_name, {
                              fallbackClassName:
                                "absolute inset-0 flex items-center justify-center rounded-full bg-muted text-[9px] font-bold text-muted-foreground",
                            })
                          }
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-[9px] font-bold text-muted-foreground">
                          {getPlayerInitialsAbbrev(row.player_name)}
                        </span>
                      )}
                    </div>
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
      <div className="px-4 pb-4">
        <Collapsible
          open={breakdownOpen}
          onOpenChange={(open) =>
            setOpenBreakdowns((current) => ({
              ...current,
              [matchupKey]: open,
            }))
          }
        >
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-md border bg-background/70 px-2 py-1.5 text-left text-[11px] font-medium text-muted-foreground hover:bg-background"
            >
              <span>Player Breakdown</span>
              <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", breakdownOpen && "rotate-180")} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 grid grid-cols-2 gap-3 rounded-md border bg-background/70 p-2">
              {renderBreakdownColumn(breakdown1)}
              {renderBreakdownColumn(breakdown2)}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
      </div>
    );
  };

  const header = (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-lg font-semibold">
          {layout === "carousel" ? "This Week's Fixtures" : "This Week's Matchups"}
        </h2>
        <p className="text-sm text-muted-foreground">
          Gameweek {gameweek ?? "—"} · {oddsModelMeta(oddsModel).short}
        </p>
      </div>
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <div className="flex flex-wrap items-center gap-1">
          {VIEW_OPTIONS.map((option) => (
            <Button
              key={option.id}
              type="button"
              size="sm"
              variant={viewMode === option.id ? "default" : "outline"}
              onClick={() => setViewMode(option.id)}
            >
              {option.label}
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            aria-label="Toggle win-probability model"
            onClick={() => setOddsModel((current) => nextOddsModel(current))}
          >
            {oddsModelMeta(oddsModel).label}
          </Button>
        </div>
        <div className="text-right">
          {refreshing ? <p className="text-xs text-muted-foreground">Updating...</p> : null}
          {lastUpdated ? (
            <p className="text-[11px] text-muted-foreground">{new Date(lastUpdated).toLocaleTimeString()}</p>
          ) : null}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <Card className="p-6">
        {header}
        <p className="text-sm text-muted-foreground">Loading matchups…</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        {header}
        <p className="text-sm text-destructive">{error}</p>
      </Card>
    );
  }

  const hasVisibleMatchups = visibleBlocks.some((block) => block.matchups.length > 0);
  const emptyMessage = (
    <p className="text-sm text-muted-foreground">
      {viewMode === "all" ? "No matchups available yet." : `No matchups available for ${getDivisionLabel(viewMode)}.`}
    </p>
  );

  if (layout === "carousel") {
    return (
      <DashboardCarousel header={header} empty={emptyMessage}>
        {visibleBlocks.flatMap((block) =>
          block.matchups.map((m, idx) => (
            <div key={`${block.division}-${m.team_1_id}-${m.team_2_id}-${idx}`} className="h-full">
              {viewMode === "all" ? (
                <p className="mb-2 text-xs font-semibold text-muted-foreground">{getDivisionLabel(block.division)}</p>
              ) : null}
              {renderMatchup(m, block.gameweek, idx)}
            </div>
          )),
        )}
      </DashboardCarousel>
    );
  }

  return (
    <Card className="p-4">
      {header}
      {!hasVisibleMatchups ? (
        emptyMessage
      ) : (
        <div className="space-y-8">
          {visibleBlocks.map((block) => (
            <div key={block.division}>
              {viewMode === "all" ? (
                <h3 className="mb-3 text-base font-semibold">{getDivisionLabel(block.division)}</h3>
              ) : null}
              <div className="space-y-3">
                {block.matchups.map((m, idx) => renderMatchup(m, block.gameweek, idx))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
