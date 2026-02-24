// supabase/functions/server/index.ts
// Public Read-Only FPL League Application - Edge Functions
//
// This file provides all public, read-only endpoints for the FPL league application.
// All endpoints use the static entry ID (164475) to resolve league context.
// No authentication is required for any of these endpoints.

export const config = {
  verify_jwt: false,
};

import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

// --------------------
// Constants
// --------------------

const FPL_BASE_URL = "https://fantasy.premierleague.com/api";
const DRAFT_BASE_URL = "https://draft.premierleague.com/api";
const STATIC_ENTRY_ID = "164475"; // Single source of truth for league context
const CURRENT_SEASON = "2025/26";
const CUP_START_GAMEWEEK = 29;
const CAPTAIN_SESSION_TTL_HOURS = 24 * 30;
const LEAGUE_VALUE = 810;
const CUP_VALUE = 540;
const GOBLET_VALUE = 270;
const DOUBLE_MULTIPLIER = 1.25;
const TREBLE_MULTIPLIER = 1.4;
const PLACEMENT_POINTS: Record<number, number> = {
  1: 0,
  2: 240,
  3: 120,
  4: 60,
  5: 30,
  6: 0,
  7: -10,
  8: -30,
  9: -60,
  10: -90,
};
const PPG_MAX = 3;
const PPG_K = 1.4;
const PPG_LAMBDA = 0.3;
const PPG_SCALE = 1000;
const ALPHA = 0.1;
const VALID_MANAGERS = [
  "PATRICK", "MATT", "MARCO", "LENNART", "CHRIS",
  "IAN", "HENRI", "DAVID", "MAX", "BENJI",
] as const;
const VALID_MANAGER_SET = new Set<string>(VALID_MANAGERS);
const MANAGER_CANONICAL_ALIASES: Record<string, string> = {
  MATTHEW: "MATT",
};

// --------------------
// Supabase Admin Client
// --------------------

const getSupabaseAdmin = () =>
  createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

// --------------------
// Helpers
// --------------------

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Fetch failed: ${url} - ${res.status} ${res.statusText}`);
  }
  return res.json();
}

function normalizeDraftList<T = any>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, T>);
  }
  return [];
}

function extractDraftEvents(bootstrap: any): any[] {
  const events = bootstrap?.events;
  if (Array.isArray(events)) return events;
  if (events && typeof events === "object" && Array.isArray(events.data)) {
    return events.data;
  }
  return normalizeDraftList<any>(events).filter((e: any) => e && typeof e === "object" && Number.isInteger(e.id));
}

function parsePositiveInt(value: unknown): number | null {
  const parsed =
    typeof value === "string" ? Number.parseInt(value, 10) :
    typeof value === "number" ? value :
    null;
  return Number.isInteger(parsed) && (parsed as number) > 0 ? (parsed as number) : null;
}

function extractDraftCurrentEventId(bootstrap: any): number | null {
  const events = bootstrap?.events;
  const fromObject = parsePositiveInt(events?.current);
  if (fromObject) return fromObject;
  const list = extractDraftEvents(bootstrap);
  const fromListCurrent = parsePositiveInt(list.find((e: any) => e?.is_current)?.id);
  if (fromListCurrent) return fromListCurrent;
  const fromListNext = parsePositiveInt(list.find((e: any) => e?.is_next)?.id);
  if (fromListNext) return fromListNext;
  return parsePositiveInt(list[0]?.id);
}

function extractLatestCompletedDraftEventId(bootstrap: any): number | null {
  const list = extractDraftEvents(bootstrap);
  const finished = list
    .filter((e: any) => e?.finished)
    .map((e: any) => parsePositiveInt(e?.id))
    .filter((id: number | null): id is number => id !== null);
  if (finished.length === 0) return null;
  return Math.max(...finished);
}

function resolveDisplayGameweek(currentEvent: number | null, latestCompletedEvent: number | null) {
  const current = currentEvent || 1;
  if (!latestCompletedEvent || latestCompletedEvent < 1) return current;
  // If current event is already completed, move the "this week" view to upcoming fixtures.
  return latestCompletedEvent >= current ? latestCompletedEvent + 1 : current;
}

function unwrapDraftEntry(payload: any) {
  if (!payload || typeof payload !== "object") return payload;
  return payload.entry && typeof payload.entry === "object" ? payload.entry : payload;
}

function extractDraftLeagueId(entry: any): number | null {
  const normalizedEntry = unwrapDraftEntry(entry);
  if (!normalizedEntry) return null;

  const leagueSet = normalizeDraftList<any>(normalizedEntry.league_set);
  const firstLeagueSet = leagueSet[0];
  const candidates = [
    normalizedEntry.league_id,
    normalizedEntry.league?.id,
    normalizeDraftList<any>(normalizedEntry.leagues)[0]?.id,
    normalizeDraftList<any>(normalizedEntry.league_entries)[0]?.league_id,
    normalizeDraftList<any>(normalizedEntry.league_entries)[0]?.league,
    normalizedEntry.league_entry?.league_id,
    normalizedEntry.league_entry?.league,
    firstLeagueSet?.id,
    firstLeagueSet?.league_id,
    firstLeagueSet?.league,
    firstLeagueSet,
  ];
  for (const candidate of candidates) {
    const value = parsePositiveInt(candidate);
    if (value) return value;
  }
  return null;
}

function extractDraftLeagues(entry: any) {
  const normalizedEntry = unwrapDraftEntry(entry);
  const leagues: Array<{ id: number; name: string; type: string }> = [];
  const candidateLists = [
    normalizeDraftList<any>(normalizedEntry?.leagues),
    normalizeDraftList<any>(normalizedEntry?.league_entries),
    normalizeDraftList<any>(normalizedEntry?.league_set),
  ];
  const seen = new Set<number>();

  for (const leagueList of candidateLists) {
    leagueList.forEach((l: any) => {
      const id = parsePositiveInt(l?.id ?? l?.league_id ?? l?.league ?? l);
      const name = l?.name ?? l?.league_name ?? l?.entry_name ?? "Draft League";
      if (!id || seen.has(id)) return;
      seen.add(id);
      leagues.push({ id, name, type: "draft" });
    });
  }

  return leagues;
}

function formatDraftManagerName(entry: any) {
  const first = entry?.player_first_name ?? entry?.player?.first_name ?? "";
  const last = entry?.player_last_name ?? entry?.player?.last_name ?? "";
  const combined = `${first} ${last}`.trim();
  return combined || entry?.manager_name || entry?.player_name || "Manager";
}

function formatDraftTeamName(entry: any) {
  const manager = formatDraftManagerName(entry);
  const candidate = String(entry?.entry_name ?? entry?.name ?? "").trim();
  if (!candidate) return manager;
  if (candidate.toLowerCase() === "team") return manager;
  // Draft often returns templated defaults like "[Name] Team".
  if (/\[[^\]]*name[^\]]*\]/i.test(candidate)) return manager;
  return candidate;
}

function coerceNumber(value: any, fallback = 0) {
  const num = typeof value === "string" ? Number.parseFloat(value) : value;
  return Number.isFinite(num) ? num : fallback;
}

function isMissingRelationError(error: any) {
  if (!error) return false;
  const code = String(error.code || "");
  const msg = String(error.message || "").toLowerCase();
  return (
    code === "PGRST116" ||
    code === "PGRST205" ||
    msg.includes("does not exist") ||
    msg.includes("relation") && msg.includes("not found")
  );
}

async function fetchDraftBootstrap() {
  return fetchJSON<any>(`${DRAFT_BASE_URL}/bootstrap-static`);
}

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function parseDataUrlImage(dataUrl: string) {
  const match = String(dataUrl || "").match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  const contentType = match[1];
  const base64 = match[2];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const ext = contentType.includes("png")
    ? "png"
    : contentType.includes("webp")
    ? "webp"
    : contentType.includes("gif")
    ? "gif"
    : "jpg";
  return { contentType, bytes, ext };
}

async function fetchLastLineupForTeam(supabase: ReturnType<typeof getSupabaseAdmin>, teamId: string, beforeGameweek: number) {
  try {
    // Find the most recent gameweek with selections for this team before or equal to beforeGameweek
    const { data: recent } = await supabase
      .from("player_selections")
      .select("gameweek")
      .eq("team_id", teamId)
      .lte("gameweek", beforeGameweek)
      .order("gameweek", { ascending: false })
      .limit(1);
    if (!recent || recent.length === 0) return null;
    const gw = recent[0].gameweek;
    const { data: rows } = await supabase
      .from("player_selections")
      .select("player_id, player_name, gameweek, is_captain, points_earned, player_position")
      .eq("team_id", teamId)
      .eq("gameweek", gw);
    if (!rows || rows.length === 0) return null;
    return rows.map((r: any) => ({
      player_id: r.player_id,
      player_name: r.player_name,
      position: r.player_position ?? null,
      is_captain: !!r.is_captain,
      points: r.points_earned ?? 0,
      gameweek: r.gameweek,
    }));
  } catch (err) {
    console.error("fetchLastLineupForTeam error", err);
    return null;
  }
}

type CaptainSession = {
  token: string;
  manager_name: string;
  team_id: string;
  entry_id: string;
  expires_at: string;
  revoked_at: string | null;
};

async function resolveCaptainSession(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  token: string,
): Promise<CaptainSession | null> {
  if (!token) return null;
  const { data, error } = await supabase
    .from("manager_sign_in_sessions")
    .select("token, manager_name, team_id, entry_id, expires_at, revoked_at")
    .eq("token", token)
    .maybeSingle();
  if (error || !data) return null;
  if (data.revoked_at) return null;
  if (new Date(data.expires_at).getTime() <= Date.now()) return null;
  return data as CaptainSession;
}

async function resolveCupTargetGameweek(
  supabase: ReturnType<typeof getSupabaseAdmin>,
) {
  let currentGameweek: number | null = null;
  const { data: seasonState } = await supabase
    .from("season_state")
    .select("current_gameweek")
    .eq("season", CURRENT_SEASON)
    .maybeSingle();
  currentGameweek = parsePositiveInt(seasonState?.current_gameweek);

  if (!currentGameweek) {
    try {
      const bootstrap = await fetchDraftBootstrap();
      currentGameweek = extractDraftCurrentEventId(bootstrap);
    } catch {
      currentGameweek = null;
    }
  }

  return Math.max(CUP_START_GAMEWEEK, currentGameweek || CUP_START_GAMEWEEK);
}

async function fetchDraftSquadForEntries(entryIds: string[], preferredEvent: number) {
  const triedEvents: number[] = [];
  const normalizedEntryIds = Array.from(
    new Set(entryIds.map((id) => String(id || "").trim()).filter(Boolean)),
  );

  const tryFetch = async (event: number) => {
    if (triedEvents.includes(event)) return null;
    triedEvents.push(event);
    for (const entryId of normalizedEntryIds) {
      try {
        const payload = await fetchJSON<any>(`${DRAFT_BASE_URL}/entry/${entryId}/event/${event}`);
        const picks = normalizeDraftList<any>(payload?.picks).map((p: any) => ({
          element: parsePositiveInt(p?.element ?? p?.element_id ?? p?.player_id),
        })).filter((p: any) => p.element !== null);
        if (!picks.length) continue;
        return { event, entryId, picks };
      } catch {
        // Try next candidate entry id.
      }
    }
    return null;
  };

  const primary = await tryFetch(preferredEvent);
  if (primary) return primary;

  let currentEvent: number | null = null;
  try {
    const bootstrap = await fetchDraftBootstrap();
    currentEvent = extractDraftCurrentEventId(bootstrap);
  } catch {
    currentEvent = null;
  }

  if (currentEvent) {
    const fallback = await tryFetch(currentEvent);
    if (fallback) return fallback;
  }

  return null;
}

async function resolveDraftEntryCandidatesForManager(
  managerName: string,
  fallbackEntryId: string,
) {
  const candidates = new Set<string>();
  if (fallbackEntryId) candidates.add(String(fallbackEntryId));

  try {
    const { details } = await resolveDraftLeagueDetails(STATIC_ENTRY_ID);
    const entries = normalizeDraftList<any>(details?.league_entries);
    entries.forEach((entry: any) => {
      const canonical = toCanonicalManagerName(formatDraftManagerName(entry));
      if (canonical !== managerName) return;
      [
        entry?.entry_id,
        entry?.entry,
        entry?.id,
        entry?.league_entry_id,
      ].forEach((value: any) => {
        const parsed = parsePositiveInt(value);
        if (parsed) candidates.add(String(parsed));
      });
    });
  } catch {
    // Fallback-only path is acceptable.
  }

  return Array.from(candidates);
}

function extractDraftPlayerMap(bootstrap: any) {
  const rawElements = normalizeDraftList<any>(
    bootstrap?.elements?.data ??
      bootstrap?.elements ??
      bootstrap?.players ??
      [],
  );
  const map: Record<number, { id: number; name: string; team: number | null; position: number | null }> = {};
  rawElements.forEach((p: any) => {
    const id = parsePositiveInt(p?.id ?? p?.element ?? p?.element_id);
    if (!id) return;
    const name =
      String(
        p?.web_name ??
          p?.name ??
          `${p?.first_name ?? ""} ${p?.second_name ?? ""}`.trim(),
      ).trim() || `Player ${id}`;
    map[id] = {
      id,
      name,
      team: parsePositiveInt(p?.team),
      position: parsePositiveInt(p?.element_type ?? p?.position),
    };
  });
  return map;
}

function extractLivePointsMap(payload: any) {
  const pointsByPlayerId: Record<number, number> = {};
  const elements = payload?.elements;

  if (elements && typeof elements === "object" && !Array.isArray(elements)) {
    Object.entries(elements).forEach(([key, value]: [string, any]) => {
      const id = parsePositiveInt(key) ?? parsePositiveInt(value?.id ?? value?.element);
      if (!id) return;
      pointsByPlayerId[id] = coerceNumber(
        value?.stats?.total_points ?? value?.total_points ?? value?.points,
        0,
      );
    });
  } else {
    normalizeDraftList<any>(elements).forEach((el: any) => {
      const id = parsePositiveInt(el?.id ?? el?.element ?? el?.element_id);
      if (!id) return;
      pointsByPlayerId[id] = coerceNumber(
        el?.stats?.total_points ?? el?.total_points ?? el?.points,
        0,
      );
    });
  }

  return pointsByPlayerId;
}

function extractLivePlayerStatsMap(payload: any) {
  const statsByPlayerId: Record<number, any> = {};
  const elements = payload?.elements;

  const coerceStats = (stats: any) => ({
    total_points: coerceNumber(stats?.total_points, 0),
    goals_scored: coerceNumber(stats?.goals_scored, 0),
    assists: coerceNumber(stats?.assists, 0),
    minutes: coerceNumber(stats?.minutes, 0),
    defensive_contributions: coerceNumber(
      stats?.defensive_contributions,
      coerceNumber(stats?.recoveries, 0),
    ),
    clean_sheets: coerceNumber(stats?.clean_sheets, 0),
    goals_conceded: coerceNumber(stats?.goals_conceded, 0),
    yellow_cards: coerceNumber(stats?.yellow_cards, 0),
    red_cards: coerceNumber(stats?.red_cards, 0),
    penalties_missed: coerceNumber(stats?.penalties_missed, 0),
    penalties_saved: coerceNumber(stats?.penalties_saved, 0),
  });

  if (elements && typeof elements === "object" && !Array.isArray(elements)) {
    Object.entries(elements).forEach(([key, value]: [string, any]) => {
      const id = parsePositiveInt(key) ?? parsePositiveInt(value?.id ?? value?.element);
      if (!id) return;
      statsByPlayerId[id] = coerceStats(value?.stats || value || {});
    });
  } else {
    normalizeDraftList<any>(elements).forEach((el: any) => {
      const id = parsePositiveInt(el?.id ?? el?.element ?? el?.element_id);
      if (!id) return;
      statsByPlayerId[id] = coerceStats(el?.stats || el || {});
    });
  }

  return statsByPlayerId;
}

function normalizeManagerName(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

function toCanonicalManagerName(value: unknown): string | null {
  const normalized = normalizeManagerName(value);
  if (!normalized) return null;
  if (MANAGER_CANONICAL_ALIASES[normalized]) return MANAGER_CANONICAL_ALIASES[normalized];
  if (VALID_MANAGER_SET.has(normalized)) return normalized;
  const first = normalized.split(/[^A-Z]+/).filter(Boolean)[0] || "";
  if (MANAGER_CANONICAL_ALIASES[first]) return MANAGER_CANONICAL_ALIASES[first];
  if (VALID_MANAGER_SET.has(first)) return first;
  return null;
}

function getManagerNameVariants(canonicalManagerName: string): string[] {
  const variants = new Set<string>([canonicalManagerName]);
  Object.entries(MANAGER_CANONICAL_ALIASES).forEach(([alias, canonical]) => {
    if (canonical === canonicalManagerName) variants.add(alias);
  });
  return Array.from(variants);
}

type H2HRecord = {
  manager_name: string;
  opponent_name: string;
  season: string | null;
  wins: number;
  draws: number;
  losses: number;
  games_played: number;
  avg_points: number | null;
};

type AllTimeManagerStat = {
  manager_name: string;
  wins: number;
  losses: number;
  draws: number;
  total_points: number;
  points_plus: number;
  points_per_game: number;
  league_titles: number;
  cup_wins: number;
  goblet_wins: number;
  total_transactions: number;
  highest_gameweek: number | null;
  lowest_gameweek: number | null;
  fifty_plus_weeks: number;
  sub_twenty_weeks: number;
  best_gameweek_points: number | null;
  best_gameweek_details: string | null;
  longest_win_streak: number;
  longest_undefeated_streak: number;
  longest_loss_streak: number;
  longest_winless_streak: number;
  longest_win_streak_spans: string;
  longest_undefeated_streak_spans: string;
  longest_loss_streak_spans: string;
  longest_winless_streak_spans: string;
};

type GameweekRecordRow = {
  season: string;
  gameweek: number;
  manager_name: string;
  points_for: number;
  result: string;
};

type ManagerDerivedGwStats = {
  best_gameweek_points: number | null;
  best_gameweek_occurrences: Array<{ season: string; gameweek: number }>;
  best_gameweek_details: string | null;
  fifty_plus_weeks: number;
  longest_win_streak: number;
  longest_undefeated_streak: number;
  longest_loss_streak: number;
  longest_winless_streak: number;
  longest_win_streak_spans: string[];
  longest_undefeated_streak_spans: string[];
  longest_loss_streak_spans: string[];
  longest_winless_streak_spans: string[];
};

type StreakSpan = {
  startSeason: string;
  startGw: number;
  endSeason: string;
  endGw: number;
};

function seasonStartYear(season: string): number {
  const match = String(season || "").match(/^(\d{4})/);
  return match ? Number.parseInt(match[1], 10) : 0;
}

function compareSeasonAndGw(a: { season: string; gameweek: number }, b: { season: string; gameweek: number }) {
  const seasonDiff = seasonStartYear(a.season) - seasonStartYear(b.season);
  if (seasonDiff !== 0) return seasonDiff;
  return coerceNumber(a.gameweek) - coerceNumber(b.gameweek);
}

function formatBestGameweekDetails(
  points: number | null,
  rows: Array<{ season: string; gameweek: number }>,
) {
  if (points === null || rows.length === 0) return null;
  const ordered = [...rows].sort(compareSeasonAndGw);
  return `${points}: ${ordered.map((r) => `${r.season} GW${r.gameweek}`).join(", ")}`;
}

function longestRun(results: string[], predicate: (r: string) => boolean) {
  let max = 0;
  let curr = 0;
  for (const r of results) {
    if (predicate(r)) {
      curr += 1;
      if (curr > max) max = curr;
    } else {
      curr = 0;
    }
  }
  return max;
}

function formatStreakSpan(span: StreakSpan) {
  if (span.startSeason === span.endSeason) {
    if (span.startGw === span.endGw) return `${span.startSeason} GW${span.startGw}`;
    return `${span.startSeason} GW${span.startGw}-GW${span.endGw}`;
  }
  return `${span.startSeason} GW${span.startGw} -> ${span.endSeason} GW${span.endGw}`;
}

function longestRunWithSpans(
  rows: GameweekRecordRow[],
  predicate: (r: string) => boolean,
) {
  let max = 0;
  let curr = 0;
  let spans: StreakSpan[] = [];
  let currentStart: { season: string; gameweek: number } | null = null;
  let prev: { season: string; gameweek: number } | null = null;

  const closeRun = (end: { season: string; gameweek: number } | null) => {
    if (!currentStart || !end || curr <= 0) return;
    if (curr > max) {
      max = curr;
      spans = [{
        startSeason: currentStart.season,
        startGw: currentStart.gameweek,
        endSeason: end.season,
        endGw: end.gameweek,
      }];
    } else if (curr === max && max > 0) {
      spans.push({
        startSeason: currentStart.season,
        startGw: currentStart.gameweek,
        endSeason: end.season,
        endGw: end.gameweek,
      });
    }
  };

  for (const row of rows) {
    const rowPos = { season: row.season, gameweek: row.gameweek };
    const isSequential =
      !!prev &&
      prev.season === row.season &&
      coerceNumber(prev.gameweek) + 1 === coerceNumber(row.gameweek);
    if (!isSequential && curr > 0) {
      closeRun(prev);
      curr = 0;
      currentStart = null;
    }

    if (predicate(String(row.result || "").toUpperCase())) {
      if (curr === 0) currentStart = rowPos;
      curr += 1;
    } else {
      if (curr > 0) closeRun(prev);
      curr = 0;
      currentStart = null;
    }
    prev = rowPos;
  }

  if (curr > 0) closeRun(prev);
  return { value: max, spans: spans.map(formatStreakSpan) };
}

function computeManagerDerivedStats(rows: GameweekRecordRow[]): ManagerDerivedGwStats {
  if (!rows.length) {
    return {
      best_gameweek_points: null,
      best_gameweek_occurrences: [],
      best_gameweek_details: null,
      fifty_plus_weeks: 0,
      longest_win_streak: 0,
      longest_undefeated_streak: 0,
      longest_loss_streak: 0,
      longest_winless_streak: 0,
      longest_win_streak_spans: [],
      longest_undefeated_streak_spans: [],
      longest_loss_streak_spans: [],
      longest_winless_streak_spans: [],
    };
  }

  const ordered = [...rows].sort(compareSeasonAndGw);
  let best = Number.NEGATIVE_INFINITY;
  let occurrences: Array<{ season: string; gameweek: number }> = [];
  let fiftyPlus = 0;

  ordered.forEach((row) => {
    const points = coerceNumber(row.points_for);
    if (points > best) {
      best = points;
      occurrences = [{ season: row.season, gameweek: row.gameweek }];
    } else if (points === best) {
      occurrences.push({ season: row.season, gameweek: row.gameweek });
    }
    if (points >= 50) fiftyPlus += 1;
  });

  const win = longestRunWithSpans(ordered, (r) => r === "W");
  const unbeaten = longestRunWithSpans(ordered, (r) => r !== "L");
  const loss = longestRunWithSpans(ordered, (r) => r === "L");
  const winless = longestRunWithSpans(ordered, (r) => r !== "W");

  const bestPoints = Number.isFinite(best) ? best : null;
  return {
    best_gameweek_points: bestPoints,
    best_gameweek_occurrences: occurrences,
    best_gameweek_details: formatBestGameweekDetails(bestPoints, occurrences),
    fifty_plus_weeks: fiftyPlus,
    longest_win_streak: win.value,
    longest_undefeated_streak: unbeaten.value,
    longest_loss_streak: loss.value,
    longest_winless_streak: winless.value,
    longest_win_streak_spans: win.spans,
    longest_undefeated_streak_spans: unbeaten.spans,
    longest_loss_streak_spans: loss.spans,
    longest_winless_streak_spans: winless.spans,
  };
}

async function fetchDerivedGameweekStats(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  season?: string,
) {
  const query = supabase
    .from("legacy_h2h_gameweek_results")
    .select("season, gameweek, manager_name, points_for, result")
    .order("season", { ascending: true })
    .order("gameweek", { ascending: true });

  const { data, error } = season ? await query.eq("season", season) : await query;
  if (error && !isMissingRelationError(error)) {
    throw new Error(`Failed to fetch legacy gameweek results: ${error.message}`);
  }

  const byManager: Record<string, GameweekRecordRow[]> = {};
  (data || []).forEach((row: any) => {
    const manager = toCanonicalManagerName(row.manager_name);
    if (!manager) return;
    if (!byManager[manager]) byManager[manager] = [];
    byManager[manager].push({
      season: String(row.season || ""),
      gameweek: coerceNumber(row.gameweek),
      manager_name: manager,
      points_for: coerceNumber(row.points_for),
      result: String(row.result || "").toUpperCase(),
    });
  });

  const hasCurrentSeasonRows = (data || []).some((row: any) => String(row.season || "") === CURRENT_SEASON);
  const shouldHydrateFromCurrentMatchups =
    (!season || season === CURRENT_SEASON) && !hasCurrentSeasonRows;

  if (shouldHydrateFromCurrentMatchups) {
    const [matchupsRes, teamsRes] = await Promise.all([
      supabase
        .from("h2h_matchups")
        .select("team_1_id, team_2_id, gameweek, team_1_points, team_2_points, winner_id")
        .order("gameweek", { ascending: true }),
      supabase
        .from("teams")
        .select("id, entry_id, manager_name"),
    ]);

    if ((matchupsRes.error && matchupsRes.error.code !== "PGRST116") || teamsRes.error) {
      throw new Error(
        `Failed to hydrate derived current-season stats: ${
          matchupsRes.error?.message || teamsRes.error?.message || "unknown error"
        }`,
      );
    }

    const managerByKey: Record<string, string> = {};
    (teamsRes.data || []).forEach((team: any) => {
      const canonical = toCanonicalManagerName(team.manager_name);
      if (!canonical) return;
      managerByKey[String(team.id)] = canonical;
      if (team.entry_id !== null && team.entry_id !== undefined) {
        managerByKey[String(team.entry_id)] = canonical;
      }
    });
    try {
      const { details } = await resolveDraftLeagueDetails(STATIC_ENTRY_ID);
      normalizeDraftList<any>(details?.league_entries).forEach((entry: any) => {
        const manager = toCanonicalManagerName(formatDraftManagerName(entry));
        if (!manager) return;
        const id = entry.id ?? entry.league_entry_id ?? entry.entry_id ?? entry.entry;
        if (id !== null && id !== undefined) managerByKey[String(id)] = manager;
      });
    } catch {
      // Ignore draft fallback failures.
    }

    (matchupsRes.data || []).forEach((m: any) => {
      const manager1 = managerByKey[String(m.team_1_id)];
      const manager2 = managerByKey[String(m.team_2_id)];
      if (!manager1 || !manager2 || manager1 === manager2) return;
      const p1 = coerceNumber(m.team_1_points);
      const p2 = coerceNumber(m.team_2_points);
      const winner = String(m.winner_id || "");
      const result1 =
        winner === String(m.team_1_id) ? "W" :
        winner === String(m.team_2_id) ? "L" :
        p1 > p2 ? "W" : p2 > p1 ? "L" : "D";
      const result2 = result1 === "W" ? "L" : result1 === "L" ? "W" : "D";
      if (!byManager[manager1]) byManager[manager1] = [];
      if (!byManager[manager2]) byManager[manager2] = [];
      byManager[manager1].push({
        season: CURRENT_SEASON,
        gameweek: coerceNumber(m.gameweek),
        manager_name: manager1,
        points_for: p1,
        result: result1,
      });
      byManager[manager2].push({
        season: CURRENT_SEASON,
        gameweek: coerceNumber(m.gameweek),
        manager_name: manager2,
        points_for: p2,
        result: result2,
      });
    });

    if (Object.keys(byManager).length === 0) {
      try {
        const bootstrap = await fetchDraftBootstrap();
        const latestCompletedEvent = extractLatestCompletedDraftEventId(bootstrap);
        const { details } = await resolveDraftLeagueDetails(STATIC_ENTRY_ID);
        const entries = normalizeDraftList<any>(details?.league_entries);
        const matches = normalizeDraftList<any>(details?.matches);
        const managerByEntry: Record<string, string> = {};
        entries.forEach((entry: any) => {
          const manager = toCanonicalManagerName(formatDraftManagerName(entry));
          const id = entry.id ?? entry.league_entry_id ?? entry.entry_id ?? entry.entry;
          if (!manager || id === null || id === undefined) return;
          managerByEntry[String(id)] = manager;
        });

        matches.forEach((m: any) => {
          const gw = coerceNumber(m.event);
          if (latestCompletedEvent && gw > latestCompletedEvent) return;
          const entry1 = String(m.league_entry_1 ?? m.entry_1 ?? m.home ?? "");
          const entry2 = String(m.league_entry_2 ?? m.entry_2 ?? m.away ?? "");
          const manager1 = managerByEntry[entry1];
          const manager2 = managerByEntry[entry2];
          if (!manager1 || !manager2 || manager1 === manager2) return;
          const p1 = coerceNumber(m.league_entry_1_points ?? m.score_1 ?? m.home_score);
          const p2 = coerceNumber(m.league_entry_2_points ?? m.score_2 ?? m.away_score);
          const result1 = p1 > p2 ? "W" : p2 > p1 ? "L" : "D";
          const result2 = result1 === "W" ? "L" : result1 === "L" ? "W" : "D";
          if (!byManager[manager1]) byManager[manager1] = [];
          if (!byManager[manager2]) byManager[manager2] = [];
          byManager[manager1].push({
            season: CURRENT_SEASON,
            gameweek: gw,
            manager_name: manager1,
            points_for: p1,
            result: result1,
          });
          byManager[manager2].push({
            season: CURRENT_SEASON,
            gameweek: gw,
            manager_name: manager2,
            points_for: p2,
            result: result2,
          });
        });
      } catch {
        // Ignore API fallback failures.
      }
    }
  }

  const managers = Object.keys(byManager).length > 0 ? Object.keys(byManager) : [...VALID_MANAGERS];
  const managerStats: Record<string, ManagerDerivedGwStats> = {};
  managers.forEach((manager) => {
    managerStats[manager] = computeManagerDerivedStats(byManager[manager] || []);
  });

  type LeaderRow = { manager_name: string; value: number; details: string | null };
  const buildLeaderRows = (metric: keyof ManagerDerivedGwStats, detailsMetric?: keyof ManagerDerivedGwStats) => {
    const all: LeaderRow[] = managers.map((manager) => {
      const value = coerceNumber((managerStats[manager] as any)[metric]);
      const rawDetails = detailsMetric ? (managerStats[manager] as any)[detailsMetric] : null;
      const details = Array.isArray(rawDetails)
        ? rawDetails.filter(Boolean).join(", ")
        : String(rawDetails || "");
      return { manager_name: manager, value, details: details || null };
    });
    const max = all.reduce((acc, row) => Math.max(acc, row.value), 0);
    return {
      value: max,
      leaders: all.filter((row) => row.value === max),
    };
  };

  return {
    managerStats,
    leaders: {
      points_in_gameweek: buildLeaderRows("best_gameweek_points", "best_gameweek_details"),
      most_50_plus_gws: buildLeaderRows("fifty_plus_weeks"),
      longest_win_streak: buildLeaderRows("longest_win_streak", "longest_win_streak_spans"),
      longest_unbeaten_streak: buildLeaderRows("longest_undefeated_streak", "longest_undefeated_streak_spans"),
      longest_losing_streak: buildLeaderRows("longest_loss_streak", "longest_loss_streak_spans"),
      longest_winless_streak: buildLeaderRows("longest_winless_streak", "longest_winless_streak_spans"),
    },
  };
}

async function fetchDraftPicksForEntries(
  entryIds: string[],
  preferredEvent: number,
  strictEvent = false,
) {
  const normalizedEntryIds = Array.from(
    new Set(entryIds.map((id) => String(id || "").trim()).filter(Boolean)),
  );
  if (!normalizedEntryIds.length) return null;

  const tried = new Set<string>();
  const tryFetch = async (event: number) => {
    for (const entryId of normalizedEntryIds) {
      const key = `${entryId}__${event}`;
      if (tried.has(key)) continue;
      tried.add(key);
      try {
        const payload = await fetchJSON<any>(`${DRAFT_BASE_URL}/entry/${entryId}/event/${event}`);
        const picks = normalizeDraftList<any>(payload?.picks).map((p: any) => ({
          element: parsePositiveInt(p?.element ?? p?.element_id ?? p?.player_id),
          position: coerceNumber(p?.position),
          is_captain: !!p?.is_captain,
          is_vice_captain: !!p?.is_vice_captain,
          multiplier: coerceNumber(p?.multiplier, 1),
          points: Number.isFinite(Number(p?.points))
            ? Number(p?.points)
            : Number.isFinite(Number(p?.total_points))
            ? Number(p?.total_points)
            : Number.isFinite(Number(p?.stats?.total_points))
            ? Number(p?.stats?.total_points)
            : null,
        })).filter((p: any) => p.element !== null);
        if (!picks.length) continue;
        return { event, entryId, picks };
      } catch {
        // Try next candidate.
      }
    }
    return null;
  };

  const primary = await tryFetch(preferredEvent);
  if (primary) return primary;

  if (strictEvent) return null;

  try {
    const bootstrap = await fetchDraftBootstrap();
    const currentEvent = extractDraftCurrentEventId(bootstrap);
    if (currentEvent) {
      const fallback = await tryFetch(currentEvent);
      if (fallback) return fallback;
    }
  } catch {
    // Ignore fallback failures.
  }
  return null;
}

async function buildLeagueRankMap(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  upToGameweek?: number | null,
) {
  const { data: matchups, error } = await supabase
    .from("h2h_matchups")
    .select("team_1_id, team_2_id, gameweek, winner_id, team_1_points, team_2_points")
    .order("gameweek", { ascending: true });
  if (error && error.code !== "PGRST116") {
    throw new Error(`Failed to fetch h2h matchups for ranks: ${error.message}`);
  }

  const filtered = (matchups || []).filter((m: any) =>
    upToGameweek ? coerceNumber(m.gameweek) <= upToGameweek : true,
  );
  const agg: Record<string, { points: number; points_for: number }> = {};
  const ensure = (teamId: string) => {
    if (!agg[teamId]) agg[teamId] = { points: 0, points_for: 0 };
    return agg[teamId];
  };

  filtered.forEach((m: any) => {
    const left = String(m.team_1_id);
    const right = String(m.team_2_id);
    const p1 = coerceNumber(m.team_1_points);
    const p2 = coerceNumber(m.team_2_points);
    ensure(left).points_for += p1;
    ensure(right).points_for += p2;
    if (!m.winner_id) {
      ensure(left).points += 1;
      ensure(right).points += 1;
      return;
    }
    const winner = String(m.winner_id);
    if (winner === left) ensure(left).points += 3;
    else if (winner === right) ensure(right).points += 3;
    else {
      ensure(left).points += 1;
      ensure(right).points += 1;
    }
  });

  const rankMap: Record<string, number> = {};
  Object.entries(agg)
    .sort((a, b) => b[1].points - a[1].points || b[1].points_for - a[1].points_for)
    .forEach(([teamId], index) => {
      rankMap[teamId] = index + 1;
    });
  return rankMap;
}

function buildDraftRankMapFromMatches(
  matches: any[],
  upToGameweek?: number | null,
) {
  const agg: Record<string, { points: number; points_for: number }> = {};
  const ensure = (entryId: string) => {
    if (!agg[entryId]) agg[entryId] = { points: 0, points_for: 0 };
    return agg[entryId];
  };

  (matches || []).forEach((m: any) => {
    const gw = coerceNumber(m.event);
    if (upToGameweek && gw > upToGameweek) return;
    const entry1 = String(m.league_entry_1 ?? m.entry_1 ?? m.home ?? "");
    const entry2 = String(m.league_entry_2 ?? m.entry_2 ?? m.away ?? "");
    if (!entry1 || !entry2) return;
    const p1 = coerceNumber(m.league_entry_1_points ?? m.score_1 ?? m.home_score);
    const p2 = coerceNumber(m.league_entry_2_points ?? m.score_2 ?? m.away_score);
    ensure(entry1).points_for += p1;
    ensure(entry2).points_for += p2;
    if (p1 > p2) ensure(entry1).points += 3;
    else if (p2 > p1) ensure(entry2).points += 3;
    else {
      ensure(entry1).points += 1;
      ensure(entry2).points += 1;
    }
  });

  const rankMap: Record<string, number> = {};
  Object.entries(agg)
    .sort((a, b) => b[1].points - a[1].points || b[1].points_for - a[1].points_for)
    .forEach(([entryId], index) => {
      rankMap[entryId] = index + 1;
    });
  return rankMap;
}

async function syncCurrentSeasonLegacyStats(
  supabase: ReturnType<typeof getSupabaseAdmin>,
) {
  const bootstrap = await fetchDraftBootstrap();
  const latestCompletedEvent = extractLatestCompletedDraftEventId(bootstrap);
  if (!latestCompletedEvent || latestCompletedEvent < 1) {
    return { latestCompletedEvent: null, synced: false };
  }

  const managerByKey: Record<string, string> = {};
  const { details } = await resolveDraftLeagueDetails(STATIC_ENTRY_ID);
  const entries = normalizeDraftList<any>(details?.league_entries);
  entries.forEach((entry: any) => {
    const id = entry.id ?? entry.league_entry_id ?? entry.entry_id ?? entry.entry;
    if (!id) return;
    const manager = toCanonicalManagerName(formatDraftManagerName(entry));
    if (!manager) return;
    managerByKey[String(id)] = manager;
    const rawEntryId = entry.entry_id ?? entry.entry;
    if (rawEntryId !== null && rawEntryId !== undefined) {
      managerByKey[String(rawEntryId)] = manager;
    }
  });

  const completedMatchups = normalizeDraftList<any>(details?.matches)
    .filter((m: any) => {
      const gw = coerceNumber(m.event);
      return gw >= 1 && gw <= latestCompletedEvent;
    })
    .map((m: any) => ({
      team_1_id: m.league_entry_1 ?? m.entry_1 ?? m.home,
      team_2_id: m.league_entry_2 ?? m.entry_2 ?? m.away,
      gameweek: m.event,
      team_1_points: m.league_entry_1_points ?? m.score_1 ?? m.home_score,
      team_2_points: m.league_entry_2_points ?? m.score_2 ?? m.away_score,
      winner_id: null,
    }));

  if (completedMatchups.length === 0) {
    return { latestCompletedEvent, synced: false };
  }

  const gameweekRows: any[] = [];
  const pairAgg: Record<string, { manager_name: string; opponent_name: string; wins: number; draws: number; losses: number; games_played: number; result_points_total: number }> = {};
  const standingsAgg: Record<string, { manager_name: string; wins: number; draws: number; losses: number; points: number; points_for: number; points_against: number }> = {};

  function ensurePair(manager: string, opponent: string) {
    const key = `${manager}__${opponent}`;
    if (!pairAgg[key]) {
      pairAgg[key] = {
        manager_name: manager,
        opponent_name: opponent,
        wins: 0,
        draws: 0,
        losses: 0,
        games_played: 0,
        result_points_total: 0,
      };
    }
    return pairAgg[key];
  }

  function ensureStanding(manager: string) {
    if (!standingsAgg[manager]) {
      standingsAgg[manager] = {
        manager_name: manager,
        wins: 0,
        draws: 0,
        losses: 0,
        points: 0,
        points_for: 0,
        points_against: 0,
      };
    }
    return standingsAgg[manager];
  }

  completedMatchups.forEach((m: any) => {
    const manager1 = managerByKey[String(m.team_1_id ?? "")];
    const manager2 = managerByKey[String(m.team_2_id ?? "")];
    if (!manager1 || !manager2 || manager1 === manager2) return;

    const gameweek = coerceNumber(m.gameweek);
    const p1 = coerceNumber(m.team_1_points);
    const p2 = coerceNumber(m.team_2_points);
    let r1: "W" | "D" | "L" = "D";
    let r2: "W" | "D" | "L" = "D";

    if (p1 > p2) {
      r1 = "W";
      r2 = "L";
    } else if (p2 > p1) {
      r1 = "L";
      r2 = "W";
    }

    gameweekRows.push({
      season: CURRENT_SEASON,
      gameweek,
      manager_name: manager1,
      opponent_name: manager2,
      points_for: p1,
      points_against: p2,
      result: r1,
      imported_at: new Date().toISOString(),
    });
    gameweekRows.push({
      season: CURRENT_SEASON,
      gameweek,
      manager_name: manager2,
      opponent_name: manager1,
      points_for: p2,
      points_against: p1,
      result: r2,
      imported_at: new Date().toISOString(),
    });

    const pair1 = ensurePair(manager1, manager2);
    const pair2 = ensurePair(manager2, manager1);
    pair1.games_played += 1;
    pair2.games_played += 1;
    if (r1 === "W") {
      pair1.result_points_total += 3;
      pair2.result_points_total += 0;
    } else if (r1 === "L") {
      pair1.result_points_total += 0;
      pair2.result_points_total += 3;
    } else {
      pair1.result_points_total += 1;
      pair2.result_points_total += 1;
    }
    if (r1 === "W") pair1.wins += 1;
    if (r1 === "D") pair1.draws += 1;
    if (r1 === "L") pair1.losses += 1;
    if (r2 === "W") pair2.wins += 1;
    if (r2 === "D") pair2.draws += 1;
    if (r2 === "L") pair2.losses += 1;

    const st1 = ensureStanding(manager1);
    const st2 = ensureStanding(manager2);
    st1.points_for += p1;
    st1.points_against += p2;
    st2.points_for += p2;
    st2.points_against += p1;
    if (r1 === "W") {
      st1.wins += 1;
      st2.losses += 1;
      st1.points += 3;
    } else if (r1 === "L") {
      st2.wins += 1;
      st1.losses += 1;
      st2.points += 3;
    } else {
      st1.draws += 1;
      st2.draws += 1;
      st1.points += 1;
      st2.points += 1;
    }
  });

  if (gameweekRows.length > 0) {
    // Refresh completed current-season rows so stale placeholder data is replaced.
    const { error: deleteError } = await supabase
      .from("legacy_h2h_gameweek_results")
      .delete()
      .eq("season", CURRENT_SEASON)
      .lte("gameweek", latestCompletedEvent);
    if (deleteError) {
      throw new Error(`Failed to clear legacy_h2h_gameweek_results: ${deleteError.message}`);
    }

    const { error } = await supabase
      .from("legacy_h2h_gameweek_results")
      .insert(gameweekRows);
    if (error) {
      throw new Error(`Failed to insert legacy_h2h_gameweek_results: ${error.message}`);
    }
  }

  const h2hRows = Object.values(pairAgg).map((row) => ({
    manager_name: row.manager_name,
    opponent_name: row.opponent_name,
    season: CURRENT_SEASON,
    wins: row.wins,
    draws: row.draws,
    losses: row.losses,
    games_played: row.games_played,
    avg_points: row.games_played > 0 ? Math.round((row.result_points_total / row.games_played) * 100) / 100 : null,
    imported_at: new Date().toISOString(),
  }));
  if (h2hRows.length > 0) {
    // Refresh current-season aggregate H2H rows to keep records in sync with latest completed GW.
    const { error: deleteError } = await supabase
      .from("legacy_h2h_stats")
      .delete()
      .eq("season", CURRENT_SEASON);
    if (deleteError) {
      throw new Error(`Failed to clear legacy_h2h_stats: ${deleteError.message}`);
    }

    const { error } = await supabase
      .from("legacy_h2h_stats")
      .insert(h2hRows);
    if (error) {
      throw new Error(`Failed to insert legacy_h2h_stats: ${error.message}`);
    }
  }

  const ranked = Object.values(standingsAgg)
    .sort((a, b) => b.points - a.points || b.points_for - a.points_for)
    .map((row, index) => ({ ...row, final_rank: index + 1 }));
  const standingsRows = ranked.map((row) => ({
    season: CURRENT_SEASON,
    manager_name: row.manager_name,
    final_rank: row.final_rank,
    wins: row.wins,
    draws: row.draws,
    losses: row.losses,
    points: row.points,
    points_for: row.points_for,
    points_against: row.points_against,
    competition_type: "league",
    imported_at: new Date().toISOString(),
  }));
  if (standingsRows.length > 0) {
    // Refresh current-season league standings rows so points_for/points are recalculated accurately.
    const { error: deleteError } = await supabase
      .from("legacy_season_standings")
      .delete()
      .eq("season", CURRENT_SEASON)
      .eq("competition_type", "league");
    if (deleteError) {
      throw new Error(`Failed to clear legacy_season_standings: ${deleteError.message}`);
    }

    const { error } = await supabase
      .from("legacy_season_standings")
      .insert(standingsRows);
    if (error) {
      throw new Error(`Failed to insert legacy_season_standings: ${error.message}`);
    }
  }

  return { latestCompletedEvent, synced: true };
}

async function computeAllTimeManagerStats(
  supabase: ReturnType<typeof getSupabaseAdmin>,
) {
  try {
    await syncCurrentSeasonLegacyStats(supabase);
  } catch (error) {
    // Do not fail caller if sync is blocked; return computed data from existing rows.
    console.warn("syncCurrentSeasonLegacyStats failed in computeAllTimeManagerStats", error);
  }

  const [standingsRes, trophiesRes, seasonStatsRes] = await Promise.all([
    supabase
      .from("legacy_season_standings")
      .select("season, manager_name, final_rank, wins, draws, losses, points, points_for, competition_type"),
    supabase
      .from("legacy_season_trophies")
      .select("season, manager_name, league_champion, cup_winner, goblet_winner"),
    supabase
      .from("legacy_manager_season_stats")
      .select("season, manager_name, total_transactions, highest_gameweek, lowest_gameweek, fifty_plus_weeks, sub_twenty_weeks"),
  ]);
  const derivedGw = await fetchDerivedGameweekStats(supabase);

  if (standingsRes.error && !isMissingRelationError(standingsRes.error)) {
    throw new Error(`Failed to compute all-time stats from standings: ${standingsRes.error.message}`);
  }
  if (trophiesRes.error && !isMissingRelationError(trophiesRes.error)) {
    throw new Error(`Failed to compute all-time stats from trophies: ${trophiesRes.error.message}`);
  }
  if (seasonStatsRes.error && !isMissingRelationError(seasonStatsRes.error)) {
    throw new Error(`Failed to compute all-time stats from season stats: ${seasonStatsRes.error.message}`);
  }

  const agg: Record<string, AllTimeManagerStat> = {};
  function ensureManager(manager: string) {
    if (!agg[manager]) {
      agg[manager] = {
        manager_name: manager,
        wins: 0,
        losses: 0,
        draws: 0,
        total_points: 0,
        points_plus: 0,
        points_per_game: 0,
        league_titles: 0,
        cup_wins: 0,
        goblet_wins: 0,
        total_transactions: 0,
        highest_gameweek: null,
        lowest_gameweek: null,
        fifty_plus_weeks: 0,
        sub_twenty_weeks: 0,
        best_gameweek_points: null,
        best_gameweek_details: null,
      longest_win_streak: 0,
      longest_undefeated_streak: 0,
      longest_loss_streak: 0,
      longest_winless_streak: 0,
      longest_win_streak_spans: "",
      longest_undefeated_streak_spans: "",
      longest_loss_streak_spans: "",
      longest_winless_streak_spans: "",
      };
    }
    return agg[manager];
  }

  const persistedLeagueRows = (standingsRes.data || [])
    .filter((row: any) => row.competition_type === "league");
  const leagueRows = persistedLeagueRows.filter((row: any) => row.season !== CURRENT_SEASON);

  try {
    const bootstrap = await fetchDraftBootstrap();
    const latestCompletedEvent = extractLatestCompletedDraftEventId(bootstrap);
    if (latestCompletedEvent && latestCompletedEvent > 0) {
      const { details } = await resolveDraftLeagueDetails(STATIC_ENTRY_ID);
      const entries = normalizeDraftList<any>(details?.league_entries);
      const managerByKey: Record<string, string> = {};
      entries.forEach((entry: any) => {
        const id = entry.id ?? entry.league_entry_id ?? entry.entry_id ?? entry.entry;
        const manager = toCanonicalManagerName(formatDraftManagerName(entry));
        if (!id || !manager) return;
        managerByKey[String(id)] = manager;
        const rawEntryId = entry.entry_id ?? entry.entry;
        if (rawEntryId !== null && rawEntryId !== undefined) {
          managerByKey[String(rawEntryId)] = manager;
        }
      });

      const standingsMap: Record<string, any> = {};
      const ensure = (manager: string) => {
        if (!standingsMap[manager]) {
          standingsMap[manager] = {
            season: CURRENT_SEASON,
            manager_name: manager,
            competition_type: "league",
            wins: 0,
            draws: 0,
            losses: 0,
            points: 0,
            points_for: 0,
            points_against: 0,
            final_rank: 0,
          };
        }
        return standingsMap[manager];
      };

      normalizeDraftList<any>(details?.matches).forEach((m: any) => {
        const gw = coerceNumber(m.event);
        if (gw < 1 || gw > latestCompletedEvent) return;
        const team1 = String(m.league_entry_1 ?? m.entry_1 ?? m.home ?? "");
        const team2 = String(m.league_entry_2 ?? m.entry_2 ?? m.away ?? "");
        const manager1 = managerByKey[team1];
        const manager2 = managerByKey[team2];
        if (!manager1 || !manager2) return;
        const p1 = coerceNumber(m.league_entry_1_points ?? m.score_1 ?? m.home_score);
        const p2 = coerceNumber(m.league_entry_2_points ?? m.score_2 ?? m.away_score);

        const r1 = ensure(manager1);
        const r2 = ensure(manager2);
        r1.points_for += p1;
        r1.points_against += p2;
        r2.points_for += p2;
        r2.points_against += p1;

        if (p1 > p2) {
          r1.wins += 1;
          r2.losses += 1;
          r1.points += 3;
        } else if (p2 > p1) {
          r2.wins += 1;
          r1.losses += 1;
          r2.points += 3;
        } else {
          r1.draws += 1;
          r2.draws += 1;
          r1.points += 1;
          r2.points += 1;
        }
      });

      const ranked = Object.values(standingsMap)
        .sort((a: any, b: any) => b.points - a.points || b.points_for - a.points_for)
        .map((row: any, index: number) => ({ ...row, final_rank: index + 1 }));
      leagueRows.push(...ranked);
    } else {
      // No completed current-season gameweek yet; fallback to persisted current-season rows if present.
      leagueRows.push(...persistedLeagueRows.filter((row: any) => row.season === CURRENT_SEASON));
    }
  } catch (error) {
    // If deriving current season rows fails, continue with persisted season rows.
    console.warn("Failed to derive current-season league rows in computeAllTimeManagerStats", error);
    leagueRows.push(...persistedLeagueRows.filter((row: any) => row.season === CURRENT_SEASON));
  }

  leagueRows.forEach((row: any) => {
    const manager = toCanonicalManagerName(row.manager_name);
    if (!manager) return;
    const target = ensureManager(manager);
    target.wins += coerceNumber(row.wins);
    target.draws += coerceNumber(row.draws);
    target.losses += coerceNumber(row.losses);
    target.total_points += coerceNumber(row.points, coerceNumber(row.wins) * 3 + coerceNumber(row.draws));
    target.points_plus += coerceNumber(row.points_for);
  });

  (trophiesRes.data || []).forEach((row: any) => {
    const manager = toCanonicalManagerName(row.manager_name);
    if (!manager) return;
    const target = ensureManager(manager);
    if (row.league_champion) target.league_titles += 1;
    if (row.cup_winner) target.cup_wins += 1;
    if (row.goblet_winner) target.goblet_wins += 1;
  });

  (seasonStatsRes.data || []).forEach((row: any) => {
    const manager = toCanonicalManagerName(row.manager_name);
    if (!manager) return;
    const target = ensureManager(manager);
    target.total_transactions += coerceNumber(row.total_transactions);
    target.sub_twenty_weeks += coerceNumber(row.sub_twenty_weeks);
    const hi = parsePositiveInt(row.highest_gameweek);
    const lo = parsePositiveInt(row.lowest_gameweek);
    target.highest_gameweek = hi ? Math.max(target.highest_gameweek || 0, hi) : target.highest_gameweek;
    target.lowest_gameweek =
      lo
        ? (target.lowest_gameweek === null ? lo : Math.min(target.lowest_gameweek, lo))
        : target.lowest_gameweek;
  });

  Object.entries(derivedGw.managerStats).forEach(([manager, stats]) => {
    const target = ensureManager(manager);
    target.fifty_plus_weeks = coerceNumber(stats.fifty_plus_weeks);
    target.best_gameweek_points = stats.best_gameweek_points;
    target.best_gameweek_details = stats.best_gameweek_details;
    target.longest_win_streak = coerceNumber(stats.longest_win_streak);
    target.longest_undefeated_streak = coerceNumber(stats.longest_undefeated_streak);
    target.longest_loss_streak = coerceNumber(stats.longest_loss_streak);
    target.longest_winless_streak = coerceNumber(stats.longest_winless_streak);
    target.longest_win_streak_spans = (stats.longest_win_streak_spans || []).join(", ");
    target.longest_undefeated_streak_spans = (stats.longest_undefeated_streak_spans || []).join(", ");
    target.longest_loss_streak_spans = (stats.longest_loss_streak_spans || []).join(", ");
    target.longest_winless_streak_spans = (stats.longest_winless_streak_spans || []).join(", ");
    target.highest_gameweek = stats.best_gameweek_points;
  });

  const rows = Object.values(agg).map((row) => {
    const games = row.wins + row.draws + row.losses;
    return {
      ...row,
      points_per_game: games > 0 ? Math.round((row.total_points / games) * 100) / 100 : 0,
    };
  });

  return rows.sort((a, b) => b.total_points - a.total_points);
}

async function fetchUnifiedAllTimeH2H(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  managerFilter?: string,
) {
  try {
    await syncCurrentSeasonLegacyStats(supabase);
  } catch (error) {
    // Keep serving merged output even if sync write fails.
    console.warn("syncCurrentSeasonLegacyStats failed in fetchUnifiedAllTimeH2H", error);
  }

  const managerNameFilter = managerFilter ? toCanonicalManagerName(managerFilter) : null;

  let latestCompletedEvent: number | null = null;
  try {
    const bootstrap = await fetchDraftBootstrap();
    latestCompletedEvent = extractLatestCompletedDraftEventId(bootstrap);
  } catch {
    latestCompletedEvent = null;
  }

  const [legacyRes, matchupsRes, teamsRes, aliasesRes] = await Promise.all([
    supabase
      .from("legacy_h2h_stats")
      .select("manager_name, opponent_name, season, wins, draws, losses, games_played, avg_points")
      .is("season", null)
      .order("opponent_name", { ascending: true }),
    supabase
      .from("h2h_matchups")
      .select("team_1_id, team_2_id, gameweek, team_1_points, team_2_points, winner_id"),
    supabase
      .from("teams")
      .select("id, entry_id, manager_name"),
    supabase
      .from("manager_aliases")
      .select("entry_id, manager_name"),
  ]);

  if (legacyRes.error && legacyRes.error.code !== "PGRST116") {
    throw new Error(`Failed to fetch legacy all-time H2H: ${legacyRes.error.message}`);
  }
  if (matchupsRes.error && matchupsRes.error.code !== "PGRST116") {
    throw new Error(`Failed to fetch current-season H2H matchups: ${matchupsRes.error.message}`);
  }
  if (teamsRes.error) {
    throw new Error(`Failed to fetch teams for H2H merge: ${teamsRes.error.message}`);
  }
  if (aliasesRes.error && aliasesRes.error.code !== "PGRST116") {
    throw new Error(`Failed to fetch manager aliases for H2H merge: ${aliasesRes.error.message}`);
  }

  const aliasByEntryId: Record<string, string> = {};
  (aliasesRes.data || []).forEach((row: any) => {
    const key = String(row.entry_id ?? "").trim();
    if (!key) return;
    const canonical = toCanonicalManagerName(row.manager_name);
    if (canonical) aliasByEntryId[key] = canonical;
  });

  const managerByTeamId: Record<string, string> = {};
  (teamsRes.data || []).forEach((row: any) => {
    const teamId = String(row.id ?? "").trim();
    if (!teamId) return;
    const aliasManager = aliasByEntryId[String(row.entry_id ?? "").trim()] || null;
    const canonicalManager = toCanonicalManagerName(aliasManager || row.manager_name);
    if (!canonicalManager) return;
    managerByTeamId[teamId] = canonicalManager;
    if (row.entry_id !== null && row.entry_id !== undefined) {
      managerByTeamId[String(row.entry_id)] = canonicalManager;
    }
  });

  // Fallback for live Draft league-entry IDs used in h2h_matchups.
  try {
    const { details } = await resolveDraftLeagueDetails(STATIC_ENTRY_ID);
    const entries = normalizeDraftList<any>(details?.league_entries);
    entries.forEach((entry: any) => {
      const id = entry.id ?? entry.league_entry_id ?? entry.entry_id ?? entry.entry;
      if (!id) return;
      const manager = toCanonicalManagerName(formatDraftManagerName(entry));
      if (!manager) return;
      managerByTeamId[String(id)] = manager;
      const rawEntryId = entry.entry_id ?? entry.entry;
      if (rawEntryId !== null && rawEntryId !== undefined) {
        managerByTeamId[String(rawEntryId)] = manager;
      }
    });
  } catch {
    // Ignore draft fallback failures and continue with existing mappings.
  }

  const merged: Record<string, H2HRecord & { total_result_points: number }> = {};
  function ensureRow(managerName: string, opponentName: string) {
    const key = `${managerName}__${opponentName}`;
    if (!merged[key]) {
      merged[key] = {
        manager_name: managerName,
        opponent_name: opponentName,
        season: null,
        wins: 0,
        draws: 0,
        losses: 0,
        games_played: 0,
        avg_points: null,
        total_result_points: 0,
      };
    }
    return merged[key];
  }

  (legacyRes.data || []).forEach((row: any) => {
    const manager = toCanonicalManagerName(row.manager_name);
    const opponent = toCanonicalManagerName(row.opponent_name);
    if (!manager || !opponent) return;
    if (managerNameFilter && manager !== managerNameFilter) return;

    const target = ensureRow(manager, opponent);
    target.wins += coerceNumber(row.wins);
    target.draws += coerceNumber(row.draws);
    target.losses += coerceNumber(row.losses);
    target.games_played += coerceNumber(row.games_played);
    const legacyAvg = coerceNumber(row.avg_points);
    target.total_result_points += legacyAvg * coerceNumber(row.games_played);
  });

  let seasonSource = (matchupsRes.data || []).map((m: any) => ({
    team_1_id: m.team_1_id,
    team_2_id: m.team_2_id,
    gameweek: m.gameweek,
    team_1_points: m.team_1_points,
    team_2_points: m.team_2_points,
    winner_id: m.winner_id,
  }));

  if (seasonSource.length === 0) {
    try {
      const { details } = await resolveDraftLeagueDetails(STATIC_ENTRY_ID);
      seasonSource = normalizeDraftList<any>(details?.matches).map((m: any) => ({
        team_1_id: m.league_entry_1 ?? m.entry_1 ?? m.home,
        team_2_id: m.league_entry_2 ?? m.entry_2 ?? m.away,
        gameweek: m.event,
        team_1_points: m.league_entry_1_points ?? m.score_1 ?? m.home_score,
        team_2_points: m.league_entry_2_points ?? m.score_2 ?? m.away_score,
        winner_id: null,
      }));
    } catch {
      seasonSource = [];
    }
  }

  const seasonMatchups = seasonSource.filter((m: any) =>
    latestCompletedEvent ? coerceNumber(m.gameweek) <= latestCompletedEvent : true
  );
  seasonMatchups.forEach((m: any) => {
    const manager1 = managerByTeamId[String(m.team_1_id ?? "")];
    const manager2 = managerByTeamId[String(m.team_2_id ?? "")];
    if (!manager1 || !manager2 || manager1 === manager2) return;

    if (
      managerNameFilter &&
      manager1 !== managerNameFilter &&
      manager2 !== managerNameFilter
    ) {
      return;
    }

    const p1 = coerceNumber(m.team_1_points);
    const p2 = coerceNumber(m.team_2_points);
    const winner = String(m.winner_id ?? "");

    const row1 = ensureRow(manager1, manager2);
    const row2 = ensureRow(manager2, manager1);
    row1.games_played += 1;
    row2.games_played += 1;
    if (winner && winner === String(m.team_1_id ?? "")) {
      row1.wins += 1;
      row2.losses += 1;
      row1.total_result_points += 3;
    } else if (winner && winner === String(m.team_2_id ?? "")) {
      row2.wins += 1;
      row1.losses += 1;
      row2.total_result_points += 3;
    } else if (p1 > p2) {
      row1.wins += 1;
      row2.losses += 1;
      row1.total_result_points += 3;
    } else if (p2 > p1) {
      row2.wins += 1;
      row1.losses += 1;
      row2.total_result_points += 3;
    } else {
      row1.draws += 1;
      row2.draws += 1;
      row1.total_result_points += 1;
      row2.total_result_points += 1;
    }
  });

  const records = Object.values(merged)
    .map((row) => {
      const wins = coerceNumber(row.wins);
      const draws = coerceNumber(row.draws);
      const losses = coerceNumber(row.losses);
      const gamesPlayed = wins + draws + losses;
      const avgPoints = gamesPlayed > 0 ? Math.round((((wins * 3) + draws) / gamesPlayed) * 100) / 100 : null;
      return {
        manager_name: row.manager_name,
        opponent_name: row.opponent_name,
        season: null as string | null,
        wins,
        draws,
        losses,
        games_played: gamesPlayed,
        avg_points: avgPoints,
      };
    })
    .filter((row) => (managerNameFilter ? row.manager_name === managerNameFilter : true))
    .sort((a, b) => a.opponent_name.localeCompare(b.opponent_name));

  return records;
}

async function resolveDraftLeagueDetails(entryId: string, leagueIdOverride?: number | null) {
  let leagueId = leagueIdOverride ?? null;
  let entry: any = null;

  if (!leagueId) {
    try {
      entry = await fetchJSON<any>(`${DRAFT_BASE_URL}/entry/${entryId}/public`);
    } catch {
      entry = null;
    }

    if (!entry) {
      try {
        entry = await fetchJSON<any>(`${DRAFT_BASE_URL}/entry/${entryId}`);
      } catch {
        entry = null;
      }
    }

    const normalizedEntry = unwrapDraftEntry(entry);
    leagueId = extractDraftLeagueId(normalizedEntry);
    const leagueEntries = normalizeDraftList<any>(normalizedEntry?.league_entries);
    if (!leagueId && leagueEntries.length > 0) {
      const candidate = leagueEntries[0];
      leagueId = extractDraftLeagueId(candidate);
    }

    entry = normalizedEntry;
  }

  if (!leagueId) {
    throw new Error(
      `Draft league not found for entry ${entryId}. This endpoint expects a Draft entry ID.`,
    );
  }

  const details = await fetchJSON<any>(`${DRAFT_BASE_URL}/league/${leagueId}/details`);
  return {
    leagueId,
    entry,
    details,
  };
}

function jsonError(c: any, status: number, message: string, details?: unknown) {
  return c.json({ error: { message, details } }, status);
}

/**
 * Resolves league context from the static entry ID.
 * Fetches the league ID from FPL API and returns all associated teams.
 */
async function resolveLeagueContext() {
  try {
    // Fetch entry details to get league ID
    const entry = await fetchJSON<any>(
      `${FPL_BASE_URL}/entry/${STATIC_ENTRY_ID}/`
    );

    if (!entry.leagues?.classic || !entry.leagues.classic.length) {
      throw new Error("No classic league found for static entry");
    }

    // Get the first classic league (main league)
    const leagueId = entry.leagues.classic[0].id;
    
    // Fetch league standings
    const league = await fetchJSON<any>(
      `${FPL_BASE_URL}/leagues-classic/${leagueId}/standings/`
    );

    return {
      entryId: STATIC_ENTRY_ID,
      leagueId,
      leagueName: entry.leagues.classic[0].name,
      teams: league.standings?.results || [],
    };
  } catch (err: any) {
    throw new Error(`Failed to resolve league context: ${err.message}`);
  }
}

async function fetchClassicLeagueStandings(entryId: string) {
  const entry = await fetchJSON<any>(`${FPL_BASE_URL}/entry/${entryId}/`);
  const classicLeague = entry?.leagues?.classic?.[0];
  if (!classicLeague?.id) {
    throw new Error(`No classic league found for entry ${entryId}`);
  }

  const league = await fetchJSON<any>(
    `${FPL_BASE_URL}/leagues-classic/${classicLeague.id}/standings/`,
  );
  return {
    leagueId: classicLeague.id,
    leagueName: classicLeague.name ?? "Classic League",
    standings: league?.standings?.results || [],
  };
}

async function fetchClassicH2HStandings(entryId: string) {
  const entry = await fetchJSON<any>(`${FPL_BASE_URL}/entry/${entryId}/`);
  const h2hLeague = entry?.leagues?.h2h?.[0];
  if (!h2hLeague?.id) {
    throw new Error(`No H2H league found for entry ${entryId}`);
  }

  const league = await fetchJSON<any>(
    `${FPL_BASE_URL}/leagues-h2h/${h2hLeague.id}/standings/`,
  );
  return {
    leagueId: h2hLeague.id,
    leagueName: h2hLeague.name ?? "H2H League",
    standings: league?.standings?.results || [],
  };
}

async function resolveLeagueContextFromDb(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const { data: seasonState, error: seasonError } = await supabase
    .from("season_state")
    .select("season, current_gameweek, league_id, league_name")
    .eq("season", CURRENT_SEASON)
    .maybeSingle();

  if (seasonError) {
    throw new Error(`Failed to load season_state: ${seasonError.message}`);
  }

  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id, entry_id, entry_name, manager_name, manager_short_name, seed");

  if (teamsError) {
    throw new Error(`Failed to load teams: ${teamsError.message}`);
  }

  return {
    entryId: STATIC_ENTRY_ID,
    leagueId: seasonState?.league_id ?? null,
    leagueName: seasonState?.league_name ?? null,
    currentGameweek: seasonState?.current_gameweek ?? null,
    teams: teams || [],
    hasSeasonState: !!seasonState,
  };
}

function requireAdminToken(c: any) {
  const expected = Deno.env.get("ADMIN_REFRESH_TOKEN") ?? "";
  const provided = c.req.header("x-admin-token") ?? "";
  if (!expected || provided !== expected) {
    return false;
  }
  return true;
}

function computeManagerRating(
  placements: number[],
  trophies: Array<{ league: boolean; cup: boolean; goblet: boolean }>,
  ppg: number,
  plusG: number,
  leaguePPGMean: number,
  leaguePlusGMean: number,
  leaguePlusGStdDev: number,
) {
  const placementScore = placements.reduce((sum, pos) => sum + (PLACEMENT_POINTS[pos] || 0), 0);

  let silverwareScore = 0;
  trophies.forEach((t) => {
    let base = 0;
    if (t.league) base += LEAGUE_VALUE;
    if (t.cup) base += CUP_VALUE;
    if (t.goblet) base += GOBLET_VALUE;
    const trophyCount = [t.league, t.cup, t.goblet].filter(Boolean).length;
    const multiplier =
      trophyCount === 3 ? TREBLE_MULTIPLIER :
      trophyCount === 2 ? DOUBLE_MULTIPLIER :
      1.0;
    silverwareScore += base * multiplier;
  });

  const ppgRatio = ppg / PPG_MAX;
  const ppgCurve = Math.pow(ppgRatio, PPG_K) * Math.exp(PPG_LAMBDA * (ppg - leaguePPGMean));
  const ppgPoints = PPG_SCALE * ppgCurve;

  const baseScore = placementScore + silverwareScore + ppgPoints;

  const z = leaguePlusGStdDev === 0 ? 0 : (plusG - leaguePlusGMean) / leaguePlusGStdDev;
  const gModifier = 1 + ALPHA * Math.tanh(z);
  const finalScore = baseScore * gModifier;

  return {
    placementScore,
    silverwareScore,
    ppgPoints,
    baseScore,
    gModifier,
    finalScore,
  };
}

// --------------------
// League Standings (Public)
// --------------------

const leagueStandings = new Hono();

leagueStandings.get("/", async (c) => {
  try {
    // DB-first: if current-season data is already persisted, use it.
    const supabase = getSupabaseAdmin();
    const dbContext = await resolveLeagueContextFromDb(supabase);
    if (dbContext.teams.length > 0) {
      const teamIds = dbContext.teams.map((t: any) => t.id);
      const { data: scores, error: scoresError } = await supabase
        .from("gameweek_scores")
        .select("team_id, total_points, gameweek")
        .in("team_id", teamIds);

      if (!scoresError && (scores || []).length > 0) {
        const totalsMap: Record<string, number> = {};
        const eventMap: Record<string, number> = {};
        let maxGameweek = 0;

        (scores || []).forEach((row: any) => {
          totalsMap[row.team_id] = (totalsMap[row.team_id] || 0) + (row.total_points || 0);
          if ((row.gameweek || 0) > maxGameweek) maxGameweek = row.gameweek;
        });

        const eventGw = dbContext.currentGameweek || maxGameweek || 1;
        (scores || []).forEach((row: any) => {
          if (row.gameweek === eventGw) {
            eventMap[row.team_id] = row.total_points || 0;
          }
        });

        const standings = dbContext.teams
          .map((team: any) => ({
            managerName: team.manager_name,
            teamName: team.entry_name,
            totalPoints: totalsMap[team.id] || 0,
            eventTotal: eventMap[team.id] || 0,
          }))
          .sort((a: any, b: any) => b.totalPoints - a.totalPoints)
          .map((team: any, index: number) => ({
            rank: index + 1,
            ...team,
            rankSort: team.totalPoints,
            lastRank: null,
          }));

        return c.json({
          leagueId: dbContext.leagueId,
          leagueName: dbContext.leagueName || "FFA League",
          currentGameweek: eventGw,
          hasSeasonState: dbContext.hasSeasonState,
          standings,
          source: "database",
        });
      }
    }

    const entryId = c.req.query("entryId") || STATIC_ENTRY_ID;
    const leagueIdOverride = c.req.query("leagueId");
    const leagueIdValue = leagueIdOverride ? Number.parseInt(leagueIdOverride, 10) : null;
    try {
      const { details, leagueId } = await resolveDraftLeagueDetails(entryId, leagueIdValue);
      const bootstrap = await fetchDraftBootstrap();
      const currentEvent =
        bootstrap.events?.find((e: any) => e.is_current)?.id ??
        bootstrap.events?.[0]?.id ??
        1;

      const entries = details?.league_entries || [];
      const standings = entries
        .map((entry: any) => ({
          managerName: formatDraftManagerName(entry),
          teamName: formatDraftTeamName(entry),
          totalPoints: coerceNumber(entry.total_points ?? entry.points),
          eventTotal: coerceNumber(entry.event_total ?? entry.event_points),
        }))
        .sort((a: any, b: any) => b.totalPoints - a.totalPoints)
        .map((team: any, index: number) => ({
          rank: index + 1,
          ...team,
          rankSort: team.totalPoints,
          lastRank: null,
        }));

      return c.json({
        leagueId,
        leagueName: details?.league?.name ?? "Draft League",
        currentGameweek: currentEvent,
        hasSeasonState: false,
        standings,
        source: "draft",
      });
    } catch (_draftErr: any) {
      // Fallback for classic FPL entry IDs.
      const classic = await fetchClassicLeagueStandings(entryId);
      const bootstrap = await fetchJSON<any>(`${FPL_BASE_URL}/bootstrap-static/`);
      const currentEvent =
        bootstrap.events?.find((e: any) => e.is_current)?.id ??
        bootstrap.events?.[0]?.id ??
        1;

      const standings = (classic.standings || []).map((entry: any, index: number) => ({
        rank: coerceNumber(entry.rank, index + 1),
        managerName: entry.player_name ?? "Manager",
        teamName: entry.entry_name ?? entry.player_name ?? "Team",
        totalPoints: coerceNumber(entry.total ?? entry.total_points ?? entry.points),
        eventTotal: coerceNumber(entry.event_total),
        rankSort: coerceNumber(entry.total ?? entry.total_points ?? entry.points),
        lastRank: coerceNumber(entry.last_rank, null as any),
      }));

      return c.json({
        leagueId: classic.leagueId,
        leagueName: classic.leagueName,
        currentGameweek: currentEvent,
        hasSeasonState: false,
        standings,
        source: "classic",
      });
    }
  } catch (err: any) {
    return jsonError(c, 500, err.message || "Failed to fetch league standings");
  }
});

// --------------------
// Cup Group Stage (Auto-Registered)
// --------------------

const cupGroupStage = new Hono();

cupGroupStage.get("/", async (c) => {
  try {
    // DB-first
    const supabase = getSupabaseAdmin();
    const { data: teams, error: teamsError } = await supabase
      .from("teams")
      .select("id, entry_name, manager_name, manager_short_name");

    if (!teamsError && (teams || []).length > 0) {
      const teamIds = (teams || []).map((t: any) => t.id);
      const { data: tournament } = await supabase
        .from("tournaments")
        .select("id, start_gameweek, group_stage_gameweeks")
        .eq("entry_id", STATIC_ENTRY_ID)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let standings: any[] = [];
      if (tournament) {
        const startGW = tournament.start_gameweek || 1;
        const endGW = startGW + (tournament.group_stage_gameweeks || 4) - 1;
        const { data: scores } = await supabase
          .from("gameweek_scores")
          .select("team_id, total_points, captain_points, gameweek")
          .in("team_id", teamIds)
          .gte("gameweek", startGW)
          .lte("gameweek", endGW);

        const map: Record<string, any> = {};
        (teams || []).forEach((t: any) => {
          map[t.id] = {
            team_id: t.id,
            entry_name: t.entry_name,
            manager_name: t.manager_name,
            manager_short_name: t.manager_short_name,
            total_points: 0,
            captain_points: 0,
            played: 0,
          };
        });
        (scores || []).forEach((s: any) => {
          if (!map[s.team_id]) return;
          map[s.team_id].total_points += s.total_points || 0;
          map[s.team_id].captain_points += s.captain_points || 0;
          map[s.team_id].played += 1;
        });
        standings = Object.values(map)
          .sort((a: any, b: any) => b.total_points - a.total_points || b.captain_points - a.captain_points)
          .map((row: any, index: number) => ({ ...row, rank: index + 1 }));
      } else {
        standings = (teams || []).map((t: any, index: number) => ({
          team_id: t.id,
          entry_name: t.entry_name,
          manager_name: t.manager_name,
          manager_short_name: t.manager_short_name,
          total_points: 0,
          captain_points: 0,
          played: 0,
          rank: index + 1,
        }));
      }

      return c.json({
        registeredCount: standings.length,
        standings,
        autoRegistered: true,
        source: "database",
      });
    }

    const entryId = c.req.query("entryId") || STATIC_ENTRY_ID;
    const leagueIdOverride = c.req.query("leagueId");
    const leagueIdValue = leagueIdOverride ? Number.parseInt(leagueIdOverride, 10) : null;
    try {
      const { details } = await resolveDraftLeagueDetails(entryId, leagueIdValue);
      const entries = details?.league_entries || [];
      const matches = details?.matches || [];

      const statsByEntry: Record<string, { wins: number; draws: number; losses: number; plus: number; played: number }> = {};
      entries.forEach((entry: any) => {
        const id = entry.id ?? entry.league_entry_id ?? entry.entry_id ?? entry.entry;
        if (id) statsByEntry[String(id)] = { wins: 0, draws: 0, losses: 0, plus: 0, played: 0 };
      });

      matches.forEach((m: any) => {
        const entry1 = m.league_entry_1 ?? m.entry_1 ?? m.home;
        const entry2 = m.league_entry_2 ?? m.entry_2 ?? m.away;
        const points1 = m.league_entry_1_points ?? m.score_1 ?? m.home_score;
        const points2 = m.league_entry_2_points ?? m.score_2 ?? m.away_score;
        if (!entry1 || !entry2 || points1 == null || points2 == null) return;
        const p1 = coerceNumber(points1);
        const p2 = coerceNumber(points2);
        const s1 = statsByEntry[String(entry1)];
        const s2 = statsByEntry[String(entry2)];
        if (!s1 || !s2) return;

        s1.played += 1;
        s2.played += 1;
        s1.plus += p1 - p2;
        s2.plus += p2 - p1;

        if (p1 > p2) {
          s1.wins += 1;
          s2.losses += 1;
        } else if (p2 > p1) {
          s2.wins += 1;
          s1.losses += 1;
        } else {
          s1.draws += 1;
          s2.draws += 1;
        }
      });

      const standings = entries
        .map((entry: any) => {
          const id = entry.id ?? entry.league_entry_id ?? entry.entry_id ?? entry.entry;
          const stats = statsByEntry[String(id)] || { wins: 0, draws: 0, losses: 0, plus: 0, played: 0 };
          return {
            team_id: id,
            entry_name: formatDraftTeamName(entry),
            manager_name: formatDraftManagerName(entry),
            manager_short_name: entry.short_name ?? null,
            total_points: coerceNumber(entry.event_total ?? entry.event_points),
            captain_points: 0,
            played: stats.played,
            wins: stats.wins,
            draws: stats.draws,
            losses: stats.losses,
            plus: stats.plus,
          };
        })
        .sort((a: any, b: any) => b.total_points - a.total_points)
        .map((team: any, index: number) => ({
          ...team,
          rank: index + 1,
        }));

      return c.json({
        registeredCount: standings.length,
        standings,
        autoRegistered: true,
        source: "draft",
      });
    } catch (_draftErr: any) {
      // Classic fallback.
      let standings: any[] = [];
      try {
        const h2h = await fetchClassicH2HStandings(entryId);
        standings = (h2h.standings || []).map((entry: any, index: number) => ({
          team_id: entry.entry ?? entry.entry_id ?? String(index + 1),
          entry_name: entry.entry_name ?? entry.player_name ?? "Team",
          manager_name: entry.player_name ?? "Manager",
          manager_short_name: null,
          total_points: coerceNumber(entry.points),
          captain_points: 0,
          played: coerceNumber(entry.matches_played),
          wins: coerceNumber(entry.matches_won),
          draws: coerceNumber(entry.matches_drawn),
          losses: coerceNumber(entry.matches_lost),
          plus: coerceNumber(entry.points_for) - coerceNumber(entry.points_against),
          rank: coerceNumber(entry.rank, index + 1),
        }));
      } catch {
        const classic = await fetchClassicLeagueStandings(entryId);
        standings = (classic.standings || []).map((entry: any, index: number) => ({
          team_id: entry.entry ?? entry.entry_id ?? String(index + 1),
          entry_name: entry.entry_name ?? entry.player_name ?? "Team",
          manager_name: entry.player_name ?? "Manager",
          manager_short_name: null,
          total_points: coerceNumber(entry.event_total),
          captain_points: 0,
          played: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          plus: 0,
          rank: coerceNumber(entry.rank, index + 1),
        }));
      }

      return c.json({
        registeredCount: standings.length,
        standings,
        autoRegistered: true,
        source: "classic",
      });
    }
  } catch (err: any) {
    return jsonError(c, 500, err.message || "Failed to fetch cup group stage");
  }
});

// --------------------
// Goblet Standings
// --------------------

const gobletStandings = new Hono();

gobletStandings.get("/", async (c) => {
  try {
    // DB-first
    const supabase = getSupabaseAdmin();
    try {
      await syncCurrentSeasonLegacyStats(supabase);
    } catch {
      // Continue with live reads even if legacy sync fails.
    }
    let latestCompletedEvent: number | null = null;
    try {
      const bootstrap = await fetchDraftBootstrap();
      latestCompletedEvent = extractLatestCompletedDraftEventId(bootstrap);
    } catch {
      latestCompletedEvent = null;
    }

    const { data: dbMatchups, error: dbMatchupsError } = await supabase
      .from("h2h_matchups")
      .select("team_1_id, team_2_id, gameweek, team_1_points, team_2_points");

    if (!dbMatchupsError && (dbMatchups || []).length > 0) {
      const agg: Record<string, any> = {};
      (dbMatchups || [])
        .filter((m: any) =>
          latestCompletedEvent ? coerceNumber(m.gameweek) <= latestCompletedEvent : true
        )
        .forEach((m: any) => {
          if (!agg[m.team_1_id]) {
            agg[m.team_1_id] = { team_id: m.team_1_id, points_for: 0, total_points: 0, rounds: 0 };
          }
          if (!agg[m.team_2_id]) {
            agg[m.team_2_id] = { team_id: m.team_2_id, points_for: 0, total_points: 0, rounds: 0 };
          }

          const p1 = coerceNumber(m.team_1_points);
          const p2 = coerceNumber(m.team_2_points);
          agg[m.team_1_id].points_for += p1;
          agg[m.team_2_id].points_for += p2;
          agg[m.team_1_id].total_points = agg[m.team_1_id].points_for;
          agg[m.team_2_id].total_points = agg[m.team_2_id].points_for;
          agg[m.team_1_id].rounds += 1;
          agg[m.team_2_id].rounds += 1;
        });

      const teamIds = Object.keys(agg);
      if (teamIds.length > 0) {
        const { data: teams } = await supabase
          .from("teams")
          .select("id, entry_name, manager_name")
          .in("id", teamIds);
        (teams || []).forEach((t: any) => {
          if (!agg[t.id]) return;
          agg[t.id].entry_name = t.entry_name;
          agg[t.id].manager_name = t.manager_name;
        });
      }

      const standings = Object.values(agg)
        .sort((a: any, b: any) => b.points_for - a.points_for)
        .map((row: any, idx: number) => ({ ...row, rank: idx + 1 }));

      const hasNonZeroPointsFor = standings.some((row: any) => coerceNumber(row.points_for) > 0);
      if (hasNonZeroPointsFor) {
        return c.json({ standings, source: "database" });
      }
    }

    const { data: gobletData, error: gobletError } = await supabase
      .from("goblet_standings")
      .select(`
        team_id,
        round,
        points,
        total_points,
        teams (
          entry_name,
          manager_name
        )
      `)
      .order("round", { ascending: false })
      .order("total_points", { ascending: false });

    if (!gobletError && (gobletData || []).length > 0) {
      const agg: Record<string, any> = {};
      (gobletData || []).forEach((row: any) => {
        if (!agg[row.team_id]) {
          agg[row.team_id] = {
            team_id: row.team_id,
            entry_name: row.teams?.entry_name,
            manager_name: row.teams?.manager_name,
            points_for: 0,
            total_points: 0,
            rounds: 0,
          };
        }
        const roundPoints = coerceNumber(row.points);
        agg[row.team_id].points_for += roundPoints;
        agg[row.team_id].total_points = Math.max(
          agg[row.team_id].total_points,
          coerceNumber(row.total_points, roundPoints),
        );
        agg[row.team_id].rounds += 1;
      });

      const standings = Object.values(agg)
        .sort((a: any, b: any) => b.points_for - a.points_for)
        .map((row: any, idx: number) => ({ ...row, rank: idx + 1 }));

      return c.json({ standings, source: "database" });
    }

    const entryId = c.req.query("entryId") || STATIC_ENTRY_ID;
    const leagueIdOverride = c.req.query("leagueId");
    const leagueIdValue = leagueIdOverride ? Number.parseInt(leagueIdOverride, 10) : null;
    try {
      const { details } = await resolveDraftLeagueDetails(entryId, leagueIdValue);
      const entries = normalizeDraftList<any>(details?.league_entries);
      const matches = normalizeDraftList<any>(details?.matches);

      const pointsMap: Record<string, any> = {};
      entries.forEach((entry: any) => {
        const id = entry.id ?? entry.league_entry_id ?? entry.entry_id ?? entry.entry;
        if (!id) return;
        pointsMap[String(id)] = {
          team_id: id,
          entry_name: formatDraftTeamName(entry),
          manager_name: formatDraftManagerName(entry),
          points_for: 0,
        };
      });

      matches.forEach((m: any) => {
        if (latestCompletedEvent && coerceNumber(m.event) > latestCompletedEvent) return;
        const entry1 = m.league_entry_1 ?? m.entry_1 ?? m.home;
        const entry2 = m.league_entry_2 ?? m.entry_2 ?? m.away;
        if (!entry1 || !entry2) return;
        if (!pointsMap[String(entry1)] || !pointsMap[String(entry2)]) return;
        const p1 = coerceNumber(m.league_entry_1_points ?? m.score_1 ?? m.home_score);
        const p2 = coerceNumber(m.league_entry_2_points ?? m.score_2 ?? m.away_score);
        pointsMap[String(entry1)].points_for += p1;
        pointsMap[String(entry2)].points_for += p2;
      });

      const standings = Object.values(pointsMap)
        .sort((a: any, b: any) => b.points_for - a.points_for)
        .map((team: any, index: number) => ({
          ...team,
          total_points: team.points_for,
          rank: index + 1,
        }));

      return c.json({ standings, source: "draft" });
    } catch (_draftErr: any) {
      const classic = await fetchClassicLeagueStandings(entryId);
      const standings = (classic.standings || [])
        .map((entry: any, index: number) => ({
          team_id: entry.entry ?? entry.entry_id ?? String(index + 1),
          entry_name: entry.entry_name ?? entry.player_name ?? "Team",
          manager_name: entry.player_name ?? "Manager",
          points_for: coerceNumber(entry.event_total),
        }))
        .sort((a: any, b: any) => b.points_for - a.points_for)
        .map((team: any, index: number) => ({
          ...team,
          total_points: team.points_for,
          rank: index + 1,
        }));
      return c.json({ standings, source: "classic" });
    }
  } catch (err: any) {
    return jsonError(c, 500, err.message || "Failed to fetch goblet standings");
  }
});

// --------------------
// Manager Insights
// --------------------

const managerInsights = new Hono();

managerInsights.get("/", async (c) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data: teams, error: teamsError } = await supabase
      .from("teams")
      .select("id, entry_id, entry_name, manager_name");

    if (teamsError) {
      return jsonError(c, 500, "Failed to fetch teams", teamsError.message);
    }

    const teamIds = teams?.map((t) => t.id) || [];

    if (teamIds.length === 0) {
      return c.json({ insights: [] });
    }

    // Fetch all gameweek scores for these teams
    const { data: scores, error: scoresError } = await supabase
      .from("gameweek_scores")
      .select("team_id, gameweek, total_points, captain_points, bench_points")
      .in("team_id", teamIds)
      .order("gameweek", { ascending: true });

    if (scoresError) {
      return jsonError(c, 500, "Failed to fetch scores", scoresError.message);
    }

    // Calculate insights per manager
    const insightsMap: Record<string, any> = {};

    teams?.forEach((team) => {
      const teamScores = (scores || []).filter((s) => s.team_id === team.id);
      const gameweeks = teamScores.length;
      const totalPoints = teamScores.reduce((sum, s) => sum + (s.total_points || 0), 0);
      const avgPoints = gameweeks > 0 ? totalPoints / gameweeks : 0;
      const captainPoints = teamScores.reduce((sum, s) => sum + (s.captain_points || 0), 0);
      const benchPoints = teamScores.reduce((sum, s) => sum + (s.bench_points || 0), 0);

      // Calculate variance for consistency
      const variance =
        gameweeks > 0
          ? teamScores.reduce((sum, s) => {
              const diff = (s.total_points || 0) - avgPoints;
              return sum + diff * diff;
            }, 0) / gameweeks
          : 0;
      const stdDev = Math.sqrt(variance);

      // Captain efficiency (captain points / total captain opportunities)
      const captainEfficiency = gameweeks > 0 ? captainPoints / gameweeks : 0;

      insightsMap[team.id] = {
        team_id: team.id,
        entry_name: team.entry_name,
        manager_name: team.manager_name,
        gameweeks_played: gameweeks,
        total_points: totalPoints,
        average_points_per_gameweek: Math.round(avgPoints * 100) / 100,
        captain_efficiency: Math.round(captainEfficiency * 100) / 100,
        total_captain_points: captainPoints,
        total_bench_points: benchPoints,
        consistency_std_dev: Math.round(stdDev * 100) / 100,
        consistency_variance: Math.round(variance * 100) / 100,
        highest_gameweek: gameweeks > 0
          ? Math.max(...teamScores.map((s) => s.total_points || 0))
          : 0,
        lowest_gameweek: gameweeks > 0
          ? Math.min(...teamScores.map((s) => s.total_points || 0))
          : 0,
      };
    });

    return c.json({ insights: Object.values(insightsMap) });
  } catch (err: any) {
    return jsonError(c, 500, err.message || "Failed to fetch manager insights");
  }
});

managerInsights.get("/:teamId", async (c) => {
  try {
    const teamId = c.req.param("teamId");
    const supabase = getSupabaseAdmin();

    const { data: team } = await supabase
      .from("teams")
      .select("id, entry_id, entry_name, manager_name")
      .eq("id", teamId)
      .single();

    if (!team) {
      return jsonError(c, 404, "Team not found");
    }

    // Fetch historical data for this manager across seasons
    const { data: history } = await supabase
      .from("league_history")
      .select("*")
      .eq("entry_id", team.entry_id)
      .order("season", { ascending: false });

    // Fetch current season scores
    const { data: scores } = await supabase
      .from("gameweek_scores")
      .select("gameweek, total_points, captain_points, bench_points")
      .eq("team_id", teamId)
      .order("gameweek", { ascending: true });

    const gameweeks = (scores || []).length;
    const totalPoints = (scores || []).reduce((sum, s) => sum + (s.total_points || 0), 0);
    const avgPoints = gameweeks > 0 ? totalPoints / gameweeks : 0;

    return c.json({
      team,
      current_season: {
        gameweeks_played: gameweeks,
        total_points: totalPoints,
        average_points: Math.round(avgPoints * 100) / 100,
        gameweek_scores: scores || [],
      },
      historical_seasons: history || [],
    });
  } catch (err: any) {
    return jsonError(c, 500, err.message || "Failed to fetch manager insights");
  }
});

// --------------------
// Player Insights
// --------------------

const playerInsights = new Hono();

playerInsights.get("/", async (c) => {
  try {
    const supabase = getSupabaseAdmin();
    const filterPosition = parsePositiveInt(c.req.query("position"));
    const filterTeam = parsePositiveInt(c.req.query("team"));
    const filterAvailability = String(c.req.query("availability") || "").trim().toLowerCase();
    const filterSearch = String(c.req.query("search") || "").trim().toLowerCase();

    const [draftBootstrapRes, classicBootstrapRes] = await Promise.allSettled([
      fetchDraftBootstrap(),
      fetchJSON<any>(`${FPL_BASE_URL}/bootstrap-static/`),
    ]);
    const draftBootstrap = draftBootstrapRes.status === "fulfilled" ? draftBootstrapRes.value : null;
    const classicBootstrap = classicBootstrapRes.status === "fulfilled" ? classicBootstrapRes.value : null;

    const draftPlayers = normalizeDraftList<any>(
      draftBootstrap?.elements?.data ??
        draftBootstrap?.elements ??
        draftBootstrap?.players ??
        [],
    );
    const classicPlayers = normalizeDraftList<any>(
      classicBootstrap?.elements?.data ??
        classicBootstrap?.elements ??
        classicBootstrap?.players ??
        [],
    );
    const classicById: Record<number, any> = {};
    classicPlayers.forEach((p: any) => {
      const id = parsePositiveInt(p?.id ?? p?.element ?? p?.element_id);
      if (!id) return;
      classicById[id] = p;
    });
    const rawPlayers = classicPlayers.length > 0 ? classicPlayers : draftPlayers;

    const byPlayerFromBootstrap: Record<number, any> = {};
    rawPlayers.forEach((p: any) => {
      const playerId = parsePositiveInt(p?.id ?? p?.element ?? p?.element_id);
      if (!playerId) return;
      const pClassic = classicById[playerId] || {};
      const draftRow = draftPlayers.find((d: any) =>
        parsePositiveInt(d?.id ?? d?.element ?? d?.element_id) === playerId,
      ) || {};
      const merged = { ...pClassic, ...draftRow, ...p };

      const playerName =
        String(
          merged?.web_name ??
            merged?.name ??
            `${merged?.first_name ?? ""} ${merged?.second_name ?? ""}`.trim(),
        ).trim() || `Player ${playerId}`;
      const position = parsePositiveInt(merged?.element_type ?? merged?.position);
      const team = parsePositiveInt(merged?.team);
      const status = String(merged?.status ?? merged?.availability ?? "a").toLowerCase();
      const minutes = coerceNumber(merged?.minutes ?? merged?.stats?.minutes);
      const totalPoints = coerceNumber(merged?.total_points ?? merged?.stats?.total_points);
      const goals = coerceNumber(merged?.goals_scored ?? merged?.stats?.goals_scored);
      const assists = coerceNumber(merged?.assists ?? merged?.stats?.assists);
      const defensiveContributions = coerceNumber(
        merged?.defensive_contributions ?? merged?.stats?.defensive_contributions,
        coerceNumber(merged?.recoveries ?? merged?.stats?.recoveries, 0),
      );
      const threshold = position === 2 ? 10 : position === 3 || position === 4 ? 12 : 0;
      const defContribReturns = threshold > 0 ? Math.floor(defensiveContributions / threshold) : 0;
      const gamesPlayedRaw = coerceNumber(
        merged?.appearances ?? merged?.stats?.appearances ?? merged?.starts ?? merged?.stats?.starts,
        minutes > 0 ? Math.max(1, Math.round(minutes / 90)) : 0,
      );
      const gamesPlayed = Math.max(0, gamesPlayedRaw);
      const gamesHome = coerceNumber(merged?.games_home ?? merged?.stats?.games_home ?? merged?.starts_home, 0);
      const gamesAway = coerceNumber(merged?.games_away ?? merged?.stats?.games_away ?? merged?.starts_away, 0);
      const pointsHome = coerceNumber(
        merged?.points_home ?? merged?.stats?.points_home ?? merged?.total_points_home,
        0,
      );
      const pointsAway = coerceNumber(
        merged?.points_away ?? merged?.stats?.points_away ?? merged?.total_points_away,
        0,
      );
      const avgPointsHome = gamesHome > 0
        ? pointsHome / gamesHome
        : null;
      const avgPointsAway = gamesAway > 0
        ? pointsAway / gamesAway
        : null;

      byPlayerFromBootstrap[playerId] = {
        player_id: playerId,
        player_name: playerName,
        position: position || null,
        team: team || null,
        availability: status,
        selected_by_percent: coerceNumber(
          merged?.selected_by_percent ?? merged?.percent_selected ?? merged?.selected,
          0,
        ),
        total_points: totalPoints,
        goals_scored: goals,
        assists,
        defensive_contributions: defensiveContributions,
        defensive_contribution_returns: defContribReturns,
        games_played: gamesPlayed,
        minutes_played: minutes,
        points_per_game_played: gamesPlayed > 0 ? totalPoints / gamesPlayed : 0,
        minutes_per_game_played: gamesPlayed > 0 ? minutes / gamesPlayed : 0,
        points_per_minute_played: minutes > 0 ? totalPoints / minutes : 0,
        points_per_90_played: minutes > 0 ? (totalPoints / minutes) * 90 : 0,
        average_points_home: avgPointsHome,
        average_points_away: avgPointsAway,
      };
    });

    // Determine current gameweek for ownership calculation
    let currentGw = null;
    try {
      const bootstrap = await fetchDraftBootstrap();
      currentGw = extractDraftCurrentEventId(bootstrap);
    } catch {
      const { data: seasonState } = await supabase
        .from("season_state")
        .select("current_gameweek")
        .eq("season", CURRENT_SEASON)
        .maybeSingle();
      currentGw = parsePositiveInt(seasonState?.current_gameweek) || null;
    }

    // Build owners map for current gameweek
    const ownersMap: Record<number, string[]> = {};
    if (currentGw) {
      const { data: ownersRows } = await supabase
        .from("player_selections")
        .select("player_id, team_id, teams(entry_name)")
        .eq("gameweek", currentGw);
      if (ownersRows) {
        ownersRows.forEach((r: any) => {
          const id = Number(r.player_id);
          if (!ownersMap[id]) ownersMap[id] = [];
          const entryName = r?.teams?.entry_name || null;
          if (entryName && !ownersMap[id].includes(entryName)) ownersMap[id].push(entryName);
        });
      }
    }

    // Build team id -> name map from bootstrap/team data
    const teamMap: Record<number, string> = {};
    const sourceTeams = [
      ...normalizeDraftList<any>(draftBootstrap?.teams || draftBootstrap?.elements?.teams || []),
      ...normalizeDraftList<any>(classicBootstrap?.teams || classicBootstrap?.elements?.teams || []),
    ];
    sourceTeams.forEach((t: any) => {
      const id = parsePositiveInt(t?.id ?? t?.team);
      if (!id || teamMap[id]) return;
      teamMap[id] = t?.name || t?.short_name || String(t?.id);
    });

    // Fetch player selection data from database
    // This would come from a player_selections table that tracks which players
    // are selected by which teams each gameweek
    const { data: selections, error: selectionsError } = await supabase
      .from("player_selections")
      .select(`
        player_id,
        player_name,
        team_id,
        gameweek,
        is_captain,
        points_earned,
        teams (
          entry_name
        )
      `)
      .order("gameweek", { ascending: false });

    if (selectionsError && !isMissingRelationError(selectionsError)) {
      return jsonError(c, 500, "Failed to fetch player selections", selectionsError.message);
    }

    if (!selections || selections.length === 0) {
      const fallbackInsights = Object.values(byPlayerFromBootstrap)
        .map((p: any) => ({
          ...p,
          owned_by: ownersMap[p.player_id] || [],
          ownership_status: (ownersMap[p.player_id] || []).length > 0 ? `Owned by ${(ownersMap[p.player_id] || []).join(", ")}` : "Unowned",
          team_name: teamMap[p.team] || null,
          total_minutes: p.minutes_played ?? 0,
        }))
        .sort((a: any, b: any) => {
          const bySelected = coerceNumber(b.selected_by_percent) - coerceNumber(a.selected_by_percent);
          if (bySelected !== 0) return bySelected;
          return coerceNumber(b.total_points) - coerceNumber(a.total_points);
        });

      const filtered = fallbackInsights.filter((row: any) => {
        if (filterPosition && coerceNumber(row.position) !== filterPosition) return false;
        if (filterTeam && coerceNumber(row.team) !== filterTeam) return false;
        if (filterAvailability && String(row.availability || "").toLowerCase() !== filterAvailability) return false;
        if (filterSearch && !String(row.player_name || "").toLowerCase().includes(filterSearch)) return false;
        return true;
      });

      return c.json({
        insights: filtered,
        source: "fpl_bootstrap",
      });
    }

    // Aggregate player insights
    const playerMap: Record<number, any> = {};
    (selections || []).forEach((sel: any) => {
      if (!playerMap[sel.player_id]) {
        playerMap[sel.player_id] = {
          player_id: sel.player_id,
          player_name: sel.player_name,
          selected_count: 0,
          captain_count: 0,
          total_points_contributed: 0,
          teams: new Set<string>(),
        };
      }
      playerMap[sel.player_id].selected_count += 1;
      if (sel.is_captain) {
        playerMap[sel.player_id].captain_count += 1;
      }
      playerMap[sel.player_id].total_points_contributed += sel.points_earned || 0;
      playerMap[sel.player_id].teams.add(sel.team_id);
    });

    const insights = Object.values(playerMap).map((p: any) => {
      const ownedBy = ownersMap[p.player_id] || [];
      return {
        player_id: p.player_id,
        player_name: p.player_name,
        selected_count: p.selected_count,
        captain_count: p.captain_count,
        captain_frequency: p.selected_count > 0 ? (p.captain_count / p.selected_count) * 100 : 0,
        total_points_contributed: p.total_points_contributed,
        teams_using: p.teams.size,
        ...byPlayerFromBootstrap[p.player_id],
        owned_by: ownedBy,
        ownership_status: ownedBy.length > 0 ? `Owned by ${ownedBy.join(", ")}` : "Unowned",
        team_name: teamMap[byPlayerFromBootstrap[p.player_id]?.team] || null,
        total_minutes: byPlayerFromBootstrap[p.player_id]?.minutes_played ?? 0,
        points: byPlayerFromBootstrap[p.player_id]?.total_points ?? 0,
      };
    });

    const filtered = insights.filter((row: any) => {
      if (filterPosition && coerceNumber(row.position) !== filterPosition) return false;
      if (filterTeam && coerceNumber(row.team) !== filterTeam) return false;
      if (filterAvailability && String(row.availability || "").toLowerCase() !== filterAvailability) return false;
      if (filterSearch && !String(row.player_name || "").toLowerCase().includes(filterSearch)) return false;
      return true;
    });

    return c.json({
      insights: filtered.sort((a: any, b: any) => coerceNumber(b.selected_count) - coerceNumber(a.selected_count)),
      source: "database",
    });
  } catch (err: any) {
    return jsonError(c, 500, err.message || "Failed to fetch player insights");
  }
});

// --------------------
// H2H Standings
// --------------------

const h2hStandings = new Hono();
const h2hMatchups = new Hono();
const h2hRivalries = new Hono();

// --------------------
// Player History Endpoint
// --------------------

const playerHistory = new Hono();

playerHistory.get("/", async (c) => {
  try {
    const playerId = parsePositiveInt(c.req.query("player_id"));
    if (!playerId) return jsonError(c, 400, "Missing or invalid player_id");

    const supabase = getSupabaseAdmin();
    const { data: rows, error } = await supabase
      .from("player_selections")
      .select("gameweek, points_earned, is_captain, team_id")
      .eq("player_id", playerId)
      .order("gameweek", { ascending: false })
      .limit(100);

    if (error && !isMissingRelationError(error)) {
      return jsonError(c, 500, "Failed to fetch player history", error.message);
    }

    const teamIds = Array.from(new Set((rows || []).map((r: any) => String(r.team_id)))).filter(Boolean);
    const teamsMap: Record<string, any> = {};
    if (teamIds.length > 0) {
      const { data: teams } = await supabase.from("teams").select("id, entry_name").in("id", teamIds as any[]);
      (teams || []).forEach((t: any) => { teamsMap[String(t.id)] = t.entry_name || null; });
    }

    const history = (rows || []).map((r: any) => ({
      gameweek: r.gameweek,
      points: r.points_earned ?? 0,
      is_captain: !!r.is_captain,
      team_entry_name: teamsMap[String(r.team_id)] || null,
    }));

    return c.json({ player_id: playerId, history });
  } catch (err: any) {
    return jsonError(c, 500, err.message || "Failed to fetch player history");
  }
});

h2hStandings.get("/", async (c) => {
  try {
    const supabase = getSupabaseAdmin();
    try {
      await syncCurrentSeasonLegacyStats(supabase);
    } catch {
      // Continue with live reads even if legacy sync fails.
    }
    let latestCompletedEvent: number | null = null;
    try {
      const bootstrap = await fetchDraftBootstrap();
      latestCompletedEvent = extractLatestCompletedDraftEventId(bootstrap);
    } catch {
      latestCompletedEvent = null;
    }

    // DB-first
    const { data: dbMatchups, error: dbError } = await supabase
      .from("h2h_matchups")
      .select("team_1_id, team_2_id, gameweek, team_1_points, team_2_points, winner_id");

    if (!dbError && (dbMatchups || []).length > 0) {
      const map: Record<string, any> = {};
      (dbMatchups || [])
        .filter((m: any) =>
          latestCompletedEvent ? coerceNumber(m.gameweek) <= latestCompletedEvent : true
        )
        .forEach((m: any) => {
        if (!map[m.team_1_id]) map[m.team_1_id] = { team_id: m.team_1_id, wins: 0, losses: 0, draws: 0, points_for: 0, points_against: 0 };
        if (!map[m.team_2_id]) map[m.team_2_id] = { team_id: m.team_2_id, wins: 0, losses: 0, draws: 0, points_for: 0, points_against: 0 };

        const p1 = m.team_1_points || 0;
        const p2 = m.team_2_points || 0;
        map[m.team_1_id].points_for += p1;
        map[m.team_1_id].points_against += p2;
        map[m.team_2_id].points_for += p2;
        map[m.team_2_id].points_against += p1;

        if (m.winner_id === m.team_1_id) {
          map[m.team_1_id].wins += 1;
          map[m.team_2_id].losses += 1;
        } else if (m.winner_id === m.team_2_id) {
          map[m.team_2_id].wins += 1;
          map[m.team_1_id].losses += 1;
        } else {
          map[m.team_1_id].draws += 1;
          map[m.team_2_id].draws += 1;
        }
      });

      const teamIds = Object.keys(map);
      if (teamIds.length > 0) {
        const { data: teams } = await supabase
          .from("teams")
          .select("id, entry_name, manager_name")
          .in("id", teamIds);
        (teams || []).forEach((t: any) => {
          if (!map[t.id]) return;
          map[t.id].entry_name = t.entry_name;
          map[t.id].manager_name = t.manager_name;
        });

        const standings = Object.values(map)
          .map((row: any) => ({
            ...row,
            played: row.wins + row.losses + row.draws,
            points: row.wins * 3 + row.draws,
          }))
          .sort((a: any, b: any) => b.points - a.points || b.points_for - a.points_for)
          .map((row: any, idx: number) => ({ ...row, rank: idx + 1 }));

        return c.json({ standings, source: "database" });
      }
    }

    const entryId = c.req.query("entryId") || STATIC_ENTRY_ID;
    const leagueIdOverride = c.req.query("leagueId");
    const leagueIdValue = leagueIdOverride ? Number.parseInt(leagueIdOverride, 10) : null;
    try {
      const { details } = await resolveDraftLeagueDetails(entryId, leagueIdValue);
      const entries = details?.league_entries || [];
      const matches = details?.matches || [];

      const entryMap = new Map<number, any>();
      entries.forEach((entry: any) => {
        const id = entry.id ?? entry.league_entry_id ?? entry.entry_id ?? entry.entry;
        if (Number.isInteger(id)) {
          entryMap.set(id, entry);
        }
      });

      const h2hMap: Record<string, any> = {};
      entries.forEach((entry: any) => {
        const id = entry.id ?? entry.league_entry_id ?? entry.entry_id ?? entry.entry;
        if (!id) return;
        h2hMap[String(id)] = {
          team_id: id,
          entry_name: formatDraftTeamName(entry),
          manager_name: formatDraftManagerName(entry),
          wins: 0,
          losses: 0,
          draws: 0,
          points_for: 0,
          points_against: 0,
        };
      });

      matches.forEach((m: any) => {
        if (latestCompletedEvent && coerceNumber(m.event) > latestCompletedEvent) {
          return;
        }
        const entry1 = m.league_entry_1 ?? m.entry_1 ?? m.home;
        const entry2 = m.league_entry_2 ?? m.entry_2 ?? m.away;
        if (!entry1 || !entry2) return;

        const points1 = coerceNumber(m.league_entry_1_points ?? m.score_1 ?? m.home_score);
        const points2 = coerceNumber(m.league_entry_2_points ?? m.score_2 ?? m.away_score);

        const team1 = h2hMap[String(entry1)];
        const team2 = h2hMap[String(entry2)];
        if (!team1 || !team2) return;

        team1.points_for += points1;
        team1.points_against += points2;
        team2.points_for += points2;
        team2.points_against += points1;

        if (points1 > points2) {
          team1.wins += 1;
          team2.losses += 1;
        } else if (points2 > points1) {
          team2.wins += 1;
          team1.losses += 1;
        } else {
          team1.draws += 1;
          team2.draws += 1;
        }
      });

      const standings = Object.values(h2hMap)
        .map((team: any) => ({
          ...team,
          played: team.wins + team.losses + team.draws,
          points: team.wins * 3 + team.draws,
        }))
        .sort((a: any, b: any) => {
          if (b.points !== a.points) return b.points - a.points;
          return b.points_for - a.points_for;
        })
        .map((team: any, index: number) => ({
          ...team,
          rank: index + 1,
        }));

      return c.json({ standings, source: "draft" });
    } catch (_draftErr: any) {
      const h2h = await fetchClassicH2HStandings(entryId);
      const standings = (h2h.standings || [])
        .map((entry: any, index: number) => ({
          team_id: entry.entry ?? entry.entry_id ?? String(index + 1),
          entry_name: entry.entry_name ?? entry.player_name ?? "Team",
          manager_name: entry.player_name ?? "Manager",
          wins: coerceNumber(entry.matches_won),
          losses: coerceNumber(entry.matches_lost),
          draws: coerceNumber(entry.matches_drawn),
          played: coerceNumber(entry.matches_played),
          points: coerceNumber(entry.points),
          points_for: coerceNumber(entry.points_for),
          points_against: coerceNumber(entry.points_against),
          rank: coerceNumber(entry.rank, index + 1),
        }))
        .sort((a: any, b: any) => {
          if (b.points !== a.points) return b.points - a.points;
          return b.points_for - a.points_for;
        })
        .map((team: any, index: number) => ({
          ...team,
          rank: index + 1,
        }));
      return c.json({ standings, source: "classic" });
    }
  } catch (err: any) {
    return jsonError(c, 500, err.message || "Failed to fetch H2H standings");
  }
});

h2hMatchups.get("/", async (c) => {
  try {
    const gameweekParam = c.req.query("gameweek");
    let gameweek = gameweekParam ? Number(gameweekParam) : 1;
    const supabase = getSupabaseAdmin();
    try {
      await syncCurrentSeasonLegacyStats(supabase);
    } catch {
      // Continue with live reads even if legacy sync fails.
    }
    if (!gameweekParam) {
      let currentEvent: number | null = null;
      let latestCompletedEvent: number | null = null;
      try {
        const bootstrap = await fetchDraftBootstrap();
        currentEvent = extractDraftCurrentEventId(bootstrap);
        latestCompletedEvent = extractLatestCompletedDraftEventId(bootstrap);
        gameweek = resolveDisplayGameweek(currentEvent, latestCompletedEvent);
      } catch {
        const context = await resolveLeagueContextFromDb(supabase);
        const fallbackCurrent = context.currentGameweek || 1;
        gameweek = fallbackCurrent;
      }
    }

    if (!gameweek) {
      return jsonError(c, 400, "Missing gameweek");
    }

    let latestCompletedForRanks: number | null = null;
    try {
      const bootstrap = await fetchDraftBootstrap();
      latestCompletedForRanks = extractLatestCompletedDraftEventId(bootstrap);
    } catch {
      latestCompletedForRanks = gameweek > 1 ? gameweek - 1 : null;
    }

    let rankMap: Record<string, number> = {};
    try {
      rankMap = await buildLeagueRankMap(supabase, latestCompletedForRanks);
    } catch {
      rankMap = {};
    }

    // DB-first
    const { data: dbMatchups, error: dbError } = await supabase
      .from("h2h_matchups")
      .select("team_1_id, team_2_id, gameweek, team_1_points, team_2_points, winner_id")
      .eq("gameweek", gameweek);

    if (!dbError && (dbMatchups || []).length > 0) {
      const teamIds = Array.from(new Set((dbMatchups || []).flatMap((m: any) => [m.team_1_id, m.team_2_id])));
      const { data: teams } = await supabase
        .from("teams")
        .select("id, entry_name, manager_name")
        .in("id", teamIds);
      const teamMap: Record<string, any> = {};
      (teams || []).forEach((t: any) => { teamMap[t.id] = t; });

      const formatted = (dbMatchups || []).map((m: any) => ({
        ...m,
        fixture_id: `league-${gameweek}-${m.team_1_id}-${m.team_2_id}`,
        team_1: teamMap[m.team_1_id] || null,
        team_2: teamMap[m.team_2_id] || null,
        team_1_rank: rankMap[String(m.team_1_id)] || null,
        team_2_rank: rankMap[String(m.team_2_id)] || null,
      }));

      return c.json({ gameweek, matchups: formatted, source: "database" });
    }

    const entryId = c.req.query("entryId") || STATIC_ENTRY_ID;
    const leagueIdOverride = c.req.query("leagueId");
    const leagueIdValue = leagueIdOverride ? Number.parseInt(leagueIdOverride, 10) : null;
    try {
      const { details } = await resolveDraftLeagueDetails(entryId, leagueIdValue);
      const entries = details?.league_entries || [];
      const matches = (details?.matches || []).filter((m: any) => m.event === gameweek);

      const entryMap: Record<string, any> = {};
      entries.forEach((entry: any) => {
        const id = entry.id ?? entry.league_entry_id ?? entry.entry_id ?? entry.entry;
        if (id) entryMap[String(id)] = entry;
      });

      const formatted = matches.map((m: any) => {
        const entry1Id = m.league_entry_1 ?? m.entry_1 ?? m.home;
        const entry2Id = m.league_entry_2 ?? m.entry_2 ?? m.away;

        return {
          team_1_id: entry1Id,
          team_2_id: entry2Id,
          gameweek,
          fixture_id: `league-${gameweek}-${entry1Id}-${entry2Id}`,
          team_1_points: coerceNumber(m.league_entry_1_points ?? m.score_1 ?? m.home_score),
          team_2_points: coerceNumber(m.league_entry_2_points ?? m.score_2 ?? m.away_score),
          winner_id: null,
          team_1: entryMap[String(entry1Id)]
            ? {
                entry_name: entryMap[String(entry1Id)].entry_name ?? entryMap[String(entry1Id)].name,
                manager_name: formatDraftManagerName(entryMap[String(entry1Id)]),
              }
            : null,
          team_2: entryMap[String(entry2Id)]
            ? {
                entry_name: entryMap[String(entry2Id)].entry_name ?? entryMap[String(entry2Id)].name,
                manager_name: formatDraftManagerName(entryMap[String(entry2Id)]),
              }
            : null,
          team_1_rank: rankMap[String(entry1Id)] || null,
          team_2_rank: rankMap[String(entry2Id)] || null,
        };
      });

      return c.json({ gameweek, matchups: formatted, source: "draft" });
    } catch (_draftErr: any) {
      // Classic fallback: derive gameweek points from each entry history.
      const classic = await fetchClassicLeagueStandings(entryId);
      const rows: any[] = [];
      for (const entry of classic.standings || []) {
        const entryKey = String(entry.entry ?? entry.entry_id ?? "");
        if (!entryKey) continue;
        try {
          const history = await fetchJSON<any>(`${FPL_BASE_URL}/entry/${entryKey}/history/`);
          const gw = (history.current || []).find((h: any) => h.event === gameweek);
          rows.push({
            entry_id: entryKey,
            entry_name: entry.entry_name ?? entry.player_name ?? "Team",
            manager_name: entry.player_name ?? "Manager",
            points: gw?.points ?? 0,
          });
        } catch {
          rows.push({
            entry_id: entryKey,
            entry_name: entry.entry_name ?? entry.player_name ?? "Team",
            manager_name: entry.player_name ?? "Manager",
            points: 0,
          });
        }
      }

      const sorted = rows.sort((a, b) => b.points - a.points);
      const formatted: any[] = [];
      for (let i = 0; i < sorted.length - 1; i += 2) {
        const t1 = sorted[i];
        const t2 = sorted[i + 1];
        formatted.push({
          team_1_id: t1.entry_id,
          team_2_id: t2.entry_id,
          gameweek,
          fixture_id: `league-${gameweek}-${t1.entry_id}-${t2.entry_id}`,
          team_1_points: t1.points,
          team_2_points: t2.points,
          winner_id: t1.points === t2.points ? null : (t1.points > t2.points ? t1.entry_id : t2.entry_id),
          team_1: { entry_name: t1.entry_name, manager_name: t1.manager_name },
          team_2: { entry_name: t2.entry_name, manager_name: t2.manager_name },
          team_1_rank: rankMap[String(t1.entry_id)] || null,
          team_2_rank: rankMap[String(t2.entry_id)] || null,
        });
      }

      return c.json({ gameweek, matchups: formatted, source: "classic-derived" });
    }
  } catch (err: any) {
    return jsonError(c, 500, err.message || "Failed to fetch matchups");
  }
});

h2hRivalries.get("/", async (c) => {
  try {
    const supabase = getSupabaseAdmin();
    try {
      await syncCurrentSeasonLegacyStats(supabase);
    } catch {
      // Continue with live reads even if legacy sync fails.
    }
    let currentEvent = 1;
    let displayEvent = 1;
    let latestCompletedEvent: number | null = null;

    try {
      const bootstrap = await fetchDraftBootstrap();
      currentEvent = extractDraftCurrentEventId(bootstrap) || 1;
      latestCompletedEvent = extractLatestCompletedDraftEventId(bootstrap);
      displayEvent = resolveDisplayGameweek(currentEvent, latestCompletedEvent);
    } catch {
      const context = await resolveLeagueContextFromDb(supabase);
      currentEvent = context.currentGameweek || 1;
      latestCompletedEvent = context.currentGameweek ? context.currentGameweek - 1 : null;
      displayEvent = resolveDisplayGameweek(currentEvent, latestCompletedEvent);
    }

    const [teamsRes, seasonMatchupsRes, thisWeekRes] = await Promise.all([
      supabase.from("teams").select("id, entry_id, entry_name, manager_name"),
      supabase
        .from("h2h_matchups")
        .select("team_1_id, team_2_id, gameweek, winner_id, team_1_points, team_2_points")
        .order("gameweek", { ascending: true }),
      supabase
        .from("h2h_matchups")
        .select("team_1_id, team_2_id, gameweek")
        .eq("gameweek", displayEvent),
    ]);

    const teams = teamsRes.data || [];
    const seasonMatchups = seasonMatchupsRes.data || [];
    const thisWeekMatchups = thisWeekRes.data || [];
    const teamMap: Record<string, { entry_name: string | null; manager_name: string | null }> = {};
    teams.forEach((t: any) => {
      const val = {
        entry_name: t.entry_name || null,
        manager_name: t.manager_name || null,
      };
      teamMap[String(t.id)] = val;
      if (t.entry_id !== null && t.entry_id !== undefined) {
        teamMap[String(t.entry_id)] = val;
      }
    });

    const seasonRows = (seasonMatchups || []).filter((m: any) =>
      latestCompletedEvent ? coerceNumber(m.gameweek) <= latestCompletedEvent : true
    );

    const unifiedAllTimeRows = await fetchUnifiedAllTimeH2H(supabase);
    const allTimeMap: Record<string, { wins: number; draws: number; losses: number }> = {};
    unifiedAllTimeRows.forEach((r: any) => {
      const manager = toCanonicalManagerName(r.manager_name) || normalizeManagerName(r.manager_name);
      const opponent = toCanonicalManagerName(r.opponent_name) || normalizeManagerName(r.opponent_name);
      if (!manager || !opponent) return;
      allTimeMap[`${manager}__${opponent}`] = {
        wins: coerceNumber(r.wins),
        draws: coerceNumber(r.draws),
        losses: coerceNumber(r.losses),
      };
    });

    function buildSeasonRecord(teamA: string, teamB: string) {
      let wins = 0;
      let draws = 0;
      let losses = 0;

      seasonRows.forEach((m: any) => {
        const left = String(m.team_1_id);
        const right = String(m.team_2_id);
        const isAB = left === teamA && right === teamB;
        const isBA = left === teamB && right === teamA;
        if (!isAB && !isBA) return;

        if (!m.winner_id) {
          draws += 1;
          return;
        }

        const winner = String(m.winner_id);
        if (winner === teamA) wins += 1;
        else if (winner === teamB) losses += 1;
      });

      return { wins, draws, losses };
    }

    function buildAllTimeRecord(managerA: string | null, managerB: string | null) {
      const managerAKey = toCanonicalManagerName(managerA) || String(managerA || "").toUpperCase();
      const managerBKey = toCanonicalManagerName(managerB) || String(managerB || "").toUpperCase();
      const merged = allTimeMap[`${managerAKey}__${managerBKey}`] || { wins: 0, draws: 0, losses: 0 };
      return {
        wins: merged.wins,
        draws: merged.draws,
        losses: merged.losses,
      };
    }

    const dbMatchups = (thisWeekMatchups || []).map((m: any) => {
      const team1 = teamMap[String(m.team_1_id)] || { entry_name: null, manager_name: null };
      const team2 = teamMap[String(m.team_2_id)] || { entry_name: null, manager_name: null };

      const season1 = buildSeasonRecord(String(m.team_1_id), String(m.team_2_id));
      const season2 = { wins: season1.losses, draws: season1.draws, losses: season1.wins };

      const allTime1 = buildAllTimeRecord(team1.manager_name, team2.manager_name);
      const allTime2 = { wins: allTime1.losses, draws: allTime1.draws, losses: allTime1.wins };

      return {
        team_1_id: m.team_1_id,
        team_2_id: m.team_2_id,
        team_1: team1,
        team_2: team2,
        current_season_record_1: season1,
        current_season_record_2: season2,
        all_time_record_1: allTime1,
        all_time_record_2: allTime2,
      };
    }).filter((m: any) => m.team_1.manager_name || m.team_2.manager_name);

    if (dbMatchups.length > 0) {
      return c.json({
        gameweek: displayEvent,
        latest_completed_gameweek: latestCompletedEvent,
        matchups: dbMatchups,
        source: "database",
      });
    }

    const entryId = c.req.query("entryId") || STATIC_ENTRY_ID;
    const leagueIdOverride = c.req.query("leagueId");
    const leagueIdValue = leagueIdOverride ? Number.parseInt(leagueIdOverride, 10) : null;
    const { details } = await resolveDraftLeagueDetails(entryId, leagueIdValue);
    const entries = normalizeDraftList<any>(details?.league_entries);
    const matches = normalizeDraftList<any>(details?.matches);

    const entryMap: Record<string, any> = {};
    entries.forEach((entry: any) => {
      const id = entry.id ?? entry.league_entry_id ?? entry.entry_id ?? entry.entry;
      if (!id) return;
      entryMap[String(id)] = entry;
    });

    const seasonDraftRows = matches.filter((m: any) =>
      latestCompletedEvent ? coerceNumber(m.event) <= latestCompletedEvent : true
    );

    function buildSeasonRecordDraft(teamA: string, teamB: string) {
      let wins = 0;
      let draws = 0;
      let losses = 0;
      seasonDraftRows.forEach((m: any) => {
        const e1 = String(m.league_entry_1 ?? m.entry_1 ?? m.home ?? "");
        const e2 = String(m.league_entry_2 ?? m.entry_2 ?? m.away ?? "");
        if (!e1 || !e2) return;
        const isAB = e1 === teamA && e2 === teamB;
        const isBA = e1 === teamB && e2 === teamA;
        if (!isAB && !isBA) return;

        const p1 = coerceNumber(m.league_entry_1_points ?? m.score_1 ?? m.home_score);
        const p2 = coerceNumber(m.league_entry_2_points ?? m.score_2 ?? m.away_score);
        if (isAB) {
          if (p1 > p2) wins += 1;
          else if (p2 > p1) losses += 1;
          else draws += 1;
        } else {
          if (p2 > p1) wins += 1;
          else if (p1 > p2) losses += 1;
          else draws += 1;
        }
      });
      return { wins, draws, losses };
    }

    const currentDraftMatchups = matches
      .filter((m: any) => coerceNumber(m.event) === displayEvent)
      .map((m: any) => {
        const team1Id = String(m.league_entry_1 ?? m.entry_1 ?? m.home ?? "");
        const team2Id = String(m.league_entry_2 ?? m.entry_2 ?? m.away ?? "");
        const team1Entry = entryMap[team1Id];
        const team2Entry = entryMap[team2Id];

        const team1 = {
          entry_name: team1Entry ? formatDraftTeamName(team1Entry) : null,
          manager_name: team1Entry ? formatDraftManagerName(team1Entry) : null,
        };
        const team2 = {
          entry_name: team2Entry ? formatDraftTeamName(team2Entry) : null,
          manager_name: team2Entry ? formatDraftManagerName(team2Entry) : null,
        };

        const season1 = buildSeasonRecordDraft(team1Id, team2Id);
        const season2 = { wins: season1.losses, draws: season1.draws, losses: season1.wins };
        const allTime1 = buildAllTimeRecord(team1.manager_name, team2.manager_name);
        const allTime2 = { wins: allTime1.losses, draws: allTime1.draws, losses: allTime1.wins };

        return {
          team_1_id: team1Id,
          team_2_id: team2Id,
          team_1: team1,
          team_2: team2,
          current_season_record_1: season1,
          current_season_record_2: season2,
          all_time_record_1: allTime1,
          all_time_record_2: allTime2,
        };
      });

    return c.json({
      gameweek: displayEvent,
      latest_completed_gameweek: latestCompletedEvent,
      matchups: currentDraftMatchups,
      source: "draft",
    });
  } catch (err: any) {
    return jsonError(c, 500, err.message || "Failed to fetch H2H rivalries");
  }
});

// --------------------
// League History
// --------------------

const leagueHistory = new Hono();

leagueHistory.get("/", async (c) => {
  try {
    const supabase = getSupabaseAdmin();

    // Fetch unified league standings (combines legacy + computed)
    // Try unified view first, fallback to individual tables
    const { data: unified, error: unifiedError } = await supabase
      .from("unified_league_standings")
      .select("*")
      .order("season", { ascending: false })
      .order("final_rank", { ascending: true });

    if (unifiedError && unifiedError.code !== "PGRST116") {
      // Fallback: fetch from legacy and computed separately
      const [legacyRes, computedRes] = await Promise.all([
        supabase
          .from("legacy_league_standings")
          .select("*")
          .lt("season", HISTORICAL_STATS_CUTOFF_SEASON)
          .order("season", { ascending: false }),
        supabase
          .from("season_standings")
          .select(`
            season,
            final_rank,
            total_points,
            wins,
            draws,
            losses,
            points_for,
            points_against,
            teams (
              entry_id,
              entry_name,
              manager_name
            )
          `)
          .gte("season", HISTORICAL_STATS_CUTOFF_SEASON)
          .order("season", { ascending: false }),
      ]);

      // Legacy data uses manager_name as primary identifier
      // entry_id and entry_name are optional
      const legacy = (legacyRes.data || []).map((l: any) => ({
        season: l.season,
        manager_name: l.manager_name,  // Primary identifier
        entry_id: l.entry_id || null,   // Optional
        entry_name: l.entry_name || null, // Optional
        final_rank: l.final_rank,
        total_points: l.total_points,
        wins: l.wins,
        draws: l.draws,
        losses: l.losses,
        points_for: l.points_for,
        points_against: l.points_against,
        source: "legacy",
      }));

      // Computed data joins on manager_name to match with legacy
      const computed = (computedRes.data || []).map((s: any) => ({
        season: s.season,
        manager_name: s.teams?.manager_name,  // Primary identifier for matching
        entry_id: s.teams?.entry_id,          // Current season's entry_id
        entry_name: s.teams?.entry_name,      // Current season's entry_name
        final_rank: s.final_rank,
        total_points: s.total_points,
        wins: s.wins,
        draws: s.draws,
        losses: s.losses,
        points_for: s.points_for,
        points_against: s.points_against,
        source: "computed",
      }));

      const allHistory = [
        ...legacy,
        ...computed,
      ];

      // Group by season
      const seasonsMap: Record<string, any[]> = {};
      allHistory.forEach((entry: any) => {
        const season = entry.season || "Unknown";
        if (!seasonsMap[season]) {
          seasonsMap[season] = [];
        }
        seasonsMap[season].push(entry);
      });

      const seasons = Object.entries(seasonsMap).map(([season, entries]) => ({
        season,
        entries: entries.sort((a: any, b: any) => (a.final_rank || 999) - (b.final_rank || 999)),
      }));

      return c.json({ seasons });
    }

    // Group unified results by season
    const seasonsMap: Record<string, any[]> = {};
    (unified || []).forEach((entry: any) => {
      const season = entry.season || "Unknown";
      if (!seasonsMap[season]) {
        seasonsMap[season] = [];
      }
      seasonsMap[season].push(entry);
    });

    const seasons = Object.entries(seasonsMap).map(([season, entries]) => ({
      season,
      entries: entries.sort((a: any, b: any) => (a.final_rank || 999) - (b.final_rank || 999)),
    }));

    return c.json({ seasons });
  } catch (err: any) {
    return jsonError(c, 500, err.message || "Failed to fetch league history");
  }
});

leagueHistory.get("/:season", async (c) => {
  try {
    const season = c.req.param("season");
    const supabase = getSupabaseAdmin();

    const { data: history, error: historyError } = await supabase
      .from("league_history")
      .select("*")
      .eq("season", season)
      .order("final_rank", { ascending: true });

    if (historyError) {
      return jsonError(c, 500, "Failed to fetch season history", historyError.message);
    }

    return c.json({ season, standings: history || [] });
  } catch (err: any) {
    return jsonError(c, 500, err.message || "Failed to fetch season history");
  }
});

// --------------------
// Live Scores (Updated for Public Mode)
// --------------------

const liveScores = new Hono();

liveScores.get("/:gameweek", async (c) => {
  try {
    const supabase = getSupabaseAdmin();
    const gameweek = Number(c.req.param("gameweek"));
    const context = await resolveLeagueContextFromDb(supabase);

    if (!gameweek) {
      return jsonError(c, 400, "Missing gameweek");
    }

    // Get teams for this league
    const { data: teams } = await supabase
      .from("teams")
      .select("id, entry_id, entry_name, manager_name, manager_short_name");

    const teamIds = teams?.map((t) => t.id) || [];

    if (teamIds.length === 0) {
      return c.json({ scores: [] });
    }

    const { data, error } = await supabase
      .from("gameweek_scores")
      .select(`
        id,
        team_id,
        gameweek,
        total_points,
        captain_points,
        bench_points,
        teams (
          entry_name,
          manager_name,
          manager_short_name,
          seed
        )
      `)
      .in("team_id", teamIds)
      .eq("gameweek", gameweek)
      .order("total_points", { ascending: false });

    if (error) {
      return jsonError(c, 500, error.message);
    }

    return c.json({ scores: data || [], hasSeasonState: context.hasSeasonState });
  } catch (err: any) {
    return jsonError(c, 500, err.message || "Failed to fetch live scores");
  }
});

// --------------------
// Current Gameweek (Public)
// --------------------

const currentGameweek = new Hono();

currentGameweek.get("/", async (c) => {
  try {
    const bootstrap = await fetchDraftBootstrap();
    const events = extractDraftEvents(bootstrap);
    const currentEventId = extractDraftCurrentEventId(bootstrap) || 1;
    const currentEvent = events.find((e: any) => parsePositiveInt(e?.id) === currentEventId) || null;

    return c.json({
      current_gameweek: currentEventId,
      deadline_time: currentEvent?.deadline_time || null,
      hasSeasonState: false,
      source: "draft",
    });
  } catch (err: any) {
    return jsonError(c, 500, err.message || "Failed to fetch current gameweek");
  }
});

// --------------------
// Manager Ratings (Public)
// --------------------

const HISTORICAL_STATS_CUTOFF_SEASON = "2025/26";

const managerRatings = new Hono();

managerRatings.get("/", async (c) => {
  try {
    const supabase = getSupabaseAdmin();

    const allTime = await computeAllTimeManagerStats(supabase);

    const { data: standings, error: standingsError } = await supabase
      .from("legacy_season_standings")
      .select("manager_name, final_rank, competition_type")
      .lt("season", HISTORICAL_STATS_CUTOFF_SEASON);

    if (standingsError) {
      return jsonError(c, 500, "Failed to fetch legacy standings", standingsError.message);
    }

    const { data: trophies, error: trophiesError } = await supabase
      .from("legacy_season_trophies")
      .select("manager_name, league_champion, cup_winner, goblet_winner")
      .lt("season", HISTORICAL_STATS_CUTOFF_SEASON);

    if (trophiesError) {
      return jsonError(c, 500, "Failed to fetch legacy trophies", trophiesError.message);
    }

    const { data: teams, error: teamsError } = await supabase
      .from("teams")
      .select("entry_id, entry_name, manager_name");

    if (teamsError) {
      return jsonError(c, 500, "Failed to fetch teams", teamsError.message);
    }

    const placementsMap: Record<string, number[]> = {};
    (standings || []).forEach((row: any) => {
      if (row.competition_type !== "league") return;
      const manager = toCanonicalManagerName(row.manager_name);
      if (!manager) return;
      if (!placementsMap[manager]) placementsMap[manager] = [];
      placementsMap[manager].push(row.final_rank);
    });

    const trophiesMap: Record<string, Array<{ league: boolean; cup: boolean; goblet: boolean }>> = {};
    (trophies || []).forEach((row: any) => {
      const manager = toCanonicalManagerName(row.manager_name);
      if (!manager) return;
      if (!trophiesMap[manager]) trophiesMap[manager] = [];
      trophiesMap[manager].push({
        league: !!row.league_champion,
        cup: !!row.cup_winner,
        goblet: !!row.goblet_winner,
      });
    });

    const ppgValues = (allTime || []).map((row: any) => coerceNumber(row.points_per_game));
    const plusGValues = (allTime || []).map((row: any) => coerceNumber(row.points_plus));
    const leaguePPGMean =
      ppgValues.length > 0 ? ppgValues.reduce((a, b) => a + b, 0) / ppgValues.length : 0;
    const leaguePlusGMean =
      plusGValues.length > 0 ? plusGValues.reduce((a, b) => a + b, 0) / plusGValues.length : 0;
    const leaguePlusGStdDev =
      plusGValues.length > 1
        ? Math.sqrt(
            plusGValues.reduce((sum, v) => sum + Math.pow(v - leaguePlusGMean, 2), 0) /
              plusGValues.length
          )
        : 0;

    const teamMap: Record<string, any> = {};
    (teams || []).forEach((team: any) => {
      const manager = toCanonicalManagerName(team.manager_name);
      if (manager) {
        teamMap[manager] = team;
      }
    });

    const ratings = (allTime || []).map((row: any) => {
      const placements = placementsMap[row.manager_name] || [];
      const trophyRows = trophiesMap[row.manager_name] || [];
      const ppg = coerceNumber(row.points_per_game);
      const plusG = coerceNumber(row.points_plus);

      const computed = computeManagerRating(
        placements,
        trophyRows,
        ppg,
        plusG,
        leaguePPGMean,
        leaguePlusGMean,
        leaguePlusGStdDev,
      );

      const team = teamMap[row.manager_name];

      return {
        team_id: team?.id ?? null,
        entry_id: team?.entry_id ?? null,
        entry_name: team?.entry_name ?? null,
        manager_name: row.manager_name,
        rating: computed.finalScore,
        rating_version: "FFA_RATING_V1",
        placement_score: computed.placementScore,
        silverware_score: computed.silverwareScore,
        ppg_score: computed.ppgPoints,
        plus_g_modifier: computed.gModifier,
        base_score: computed.baseScore,
        ppg,
        plus_g: plusG,
        seasons_played: placements.length,
      };
    }).sort((a: any, b: any) => b.rating - a.rating);

    return c.json({ ratings, source: "computed" });
  } catch (err: any) {
    return jsonError(c, 500, err.message || "Failed to fetch manager ratings");
  }
});

managerRatings.get("/history/:teamId", async (c) => {
  try {
    const teamId = c.req.param("teamId");
    const supabase = getSupabaseAdmin();

    const { data: history, error: historyError } = await supabase
      .from("manager_rating_history")
      .select("*")
      .eq("team_id", teamId)
      .order("season", { ascending: false })
      .order("gameweek", { ascending: false });

    if (historyError) {
      return jsonError(c, 500, "Failed to fetch rating history", historyError.message);
    }

    return c.json({ history: history || [] });
  } catch (err: any) {
    return jsonError(c, 500, err.message || "Failed to fetch rating history");
  }
});

managerRatings.get("/deltas/:teamId", async (c) => {
  try {
    const teamId = c.req.param("teamId");
    const season = c.req.query("season");
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from("manager_rating_deltas")
      .select("*")
      .eq("team_id", teamId)
      .order("season", { ascending: false })
      .order("gameweek", { ascending: false });

    if (season) {
      query = query.eq("season", season);
    }

    const { data: deltas, error: deltasError } = await query;

    if (deltasError) {
      return jsonError(c, 500, "Failed to fetch rating deltas", deltasError.message);
    }

    return c.json({ deltas: deltas || [] });
  } catch (err: any) {
    return jsonError(c, 500, err.message || "Failed to fetch rating deltas");
  }
});

// --------------------
// Standings by Gameweek
// --------------------

const standingsByGameweek = new Hono();

standingsByGameweek.get("/", async (c) => {
  try {
    const gameweek = c.req.query("gameweek");
    const season = c.req.query("season") || "2025/26";
    
    if (!gameweek) {
      return jsonError(c, 400, "Missing gameweek parameter");
    }

    const supabase = getSupabaseAdmin();

    // Get teams for this league
    const { data: teams } = await supabase
      .from("teams")
      .select("id, entry_id, entry_name, manager_name");

    const teamIds = teams?.map((t) => t.id) || [];

    if (teamIds.length === 0) {
      return c.json({ standings: [] });
    }

    // Fetch gameweek scores
    const { data: scores, error: scoresError } = await supabase
      .from("gameweek_scores")
      .select(`
        team_id,
        total_points,
        captain_points,
        teams (
          entry_name,
          manager_name
        )
      `)
      .in("team_id", teamIds)
      .eq("gameweek", Number(gameweek))
      .order("total_points", { ascending: false });

    if (scoresError) {
      return jsonError(c, 500, "Failed to fetch gameweek standings", scoresError.message);
    }

    const standings = (scores || []).map((s: any, index: number) => ({
      rank: index + 1,
      team_id: s.team_id,
      entry_name: s.teams?.entry_name,
      manager_name: s.teams?.manager_name,
      total_points: s.total_points || 0,
      captain_points: s.captain_points || 0,
    }));

    return c.json({
      season,
      gameweek: Number(gameweek),
      standings,
    });
  } catch (err: any) {
    return jsonError(c, 500, err.message || "Failed to fetch standings by gameweek");
  }
});

// --------------------
// Bracket (Group Stage + Knockout)
// --------------------

const bracket = new Hono();

bracket.get("/", async (c) => {
  try {
    const supabase = getSupabaseAdmin();
    const context = await resolveLeagueContextFromDb(supabase);
    let draftNameByEntryKey: Record<string, { entry_name: string; manager_name: string }> = {};
    let draftNameByManagerKey: Record<string, { entry_name: string; manager_name: string }> = {};

    try {
      const { details } = await resolveDraftLeagueDetails(STATIC_ENTRY_ID);
      const draftEntries = normalizeDraftList<any>(details?.league_entries);
      draftEntries.forEach((entry: any) => {
        const managerName = formatDraftManagerName(entry);
        const teamName = formatDraftTeamName(entry);
        const canonicalManager = toCanonicalManagerName(managerName) || normalizeManagerName(managerName);
        const keys = [
          entry.id,
          entry.league_entry_id,
          entry.entry_id,
          entry.entry,
        ].filter((v) => v !== null && v !== undefined && String(v).trim() !== "");
        keys.forEach((key) => {
          draftNameByEntryKey[String(key)] = {
            entry_name: teamName,
            manager_name: managerName,
          };
        });
        if (canonicalManager) {
          draftNameByManagerKey[canonicalManager] = {
            entry_name: teamName,
            manager_name: managerName,
          };
        }
      });
    } catch {
      draftNameByEntryKey = {};
      draftNameByManagerKey = {};
    }

    const { data: tournament, error: tournamentError } = await supabase
      .from("tournaments")
      .select("*")
      .eq("entry_id", STATIC_ENTRY_ID)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tournamentError && tournamentError.code !== "PGRST116") {
      return jsonError(c, 500, "Failed to fetch tournament", tournamentError.message);
    }

    // Fetch all teams from the database (all league members are auto-registered)
    const { data: teams, error: teamsError } = await supabase
      .from("teams")
      .select("id, entry_id, entry_name, manager_name, manager_short_name, seed");

    if (teamsError) {
      return jsonError(c, 500, "Failed to fetch teams", teamsError.message);
    }

    // If no teams exist, return empty structure but don't error
    const registeredTeams = (teams || []).map((team: any) => {
      const canonicalManager = toCanonicalManagerName(team.manager_name) || normalizeManagerName(team.manager_name);
      const override =
        draftNameByEntryKey[String(team.entry_id ?? "")] ||
        draftNameByEntryKey[String(team.id ?? "")] ||
        draftNameByManagerKey[canonicalManager] ||
        null;
      return {
        ...team,
        entry_name: override?.entry_name ?? team.entry_name,
        manager_name: override?.manager_name ?? team.manager_name,
      };
    });
    const teamIds = registeredTeams.map((t) => t.id);

    let groupStandings: any[] = [];
    let startGW: number | null = null;
    let endGW: number | null = null;

    if (tournament) {
      startGW = tournament.start_gameweek || 1;
      endGW = startGW + (tournament.group_stage_gameweeks || 4) - 1;

      if (teamIds.length > 0) {
        const { data: scores } = await supabase
          .from("gameweek_scores")
          .select("team_id, total_points, captain_points, gameweek, raw_data")
          .in("team_id", teamIds)
          .gte("gameweek", startGW)
          .lte("gameweek", endGW);

        const standingsMap: Record<string, any> = {};
        registeredTeams.forEach((t) => {
          standingsMap[t.id] = {
            team_id: t.id,
            entry_name: t.entry_name,
            manager_name: t.manager_name,
            manager_short_name: t.manager_short_name,
            total_points: 0,
            captain_points: 0,
            played: 0,
          };
        });

        (scores || []).forEach((s) => {
          if (standingsMap[s.team_id]) {
            standingsMap[s.team_id].total_points += s.total_points || 0;
            standingsMap[s.team_id].captain_points += s.captain_points || 0;
            const hasLivePayload =
              (s.total_points || 0) !== 0 ||
              (s.captain_points || 0) !== 0 ||
              (s.raw_data && typeof s.raw_data === "object" && Object.keys(s.raw_data).length > 0);
            if (hasLivePayload) {
              standingsMap[s.team_id].played += 1;
            }
          }
        });

        groupStandings = Object.values(standingsMap)
          .sort((a, b) => {
            if (b.total_points !== a.total_points) return b.total_points - a.total_points;
            return b.captain_points - a.captain_points;
          })
          .map((team, index) => ({
            ...team,
            rank: index + 1,
          }));
      }
    } else {
      groupStandings = registeredTeams.map((team, index) => ({
        team_id: team.id,
        entry_name: team.entry_name,
        manager_name: team.manager_name,
        manager_short_name: team.manager_short_name,
        total_points: 0,
        captain_points: 0,
        played: 0,
        rank: index + 1,
      }));
    }

    let rounds: Array<{ round: string; matchups: any[] }> = [];
    if (tournament) {
      const { data: matchups, error: matchupsError } = await supabase
        .from("matchups")
        .select(`
          id,
          round,
          matchup_number,
          team_1_id,
          team_2_id,
          leg_1_gameweek,
          leg_2_gameweek,
          team_1_leg_1_points,
          team_1_leg_2_points,
          team_2_leg_1_points,
          team_2_leg_2_points,
          winner_id,
          tie_breaker_applied,
          status
        `)
        .eq("tournament_id", tournament.id)
        .order("round", { ascending: true })
        .order("matchup_number", { ascending: true });

      if (matchupsError && matchupsError.code !== "PGRST116") {
        return jsonError(c, 500, "Failed to fetch matchups", matchupsError.message);
      }

      const matchupTeams = new Set<string>();
      (matchups || []).forEach((m) => {
        if (m.team_1_id) matchupTeams.add(m.team_1_id);
        if (m.team_2_id) matchupTeams.add(m.team_2_id);
      });

      const { data: matchupTeamRows } = await supabase
        .from("teams")
        .select("id, entry_id, entry_name, manager_name, seed")
        .in("id", Array.from(matchupTeams));

      const teamMap: Record<string, any> = {};
      (matchupTeamRows || []).forEach((t) => {
        const canonicalManager = toCanonicalManagerName(t.manager_name) || normalizeManagerName(t.manager_name);
        const override =
          draftNameByEntryKey[String(t.entry_id ?? "")] ||
          draftNameByEntryKey[String(t.id ?? "")] ||
          draftNameByManagerKey[canonicalManager] ||
          null;
        teamMap[t.id] = {
          ...t,
          entry_name: override?.entry_name ?? t.entry_name,
          manager_name: override?.manager_name ?? t.manager_name,
        };
      });

      const roundsMap: Record<string, any[]> = {};
      (matchups || []).forEach((m) => {
        if (!roundsMap[m.round]) roundsMap[m.round] = [];
        roundsMap[m.round].push({
          ...m,
          team_1: m.team_1_id ? teamMap[m.team_1_id] || null : null,
          team_2: m.team_2_id ? teamMap[m.team_2_id] || null : null,
        });
      });

      rounds = Object.entries(roundsMap).map(([round, matchups]) => ({
        round,
        matchups,
      }));
    }

    return c.json({
      tournament: tournament
        ? {
            id: tournament.id,
            name: tournament.name,
            season: tournament.season,
            status: tournament.status,
          }
        : null,
      group: {
        registeredCount: registeredTeams.length,
        standings: groupStandings,
        autoRegistered: true,
        start_gameweek: startGW,
        end_gameweek: endGW,
      },
      rounds,
    });
  } catch (err: any) {
    return jsonError(c, 500, err.message || "Failed to fetch bracket data");
  }
});

// --------------------
// Live Matchups Endpoints (DraftFPL Live-style)
// --------------------

const liveContext = new Hono();
const liveData = new Hono();
const entryPicks = new Hono();
const liveH2H = new Hono();

// GET /api/context?entryId=XXXX
liveContext.get("/", async (c) => {
  try {
    const entryIdParam = c.req.query("entryId");
    const entryId = entryIdParam || STATIC_ENTRY_ID;

    const supabase = getSupabaseAdmin();
    
    // Fetch current gameweek
    const { data: seasonState } = await supabase
      .from("season_state")
      .select("current_gameweek, league_id, league_name, season")
      .eq("season", CURRENT_SEASON)
      .maybeSingle();

    const currentEvent = seasonState?.current_gameweek || 1;

    // Fetch bootstrap static for metadata versioning
    let bootstrapVersion: string | null = null;
    try {
      const bootstrap = await fetchJSON<any>(`${DRAFT_BASE_URL}/bootstrap-static`);
      const bootstrapEvents = extractDraftEvents(bootstrap);
      bootstrapVersion =
        extractDraftCurrentEventId(bootstrap)?.toString() ||
        bootstrapEvents[0]?.id?.toString() ||
        null;
    } catch (err) {
      // Bootstrap fetch failed, continue without version
    }

    // Fetch league context for this entry
    let leagueMetadata: Array<{ id: number; name: string; type: string }> = [];
    try {
      const entry = await fetchJSON<any>(`${DRAFT_BASE_URL}/entry/${entryId}/public`);
      leagueMetadata = extractDraftLeagues(entry);
    } catch (err) {
      // Entry fetch failed, use fallback
    }

    return c.json({
      entryId,
      currentEvent,
      leagues: leagueMetadata,
      bootstrapVersion,
      season: CURRENT_SEASON,
    });
  } catch (err: any) {
    return jsonError(c, 500, err.message || "Failed to fetch context");
  }
});

// GET /api/live?event=NN
liveData.get("/", async (c) => {
  try {
    const eventParam = c.req.query("event");
    if (!eventParam) {
      return jsonError(c, 400, "Missing event parameter");
    }
    const event = Number.parseInt(eventParam, 10);
    if (!Number.isInteger(event) || event < 1) {
      return jsonError(c, 400, "Invalid event parameter");
    }

    // Fetch live data from FPL API
    const liveData = await fetchJSON<any>(`${DRAFT_BASE_URL}/event/${event}/live`);

    // Transform to our format
    const elements = normalizeDraftList<any>(liveData.elements).map((el: any) => ({
      element: el.id ?? el.element,
      stats: {
        minutes: el.stats?.minutes || 0,
        goals_scored: el.stats?.goals_scored || 0,
        assists: el.stats?.assists || 0,
        clean_sheets: el.stats?.clean_sheets || 0,
        goals_conceded: el.stats?.goals_conceded || 0,
        yellow_cards: el.stats?.yellow_cards || 0,
        red_cards: el.stats?.red_cards || 0,
        saves: el.stats?.saves || 0,
        bonus: el.stats?.bonus || 0,
        bps: el.stats?.bps || 0,
        influence: el.stats?.influence || 0,
        creativity: el.stats?.creativity || 0,
        threat: el.stats?.threat || 0,
        ict_index: el.stats?.ict_index || 0,
        starts: el.stats?.starts || 0,
        expected_goals: el.stats?.expected_goals || 0,
        expected_assists: el.stats?.expected_assists || 0,
        expected_goal_involvements: el.stats?.expected_goal_involvements || 0,
        expected_goals_conceded: el.stats?.expected_goals_conceded || 0,
        total_points: el.stats?.total_points || 0,
      },
      explain: el.explain || [],
    }));

    // Fetch fixtures for status
    const fixtureStatuses = normalizeDraftList<any>(liveData.fixtures).map((f: any) => ({
      id: f.id,
      started: !!f.started,
      finished: !!(f.finished_provisional || f.finished),
      elapsed: f.minutes || f.elapsed || 0,
      team_h: f.team_h,
      team_a: f.team_a,
    }));

    return c.json({
      event,
      elements,
      fixtures: fixtureStatuses,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return jsonError(c, 500, err.message || "Failed to fetch live data");
  }
});

// GET /api/entry/:entryId/picks?event=NN
entryPicks.get("/:entryId", async (c) => {
  try {
    const entryId = c.req.param("entryId");
    const eventParam = c.req.query("event");
    if (!eventParam) {
      return jsonError(c, 400, "Missing event parameter");
    }
    const event = Number.parseInt(eventParam, 10);
    if (!Number.isInteger(event) || event < 1) {
      return jsonError(c, 400, "Invalid event parameter");
    }

    // Fetch picks from FPL API
    const picksData = await fetchJSON<any>(`${DRAFT_BASE_URL}/entry/${entryId}/event/${event}`);

    // Transform picks
    const picks = normalizeDraftList<any>(picksData.picks).map((p: any) => ({
      element: p.element ?? p.element_id ?? p.player_id,
      position: p.position,
      is_captain: p.is_captain || false,
      is_vice_captain: p.is_vice_captain || false,
      multiplier: p.multiplier || 1,
    }));

    // For H2H, we need to get opponent's picks too
    // This would require league context - for now, return just this entry's picks
    return c.json({
      entryId,
      event,
      picks,
      entry_name: picksData?.entry?.player_name || picksData?.entry_name || null,
    });
  } catch (err: any) {
    return jsonError(c, 500, err.message || "Failed to fetch picks");
  }
});

// GET /api/h2h?entryId=XXXX&event=NN
liveH2H.get("/", async (c) => {
  try {
    const entryIdParam = c.req.query("entryId");
    const entryId = entryIdParam || STATIC_ENTRY_ID;
    const eventParam = c.req.query("event");
    if (!eventParam) {
      return jsonError(c, 400, "Missing event parameter");
    }
    const event = Number.parseInt(eventParam, 10);
    if (!Number.isInteger(event) || event < 1) {
      return jsonError(c, 400, "Invalid event parameter");
    }

    const supabase = getSupabaseAdmin();

    // Get league ID from entry
    let leagueId: number | null = null;
    try {
      const entry = await fetchJSON<any>(`${DRAFT_BASE_URL}/entry/${entryId}/public`);
      leagueId = extractDraftLeagueId(entry);
    } catch (err) {
      // Fallback to database
      const context = await resolveLeagueContextFromDb(supabase);
      leagueId = context.leagueId ? Number.parseInt(context.leagueId, 10) : null;
    }

    if (!leagueId) {
      return jsonError(c, 404, "League not found for entry");
    }

    // Fetch H2H fixtures for this league and event
    const leagueDetails = await fetchJSON<any>(
      `${DRAFT_BASE_URL}/league/${leagueId}/details`
    );

    const leagueEntries = normalizeDraftList<any>(leagueDetails.league_entries);
    const matchFixtures = normalizeDraftList<any>(leagueDetails.matches);

    const leagueEntryMap = new Map<number, any>();
    leagueEntries.forEach((entry: any) => {
      if (Number.isInteger(entry.id)) {
        leagueEntryMap.set(entry.id, entry);
      }
    });

    // For each entry, fetch their picks
    const matchups: Array<{
      entry_1: number;
      entry_1_name: string;
      entry_2: number;
      entry_2_name: string;
      picks_1: Array<{
        element: number;
        position: number;
        is_captain: boolean;
        is_vice_captain: boolean;
        multiplier: number;
      }>;
      picks_2: Array<{
        element: number;
        position: number;
        is_captain: boolean;
        is_vice_captain: boolean;
        multiplier: number;
      }>;
    }> = [];

    const eventMatchups = matchFixtures.filter((m: any) => m.event === event);
    const fixturesToUse =
      eventMatchups.length > 0 ? eventMatchups : matchFixtures;

    for (const fixture of fixturesToUse) {
      const entry1Ref = fixture.league_entry_1 ?? fixture.entry_1 ?? fixture.home;
      const entry2Ref = fixture.league_entry_2 ?? fixture.entry_2 ?? fixture.away;

      const entry1 = leagueEntryMap.get(entry1Ref);
      const entry2 = leagueEntryMap.get(entry2Ref);

      if (!entry1 || !entry2) continue;

      const entry1Id = entry1.entry_id ?? entry1.entry ?? entry1.id;
      const entry2Id = entry2.entry_id ?? entry2.entry ?? entry2.id;
      const entry1Name = entry1.entry_name ?? entry1.name ?? "Manager 1";
      const entry2Name = entry2.entry_name ?? entry2.name ?? "Manager 2";

      // Fetch picks for both entries
      let picks1: any[] = [];
      let picks2: any[] = [];

      try {
        const picksData1 = await fetchJSON<any>(
          `${DRAFT_BASE_URL}/entry/${entry1Id}/event/${event}`
        );
        picks1 = normalizeDraftList<any>(picksData1.picks).map((p: any) => ({
          element: p.element ?? p.element_id ?? p.player_id,
          position: p.position,
          is_captain: p.is_captain || false,
          is_vice_captain: p.is_vice_captain || false,
          multiplier: p.multiplier || 1,
        }));
      } catch (err) {
        // Picks fetch failed for entry 1
      }

      try {
        const picksData2 = await fetchJSON<any>(
          `${DRAFT_BASE_URL}/entry/${entry2Id}/event/${event}`
        );
        picks2 = normalizeDraftList<any>(picksData2.picks).map((p: any) => ({
          element: p.element ?? p.element_id ?? p.player_id,
          position: p.position,
          is_captain: p.is_captain || false,
          is_vice_captain: p.is_vice_captain || false,
          multiplier: p.multiplier || 1,
        }));
      } catch (err) {
        // Picks fetch failed for entry 2
      }

      matchups.push({
        entry_1: entry1Id,
        entry_1_name: entry1Name,
        entry_2: entry2Id,
        entry_2_name: entry2Name,
        picks_1: picks1,
        picks_2: picks2,
      });
    }

    return c.json({
      entryId,
      event,
      leagueId,
      matchups,
    });
  } catch (err: any) {
    return jsonError(c, 500, err.message || "Failed to fetch H2H data");
  }
});

// --------------------
// Admin: Refresh Current Season (Ingest FPL API -> DB)
// --------------------

const adminRefresh = new Hono();

adminRefresh.post("/refresh-current-season", async (c) => {
  if (!requireAdminToken(c)) {
    return jsonError(c, 401, "Unauthorized");
  }

  try {
    const supabase = getSupabaseAdmin();

    const bootstrap = await fetchJSON<any>(`${FPL_BASE_URL}/bootstrap-static/`);
    const currentEvent = bootstrap.events?.find((e: any) => e.is_current) || bootstrap.events?.[0];
    const currentGameweek = currentEvent?.id || 1;
    const deadlineTime = currentEvent?.deadline_time || null;

    const entry = await fetchJSON<any>(`${FPL_BASE_URL}/entry/${STATIC_ENTRY_ID}/`);
    if (!entry.leagues?.classic || !entry.leagues.classic.length) {
      return jsonError(c, 400, "No classic league found for static entry");
    }

    const leagueId = entry.leagues.classic[0].id;
    const leagueName = entry.leagues.classic[0].name;

    const league = await fetchJSON<any>(
      `${FPL_BASE_URL}/leagues-classic/${leagueId}/standings/`
    );
    const standings = league.standings?.results || [];

    const entryIds = standings.map((t: any) => String(t.entry));
    const { data: aliases, error: aliasError } = await supabase
      .from("manager_aliases")
      .select("entry_id, manager_name")
      .in("entry_id", entryIds);

    if (aliasError) {
      return jsonError(c, 500, "Failed to fetch manager aliases", aliasError.message);
    }

    const aliasMap: Record<string, string> = {};
    (aliases || []).forEach((a: any) => {
      aliasMap[String(a.entry_id)] = a.manager_name;
    });

    const missingAliases = standings.filter((t: any) => !aliasMap[String(t.entry)]);
    if (missingAliases.length > 0) {
      return jsonError(c, 400, "Missing manager aliases for entry IDs", missingAliases.map((t: any) => ({
        entry_id: String(t.entry),
        player_name: t.player_name,
        entry_name: t.entry_name,
      })));
    }

    const teamRows = standings.map((t: any) => ({
      entry_id: String(t.entry),
      entry_name: t.entry_name,
      manager_name: aliasMap[String(t.entry)],
      manager_short_name: t.player_name,
      updated_at: new Date().toISOString(),
    }));

    const { error: upsertTeamsError } = await supabase
      .from("teams")
      .upsert(teamRows, { onConflict: "entry_id" });

    if (upsertTeamsError) {
      return jsonError(c, 500, "Failed to upsert teams", upsertTeamsError.message);
    }

    const { data: existingTournament } = await supabase
      .from("tournaments")
      .select("*")
      .eq("entry_id", STATIC_ENTRY_ID)
      .eq("season", CURRENT_SEASON)
      .maybeSingle();

    let tournamentId: string | null = existingTournament?.id ?? null;
    if (!existingTournament) {
      const { data: newTournament, error: tournamentError } = await supabase
        .from("tournaments")
        .insert({
          entry_id: STATIC_ENTRY_ID,
          name: "FFA Cup",
          season: CURRENT_SEASON,
          status: "group_stage",
          start_gameweek: currentGameweek,
          group_stage_gameweeks: 4,
          is_active: true,
        })
        .select("id")
        .single();

      if (tournamentError) {
        return jsonError(c, 500, "Failed to create tournament", tournamentError.message);
      }
      tournamentId = newTournament?.id ?? null;
    }

    const { error: stateError } = await supabase
      .from("season_state")
      .upsert({
        season: CURRENT_SEASON,
        current_gameweek: currentGameweek,
        deadline_time: deadlineTime,
        league_id: String(leagueId),
        league_name: leagueName,
        updated_at: new Date().toISOString(),
      }, { onConflict: "season" });

    if (stateError) {
      return jsonError(c, 500, "Failed to update season state", stateError.message);
    }

    const { data: teams } = await supabase
      .from("teams")
      .select("id, entry_id")
      .in("entry_id", entryIds);

    const teamIdMap: Record<string, string> = {};
    (teams || []).forEach((t: any) => {
      teamIdMap[String(t.entry_id)] = t.id;
    });

    let totalGameweeksUpserted = 0;
    const managerSeasonRows: any[] = [];
    for (const entryId of entryIds) {
      const history = await fetchJSON<any>(`${FPL_BASE_URL}/entry/${entryId}/history/`);
      const current = history.current || [];

      const teamId = teamIdMap[String(entryId)];
      const rows = current.map((gw: any) => ({
        team_id: teamId,
        tournament_id: tournamentId,
        gameweek: gw.event,
        total_points: gw.points || 0,
        captain_points: null,
        bench_points: gw.points_on_bench || 0,
        raw_data: gw,
        updated_at: new Date().toISOString(),
      }));

      if (rows.length > 0) {
        const { error: upsertScoresError } = await supabase
          .from("gameweek_scores")
          .upsert(rows, { onConflict: "team_id,gameweek,tournament_id" });

        if (upsertScoresError) {
          return jsonError(c, 500, "Failed to upsert gameweek scores", upsertScoresError.message);
        }

        totalGameweeksUpserted += rows.length;
      }

      const gameweeksPlayed = current.length;
      const totalPoints = current.reduce((sum: number, gw: any) => sum + (gw.points || 0), 0);
      const totalTransfers = current.reduce((sum: number, gw: any) => sum + (gw.event_transfers || 0), 0);
      const pointsPerGame = gameweeksPlayed ? totalPoints / gameweeksPlayed : 0;
      const maxGwPoints = gameweeksPlayed ? Math.max(...current.map((gw: any) => gw.points || 0)) : null;
      const minGwPoints = gameweeksPlayed ? Math.min(...current.map((gw: any) => gw.points || 0)) : null;
      const fiftyPlus = current.filter((gw: any) => (gw.points || 0) >= 50).length;
      const subTwenty = current.filter((gw: any) => (gw.points || 0) < 20).length;

      managerSeasonRows.push({
        season: CURRENT_SEASON,
        team_id: teamId,
        points_per_game: Math.round(pointsPerGame * 100) / 100,
        points_plus: totalPoints,
        total_transactions: totalTransfers,
        highest_gameweek: maxGwPoints,
        lowest_gameweek: minGwPoints,
        fifty_plus_weeks: fiftyPlus,
        sub_twenty_weeks: subTwenty,
        updated_at: new Date().toISOString(),
      });
    }

    if (managerSeasonRows.length > 0) {
      const { error: upsertSeasonStatsError } = await supabase
        .from("manager_season_stats")
        .upsert(managerSeasonRows, { onConflict: "season,team_id" });

      if (upsertSeasonStatsError) {
        return jsonError(c, 500, "Failed to upsert manager season stats", upsertSeasonStatsError.message);
      }
    }

    return c.json({
      season: CURRENT_SEASON,
      current_gameweek: currentGameweek,
      teams_updated: teamRows.length,
      gameweeks_upserted: totalGameweeksUpserted,
      manager_season_stats_upserted: managerSeasonRows.length,
    });
  } catch (err: any) {
    return jsonError(c, 500, err.message || "Failed to refresh current season");
  }
});

adminRefresh.post("/recompute-all-time-standings", async (c) => {
  if (!requireAdminToken(c)) {
    return jsonError(c, 401, "Unauthorized");
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: legacyStandings, error: standingsError } = await supabase
      .from("legacy_season_standings")
      .select("season, manager_name, final_rank, competition_type")
      .lt("season", CURRENT_SEASON);

    if (standingsError) {
      return jsonError(c, 500, "Failed to fetch legacy standings", standingsError.message);
    }

    const { data: legacyTrophies, error: trophiesError } = await supabase
      .from("legacy_season_trophies")
      .select("season, manager_name, won_league, won_cup, won_goblet")
      .lt("season", CURRENT_SEASON);

    if (trophiesError) {
      return jsonError(c, 500, "Failed to fetch legacy trophies", trophiesError.message);
    }

    const { data: legacyManagerStats, error: statsError } = await supabase
      .from("legacy_manager_season_stats")
      .select("season, manager_name, points_per_game, points_plus")
      .lt("season", CURRENT_SEASON);

    if (statsError) {
      return jsonError(c, 500, "Failed to fetch legacy manager stats", statsError.message);
    }

    const { data: currentStandings } = await supabase
      .from("season_standings")
      .select("season, final_rank, team_id");

    const { data: currentTrophies } = await supabase
      .from("season_trophies")
      .select("season, team_id, league_title, cup_winner, goblet_winner");

    const { data: currentManagerStats } = await supabase
      .from("manager_season_stats")
      .select("season, team_id, points_per_game, points_plus");

    const { data: teams } = await supabase
      .from("teams")
      .select("id, manager_name");

    const teamIdToManager: Record<string, string> = {};
    (teams || []).forEach((t: any) => {
      teamIdToManager[t.id] = t.manager_name;
    });

    const placementsByManager: Record<string, number[]> = {};
    (legacyStandings || []).forEach((row: any) => {
      if (row.competition_type !== "league") return;
      if (!placementsByManager[row.manager_name]) placementsByManager[row.manager_name] = [];
      placementsByManager[row.manager_name].push(row.final_rank);
    });

    (currentStandings || []).forEach((row: any) => {
      const manager = teamIdToManager[row.team_id];
      if (!manager) return;
      if (!placementsByManager[manager]) placementsByManager[manager] = [];
      placementsByManager[manager].push(row.final_rank);
    });

    const trophiesByManager: Record<string, Array<{ league: boolean; cup: boolean; goblet: boolean }>> = {};
    (legacyTrophies || []).forEach((row: any) => {
      if (!trophiesByManager[row.manager_name]) trophiesByManager[row.manager_name] = [];
      trophiesByManager[row.manager_name].push({
        league: !!row.won_league,
        cup: !!row.won_cup,
        goblet: !!row.won_goblet,
      });
    });

    (currentTrophies || []).forEach((row: any) => {
      const manager = teamIdToManager[row.team_id];
      if (!manager) return;
      if (!trophiesByManager[manager]) trophiesByManager[manager] = [];
      trophiesByManager[manager].push({
        league: !!row.league_title,
        cup: !!row.cup_winner,
        goblet: !!row.goblet_winner,
      });
    });

    const ppgByManager: Record<string, number[]> = {};
    const plusGByManager: Record<string, number[]> = {};

    (legacyManagerStats || []).forEach((row: any) => {
      if (!ppgByManager[row.manager_name]) ppgByManager[row.manager_name] = [];
      if (!plusGByManager[row.manager_name]) plusGByManager[row.manager_name] = [];
      if (row.points_per_game != null) ppgByManager[row.manager_name].push(Number(row.points_per_game));
      if (row.points_plus != null) plusGByManager[row.manager_name].push(Number(row.points_plus));
    });

    (currentManagerStats || []).forEach((row: any) => {
      const manager = teamIdToManager[row.team_id];
      if (!manager) return;
      if (!ppgByManager[manager]) ppgByManager[manager] = [];
      if (!plusGByManager[manager]) plusGByManager[manager] = [];
      if (row.points_per_game != null) ppgByManager[manager].push(Number(row.points_per_game));
      if (row.points_plus != null) plusGByManager[manager].push(Number(row.points_plus));
    });

    const managers = new Set<string>([
      ...Object.keys(placementsByManager),
      ...Object.keys(trophiesByManager),
      ...Object.keys(ppgByManager),
      ...Object.keys(plusGByManager),
    ]);

    const ppgMeans = Array.from(managers).map((m) => {
      const values = ppgByManager[m] || [];
      const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      return avg;
    });
    const plusGMeans = Array.from(managers).map((m) => {
      const values = plusGByManager[m] || [];
      const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      return avg;
    });

    const leaguePPGMean = ppgMeans.length ? ppgMeans.reduce((a, b) => a + b, 0) / ppgMeans.length : 0;
    const leaguePlusGMean = plusGMeans.length ? plusGMeans.reduce((a, b) => a + b, 0) / plusGMeans.length : 0;
    const variance = plusGMeans.length
      ? plusGMeans.reduce((sum, val) => {
          const diff = val - leaguePlusGMean;
          return sum + diff * diff;
        }, 0) / plusGMeans.length
      : 0;
    const leaguePlusGStdDev = Math.sqrt(variance);

    const rows = Array.from(managers).map((manager) => {
      const placements = placementsByManager[manager] || [];
      const trophies = trophiesByManager[manager] || [];
      const ppgValues = ppgByManager[manager] || [];
      const plusGValues = plusGByManager[manager] || [];
      const ppg = ppgValues.length ? ppgValues.reduce((a, b) => a + b, 0) / ppgValues.length : 0;
      const plusG = plusGValues.length ? plusGValues.reduce((a, b) => a + b, 0) / plusGValues.length : 0;

      const rating = computeManagerRating(
        placements,
        trophies,
        ppg,
        plusG,
        leaguePPGMean,
        leaguePlusGMean,
        leaguePlusGStdDev,
      );

      return {
        manager_name: manager,
        elo_rating: Math.round(rating.finalScore * 100) / 100,
        placement_score: Math.round(rating.placementScore * 100) / 100,
        silverware_score: Math.round(rating.silverwareScore * 100) / 100,
        ppg_score: Math.round(rating.ppgPoints * 100) / 100,
        plus_g_modifier: Math.round(rating.gModifier * 10000) / 10000,
        base_score: Math.round(rating.baseScore * 100) / 100,
        ppg: Math.round(ppg * 1000) / 1000,
        plus_g: Math.round(plusG * 1000) / 1000,
        seasons_played: placements.length,
        updated_at: new Date().toISOString(),
      };
    });

    if (rows.length > 0) {
      const { error: upsertError } = await supabase
        .from("all_time_manager_standings")
        .upsert(rows, { onConflict: "manager_name" });

      if (upsertError) {
        return jsonError(c, 500, "Failed to upsert all-time standings", upsertError.message);
      }
    }

    return c.json({
      managers_processed: rows.length,
      league_ppg_mean: leaguePPGMean,
      league_plus_g_mean: leaguePlusGMean,
      league_plus_g_stddev: leaguePlusGStdDev,
    });
  } catch (err: any) {
    return jsonError(c, 500, err.message || "Failed to recompute all-time standings");
  }
});

// --------------------
// Captain Auth + Captain Picks
// --------------------

const captainAuth = new Hono();
const captainPicks = new Hono();

captainAuth.post("/sign-in", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const email = normalizeEmail(body?.email);
    const password = String(body?.password ?? "");
    if (!email) {
      return jsonError(c, 400, "Email is required");
    }
    if (!password) {
      return jsonError(c, 400, "Password is required");
    }

    const supabase = getSupabaseAdmin();
    const { data: authRow, error: authError } = await supabase
      .from("manager_auth_emails")
      .select("manager_name, email, password")
      .eq("email", email)
      .maybeSingle();

    if (authError) {
      return jsonError(c, 500, "Failed to validate email", authError.message);
    }
    if (!authRow) {
      return jsonError(c, 401, "Email is not authorized for captain picks");
    }
    if (String(authRow.password ?? "") !== password) {
      return jsonError(c, 401, "Invalid email or password");
    }

    const managerName = toCanonicalManagerName(authRow.manager_name);
    if (!managerName) {
      return jsonError(c, 400, "Invalid manager mapping for this email");
    }

    const { data: team, error: teamError } = await supabase
      .from("teams")
      .select("id, entry_id, entry_name, manager_name")
      .eq("manager_name", managerName)
      .limit(1)
      .maybeSingle();

    if (teamError) {
      return jsonError(c, 500, "Failed to resolve manager team", teamError.message);
    }
    if (!team) {
      return jsonError(c, 404, `No team found for manager ${managerName}`);
    }

    const token = `${crypto.randomUUID()}${crypto.randomUUID().replace(/-/g, "")}`;
    const expiresAt = new Date(Date.now() + CAPTAIN_SESSION_TTL_HOURS * 60 * 60 * 1000).toISOString();

    const { error: insertSessionError } = await supabase
      .from("manager_sign_in_sessions")
      .insert({
        token,
        manager_name: managerName,
        team_id: team.id,
        entry_id: String(team.entry_id),
        expires_at: expiresAt,
        last_seen_at: new Date().toISOString(),
      });

    if (insertSessionError) {
      return jsonError(c, 500, "Failed to create sign-in session", insertSessionError.message);
    }

    const targetGameweek = await resolveCupTargetGameweek(supabase);

    return c.json({
      token,
      manager_name: managerName,
      team_id: team.id,
      team_name: team.entry_name,
      entry_id: String(team.entry_id),
      target_gameweek: targetGameweek,
      expires_at: expiresAt,
    });
  } catch (err: any) {
    return jsonError(c, 500, err.message || "Failed to sign in");
  }
});

captainAuth.post("/change-password", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const token = String(body?.token || "").trim();
    const currentPassword = String(body?.current_password ?? "");
    const newPassword = String(body?.new_password ?? "");
    if (!token) return jsonError(c, 400, "Missing token");
    if (!currentPassword) return jsonError(c, 400, "Current password is required");
    if (!newPassword) return jsonError(c, 400, "New password is required");
    if (newPassword.length < 6) {
      return jsonError(c, 400, "New password must be at least 6 characters");
    }

    const supabase = getSupabaseAdmin();
    const session = await resolveCaptainSession(supabase, token);
    if (!session) return jsonError(c, 401, "Invalid or expired session");

    const { data: authRow, error: authError } = await supabase
      .from("manager_auth_emails")
      .select("manager_name, password")
      .eq("manager_name", session.manager_name)
      .maybeSingle();

    if (authError) {
      return jsonError(c, 500, "Failed to load manager auth row", authError.message);
    }
    if (!authRow) {
      return jsonError(c, 404, "Manager auth record not found");
    }
    if (String(authRow.password ?? "") !== currentPassword) {
      return jsonError(c, 401, "Current password is incorrect");
    }

    const { error: updateError } = await supabase
      .from("manager_auth_emails")
      .update({
        password: newPassword,
        updated_at: new Date().toISOString(),
      })
      .eq("manager_name", session.manager_name);

    if (updateError) {
      return jsonError(c, 500, "Failed to update password", updateError.message);
    }

    return c.json({ ok: true });
  } catch (err: any) {
    return jsonError(c, 500, err.message || "Failed to change password");
  }
});

captainAuth.get("/session", async (c) => {
  try {
    const token = String(c.req.query("token") || "").trim();
    if (!token) return jsonError(c, 400, "Missing token");

    const supabase = getSupabaseAdmin();
    const session = await resolveCaptainSession(supabase, token);
    if (!session) return jsonError(c, 401, "Invalid or expired session");

    const [{ data: team }, { data: mediaProfiles }, { data: authRow }] = await Promise.all([
      supabase
      .from("teams")
      .select("entry_name, manager_name")
      .eq("id", session.team_id)
      .maybeSingle(),
      supabase
      .from("manager_media_profiles")
      .select("club_crest_url, club_logo_url, manager_profile_picture_url")
      .eq("manager_name", session.manager_name)
      .maybeSingle(),
      supabase
      .from("manager_auth_emails")
      .select("club_crest, club_logo, manager_photo")
      .eq("manager_name", session.manager_name)
      .maybeSingle(),
    ]);

    const targetGameweek = await resolveCupTargetGameweek(supabase);
    await supabase
      .from("manager_sign_in_sessions")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("token", token);

    return c.json({
      manager_name: session.manager_name,
      team_id: session.team_id,
      team_name: team?.entry_name || null,
      entry_id: session.entry_id,
      media: {
        club_crest_url: (authRow && (authRow.club_crest || authRow.club_crest_url)) || mediaProfiles?.club_crest_url || null,
        club_logo_url: (authRow && (authRow.club_logo || authRow.club_logo_url)) || mediaProfiles?.club_logo_url || null,
        manager_profile_picture_url: (authRow && (authRow.manager_photo || authRow.manager_profile_picture_url)) || mediaProfiles?.manager_profile_picture_url || null,
      },
      target_gameweek: targetGameweek,
      expires_at: session.expires_at,
    });
  } catch (err: any) {
    return jsonError(c, 500, err.message || "Failed to validate session");
  }
});

captainAuth.get("/media", async (c) => {
  try {
    const token = String(c.req.query("token") || "").trim();
    if (!token) return jsonError(c, 400, "Missing token");

    const supabase = getSupabaseAdmin();
    const session = await resolveCaptainSession(supabase, token);
    if (!session) return jsonError(c, 401, "Invalid or expired session");

    const [{ data: profiles, error: profilesError }, { data: authRow, error: authError }] = await Promise.all([
      supabase
        .from("manager_media_profiles")
        .select("club_crest_url, club_logo_url, manager_profile_picture_url")
        .eq("manager_name", session.manager_name)
        .maybeSingle(),
      supabase
        .from("manager_auth_emails")
        .select("club_crest, club_logo, manager_photo")
        .eq("manager_name", session.manager_name)
        .maybeSingle(),
    ]);
    if (profilesError && profilesError.code !== "PGRST116") {
      return jsonError(c, 500, "Failed to load media profiles", profilesError.message);
    }
    if (authError && authError.code !== "PGRST116") {
      return jsonError(c, 500, "Failed to load auth media", authError.message);
    }

    return c.json({
      manager_name: session.manager_name,
      media: {
        club_crest_url: (authRow && (authRow.club_crest || null)) || profiles?.club_crest_url || null,
        club_logo_url: (authRow && (authRow.club_logo || null)) || profiles?.club_logo_url || null,
        manager_profile_picture_url: (authRow && (authRow.manager_photo || null)) || profiles?.manager_profile_picture_url || null,
      },
    });
  } catch (err: any) {
    return jsonError(c, 500, err.message || "Failed to fetch media");
  }
});

captainAuth.post("/media", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const token = String(body?.token || "").trim();
    const mediaType = String(body?.media_type || "").trim().toLowerCase();
    const dataUrl = String(body?.data_url || "");
    if (!token) return jsonError(c, 400, "Missing token");
    if (!["club_crest", "club_logo", "manager_profile_picture"].includes(mediaType)) {
      return jsonError(c, 400, "Invalid media_type");
    }
    if (!dataUrl) return jsonError(c, 400, "Missing data_url");

    const normalizedDataUrl = String(dataUrl || "").trim();
    if (!normalizedDataUrl.startsWith("data:image/")) {
      return jsonError(c, 400, "Invalid image payload");
    }
    // Approximate decoded size from base64 content.
    const base64Part = normalizedDataUrl.split(",")[1] || "";
    const estimatedBytes = Math.floor((base64Part.length * 3) / 4);
    if (estimatedBytes > 5 * 1024 * 1024) {
      return jsonError(c, 400, "Image must be <= 5MB");
    }

    const supabase = getSupabaseAdmin();
    const session = await resolveCaptainSession(supabase, token);
    if (!session) return jsonError(c, 401, "Invalid or expired session");

    // Persist directly in DB-backed profile fields to avoid storage bucket failures.
    const persistedImage = normalizedDataUrl;

    const authPayload: any = {};
    if (mediaType === "club_crest") authPayload.club_crest = persistedImage;
    if (mediaType === "club_logo") authPayload.club_logo = persistedImage;
    if (mediaType === "manager_profile_picture") authPayload.manager_photo = persistedImage;

    const { error: authUpdateError } = await supabase
      .from("manager_auth_emails")
      .update(authPayload)
      .eq("manager_name", session.manager_name);
    if (authUpdateError) {
      return jsonError(c, 500, "Failed to save media metadata", authUpdateError.message);
    }

    const { data: authRow, error: authReadError } = await supabase
      .from("manager_auth_emails")
      .select("club_crest, club_logo, manager_photo")
      .eq("manager_name", session.manager_name)
      .maybeSingle();
    if (authReadError) {
      return jsonError(c, 500, "Failed to read media metadata", authReadError.message);
    }

    return c.json({
      ok: true,
      manager_name: session.manager_name,
      media: {
        club_crest_url: authRow?.club_crest || null,
        club_logo_url: authRow?.club_logo || null,
        manager_profile_picture_url: authRow?.manager_photo || null,
      },
    });
  } catch (err: any) {
    return jsonError(c, 500, err.message || "Failed to upload media");
  }
});

captainAuth.post("/sign-out", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const token = String(body?.token || "").trim();
    if (!token) return jsonError(c, 400, "Missing token");
    const supabase = getSupabaseAdmin();
    await supabase
      .from("manager_sign_in_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("token", token);
    return c.json({ ok: true });
  } catch (err: any) {
    return jsonError(c, 500, err.message || "Failed to sign out");
  }
});

captainPicks.get("/context", async (c) => {
  try {
    const token = String(c.req.query("token") || "").trim();
    if (!token) return jsonError(c, 400, "Missing token");

    const supabase = getSupabaseAdmin();
    const session = await resolveCaptainSession(supabase, token);
    if (!session) return jsonError(c, 401, "Invalid or expired session");

    const targetGameweek = await resolveCupTargetGameweek(supabase);

    const entryCandidates = await resolveDraftEntryCandidatesForManager(
      session.manager_name,
      session.entry_id,
    );
    const squad = await fetchDraftSquadForEntries(entryCandidates, targetGameweek);
    if (!squad) {
      return jsonError(c, 404, "Could not fetch this team's squad from the FPL Draft API");
    }

    const bootstrap = await fetchDraftBootstrap();
    const playersById = extractDraftPlayerMap(bootstrap);
    const players = squad.picks
      .map((pick: any) => {
        const playerId = Number(pick.element);
        const player = playersById[playerId];
        return {
          id: playerId,
          name: player?.name || `Player ${playerId}`,
          team: player?.team || null,
          position: player?.position || null,
        };
      })
      .filter((p: any) => Number.isInteger(p.id));

    const { data: existingSelection } = await supabase
      .from("cup_captain_selections")
      .select("captain_player_id, captain_name, gameweek, updated_at")
      .eq("team_id", session.team_id)
      .eq("gameweek", targetGameweek)
      .maybeSingle();

    const { data: team } = await supabase
      .from("teams")
      .select("entry_name")
      .eq("id", session.team_id)
      .maybeSingle();

    return c.json({
      manager_name: session.manager_name,
      team_id: session.team_id,
      team_name: team?.entry_name || null,
      entry_id: session.entry_id,
      resolved_entry_id: squad.entryId,
      gameweek: targetGameweek,
      squad_source_gameweek: squad.event,
      players,
      selected_captain_id: existingSelection?.captain_player_id ?? null,
      selected_captain_name: existingSelection?.captain_name ?? null,
      selected_updated_at: existingSelection?.updated_at ?? null,
    });
  } catch (err: any) {
    return jsonError(c, 500, err.message || "Failed to load pick context");
  }
});

captainPicks.post("/select", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const token = String(body?.token || "").trim();
    const captainPlayerId = parsePositiveInt(body?.captain_player_id);
    if (!token) return jsonError(c, 400, "Missing token");
    if (!captainPlayerId) return jsonError(c, 400, "Invalid captain_player_id");

    const supabase = getSupabaseAdmin();
    const session = await resolveCaptainSession(supabase, token);
    if (!session) return jsonError(c, 401, "Invalid or expired session");

    const targetGameweek = await resolveCupTargetGameweek(supabase);
    const entryCandidates = await resolveDraftEntryCandidatesForManager(
      session.manager_name,
      session.entry_id,
    );
    const squad = await fetchDraftSquadForEntries(entryCandidates, targetGameweek);
    if (!squad) {
      return jsonError(c, 404, "Could not fetch this team's squad for validation");
    }

    const squadIds = new Set<number>(
      squad.picks.map((p: any) => Number(p.element)).filter((id: number) => Number.isInteger(id)),
    );
    if (!squadIds.has(captainPlayerId)) {
      return jsonError(c, 400, "Captain must be selected from this manager's squad");
    }

    const bootstrap = await fetchDraftBootstrap();
    const playersById = extractDraftPlayerMap(bootstrap);
    const captainName = playersById[captainPlayerId]?.name || `Player ${captainPlayerId}`;

    const { error: upsertError } = await supabase
      .from("cup_captain_selections")
      .upsert(
        {
          team_id: session.team_id,
          manager_name: session.manager_name,
          entry_id: squad.entryId,
          gameweek: targetGameweek,
          captain_player_id: captainPlayerId,
          captain_name: captainName,
          squad_event: squad.event,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "team_id,gameweek" },
      );

    if (upsertError) {
      return jsonError(c, 500, "Failed to save captain selection", upsertError.message);
    }

    return c.json({
      ok: true,
      manager_name: session.manager_name,
      gameweek: targetGameweek,
      captain_player_id: captainPlayerId,
      captain_name: captainName,
    });
  } catch (err: any) {
    return jsonError(c, 500, err.message || "Failed to save captain selection");
  }
});

// --------------------
// Fixtures + Matchup Detail
// --------------------

const fixturesHub = new Hono();

fixturesHub.get("/", async (c) => {
  try {
    const supabase = getSupabaseAdmin();
    try {
      await syncCurrentSeasonLegacyStats(supabase);
    } catch {
      // Continue with persisted rows.
    }

    const [seasonStateRes, teamsRes, cupRes] = await Promise.all([
      supabase
        .from("season_state")
        .select("season, current_gameweek")
        .eq("season", CURRENT_SEASON)
        .maybeSingle(),
      supabase
        .from("teams")
        .select("id, entry_id, entry_name, manager_name"),
      supabase
        .from("matchups")
        .select("id, round, matchup_number, team_1_id, team_2_id, leg_1_gameweek, leg_2_gameweek, team_1_leg_1_points, team_1_leg_2_points, team_2_leg_1_points, team_2_leg_2_points"),
    ]);

    if (teamsRes.error) {
      return jsonError(c, 500, "Failed to fetch teams", teamsRes.error.message);
    }
    if (cupRes.error && cupRes.error.code !== "PGRST116") {
      return jsonError(c, 500, "Failed to fetch cup fixtures", cupRes.error.message);
    }

    const teamsMap: Record<string, any> = {};
    (teamsRes.data || []).forEach((t: any) => {
      teamsMap[String(t.id)] = t;
    });
    let draftEntries: any[] = [];
    let draftMatches: any[] = [];
    let rankMap: Record<string, number> = {};
    let currentGw = coerceNumber(seasonStateRes.data?.current_gameweek, 1);
    const draftEntryMap: Record<string, { id: string; entry_name: string | null; manager_name: string | null }> = {};
    try {
      const { details } = await resolveDraftLeagueDetails(STATIC_ENTRY_ID);
      draftEntries = normalizeDraftList<any>(details?.league_entries);
      draftMatches = normalizeDraftList<any>(details?.matches);
      try {
        const bootstrap = await fetchDraftBootstrap();
        currentGw = extractDraftCurrentEventId(bootstrap) || currentGw;
      } catch {
        // Keep season_state fallback.
      }
      rankMap = buildDraftRankMapFromMatches(draftMatches, currentGw);
      draftEntries.forEach((entry: any) => {
        const id = entry.id ?? entry.league_entry_id ?? entry.entry_id ?? entry.entry;
        if (id === null || id === undefined) return;
        draftEntryMap[String(id)] = {
          id: String(id),
          entry_name: formatDraftTeamName(entry),
          manager_name: formatDraftManagerName(entry),
        };
      });
    } catch {
      // Fallback to DB fixtures when Draft API is unavailable.
      const { data: dbLeagueRows, error: dbLeagueError } = await supabase
        .from("h2h_matchups")
        .select("team_1_id, team_2_id, gameweek, team_1_points, team_2_points")
        .order("gameweek", { ascending: true });
      if (dbLeagueError && !isMissingRelationError(dbLeagueError)) {
        return jsonError(c, 500, "Failed to fetch league fixtures", dbLeagueError.message);
      }
      draftMatches = (dbLeagueRows || []).map((m: any) => ({
        event: m.gameweek,
        league_entry_1: m.team_1_id,
        league_entry_2: m.team_2_id,
        league_entry_1_points: m.team_1_points,
        league_entry_2_points: m.team_2_points,
      }));
      rankMap = buildDraftRankMapFromMatches(draftMatches, currentGw);
      Object.values(teamsMap).forEach((team: any) => {
        const id = String(team.id);
        draftEntryMap[id] = {
          id,
          entry_name: team.entry_name || null,
          manager_name: team.manager_name || null,
        };
      });
    }

    const leagueByGw: Record<string, any[]> = {};
    draftMatches.forEach((m: any) => {
      const gw = coerceNumber(m.event);
      const key = String(gw);
      if (!leagueByGw[key]) leagueByGw[key] = [];
      const team1Id = String(m.league_entry_1 ?? m.entry_1 ?? m.home ?? "");
      const team2Id = String(m.league_entry_2 ?? m.entry_2 ?? m.away ?? "");
      if (!team1Id || !team2Id) return;
      leagueByGw[key].push({
        fixture_id: `league-${gw}-${team1Id}-${team2Id}`,
        type: "league",
        gameweek: gw,
        team_1_id: team1Id,
        team_2_id: team2Id,
        team_1_points: coerceNumber(m.league_entry_1_points ?? m.score_1 ?? m.home_score, 0),
        team_2_points: coerceNumber(m.league_entry_2_points ?? m.score_2 ?? m.away_score, 0),
        team_1_rank: gw === currentGw ? rankMap[team1Id] || null : null,
        team_2_rank: gw === currentGw ? rankMap[team2Id] || null : null,
        team_1: draftEntryMap[team1Id] || null,
        team_2: draftEntryMap[team2Id] || null,
        is_ongoing: gw === currentGw,
      });
    });

    const cupByGw: Record<string, any[]> = {};
    (cupRes.data || []).forEach((m: any) => {
      const team1 = teamsMap[String(m.team_1_id)] || null;
      const team2 = teamsMap[String(m.team_2_id)] || null;
      const rows = [
        {
          leg: 1,
          gameweek: coerceNumber(m.leg_1_gameweek),
          team_1_points: m.team_1_leg_1_points,
          team_2_points: m.team_2_leg_1_points,
        },
        {
          leg: 2,
          gameweek: coerceNumber(m.leg_2_gameweek),
          team_1_points: m.team_1_leg_2_points,
          team_2_points: m.team_2_leg_2_points,
        },
      ];
      rows.forEach((row) => {
        if (!row.gameweek) return;
        const key = String(row.gameweek);
        if (!cupByGw[key]) cupByGw[key] = [];
        cupByGw[key].push({
          fixture_id: `cup-${m.id}-leg-${row.leg}`,
          matchup_id: m.id,
          type: "cup",
          round: m.round,
          leg: row.leg,
          gameweek: row.gameweek,
          team_1_id: m.team_1_id,
          team_2_id: m.team_2_id,
          team_1_points: coerceNumber(row.team_1_points, 0),
          team_2_points: coerceNumber(row.team_2_points, 0),
          team_1_rank: row.gameweek === currentGw ? rankMap[String(m.team_1_id)] || null : null,
          team_2_rank: row.gameweek === currentGw ? rankMap[String(m.team_2_id)] || null : null,
          team_1: team1,
          team_2: team2,
          is_ongoing: row.gameweek === currentGw,
        });
      });
    });

    const groupToArray = (grouped: Record<string, any[]>) =>
      Object.entries(grouped)
        .map(([gw, matchups]) => ({
          gameweek: coerceNumber(gw),
          matchups: matchups.sort((a, b) =>
            String(a.team_1?.manager_name || "").localeCompare(String(b.team_1?.manager_name || "")),
          ),
        }))
        .sort((a, b) => a.gameweek - b.gameweek);

    // Enrich fixtures with last used lineup for unstarted games
    const currentGwForLineups = coerceNumber(seasonStateRes.data?.current_gameweek, 1);
    const enrichMatchups = async (groups: Record<string, any[]>) => {
      const out: Record<string, any[]> = {};
      for (const [gw, matchups] of Object.entries(groups)) {
        out[gw] = [];
        for (const m of matchups) {
          const entry: any = { ...m };
          try {
            // If game hasn't started or is upcoming, fetch last lineup for each team
            const gwNum = coerceNumber(m.gameweek);
            if (!m.is_ongoing && gwNum >= currentGwForLineups) {
              const last1 = await fetchLastLineupForTeam(supabase, String(m.team_1_id), currentGwForLineups - 1);
              const last2 = await fetchLastLineupForTeam(supabase, String(m.team_2_id), currentGwForLineups - 1);
              if (last1) entry.last_lineup_1 = last1;
              if (last2) entry.last_lineup_2 = last2;
            }
          } catch (err) {
            // ignore
          }
          out[gw].push(entry);
        }
      }
      return out;
    };

    const [enrichedLeague, enrichedCup] = await Promise.all([
      enrichMatchups(leagueByGw),
      enrichMatchups(cupByGw),
    ]);

    return c.json({
      season: seasonStateRes.data?.season || CURRENT_SEASON,
      current_gameweek: coerceNumber(seasonStateRes.data?.current_gameweek, 1),
      league: groupToArray(enrichedLeague),
      cup: groupToArray(enrichedCup),
    });
  } catch (err: any) {
    return jsonError(c, 500, err.message || "Failed to fetch fixtures");
  }
});

fixturesHub.get("/matchup", async (c) => {
  try {
    const type = String(c.req.query("type") || "league").toLowerCase();
    const gameweek = coerceNumber(c.req.query("gameweek"));
    const team1Id = String(c.req.query("team1") || "").trim();
    const team2Id = String(c.req.query("team2") || "").trim();
    const matchupId = String(c.req.query("matchupId") || "").trim();

    if (!gameweek || !team1Id || !team2Id) {
      return jsonError(c, 400, "Missing required query params: gameweek, team1, team2");
    }

    const supabase = getSupabaseAdmin();
    let currentGw = gameweek;
    try {
      const bootstrap = await fetchDraftBootstrap();
      currentGw = extractDraftCurrentEventId(bootstrap) || currentGw;
    } catch {
      const { data: seasonState } = await supabase
        .from("season_state")
        .select("current_gameweek")
        .eq("season", CURRENT_SEASON)
        .maybeSingle();
      currentGw = parsePositiveInt(seasonState?.current_gameweek) || currentGw;
    }
    const cupCaptainByTeam: Record<string, number> = {};
    let rankMap: Record<string, number> = {};
    let team1: any = null;
    let team2: any = null;
    let leagueRow: any = null;

    if (type === "league") {
      let entries: any[] = [];
      let matches: any[] = [];
      try {
        const { details } = await resolveDraftLeagueDetails(STATIC_ENTRY_ID);
        entries = normalizeDraftList<any>(details?.league_entries);
        matches = normalizeDraftList<any>(details?.matches);
      } catch {
        const [dbTeamsRes, dbMatchesRes] = await Promise.all([
          supabase
            .from("teams")
            .select("id, entry_id, entry_name, manager_name")
            .in("id", [team1Id, team2Id]),
          supabase
            .from("h2h_matchups")
            .select("team_1_id, team_2_id, gameweek, team_1_points, team_2_points")
            .eq("gameweek", gameweek),
        ]);
        if (dbTeamsRes.error) {
          return jsonError(c, 500, "Failed to fetch teams", dbTeamsRes.error.message);
        }
        if (dbMatchesRes.error && !isMissingRelationError(dbMatchesRes.error)) {
          return jsonError(c, 500, "Failed to fetch league matchup rows", dbMatchesRes.error.message);
        }
        entries = (dbTeamsRes.data || []).map((t: any) => ({
          id: t.id,
          entry_id: t.entry_id,
          entry_name: t.entry_name,
          manager_name: t.manager_name,
          player_first_name: t.manager_name,
          player_last_name: "",
        }));
        matches = (dbMatchesRes.data || []).map((m: any) => ({
          event: m.gameweek,
          league_entry_1: m.team_1_id,
          league_entry_2: m.team_2_id,
          league_entry_1_points: m.team_1_points,
          league_entry_2_points: m.team_2_points,
        }));
      }

      const entryMap: Record<string, any> = {};
      entries.forEach((entry: any) => {
        const id = entry.id ?? entry.league_entry_id ?? entry.entry_id ?? entry.entry;
        if (id === null || id === undefined) return;
        entryMap[String(id)] = entry;
      });

      const resolveEntryId = async (candidate: string) => {
        if (entryMap[candidate]) return candidate;
        const { data: dbTeam } = await supabase
          .from("teams")
          .select("id, entry_id")
          .eq("id", candidate)
          .maybeSingle();
        const alt = dbTeam?.entry_id !== null && dbTeam?.entry_id !== undefined ? String(dbTeam.entry_id) : null;
        if (alt && entryMap[alt]) return alt;
        return candidate;
      };

      const resolvedTeam1Id = await resolveEntryId(team1Id);
      const resolvedTeam2Id = await resolveEntryId(team2Id);
      const entry1 = entryMap[resolvedTeam1Id] || null;
      const entry2 = entryMap[resolvedTeam2Id] || null;
      if (!entry1 || !entry2) {
        return jsonError(c, 404, "Could not resolve one or both league entries");
      }

      team1 = {
        id: resolvedTeam1Id,
        entry_id: String(entry1.entry_id ?? entry1.entry ?? entry1.id ?? resolvedTeam1Id),
        manager_name: formatDraftManagerName(entry1),
        entry_name: formatDraftTeamName(entry1),
      };
      team2 = {
        id: resolvedTeam2Id,
        entry_id: String(entry2.entry_id ?? entry2.entry ?? entry2.id ?? resolvedTeam2Id),
        manager_name: formatDraftManagerName(entry2),
        entry_name: formatDraftTeamName(entry2),
      };
      rankMap = buildDraftRankMapFromMatches(matches, currentGw);
      leagueRow = matches.find((m: any) => {
        const left = String(m.league_entry_1 ?? m.entry_1 ?? m.home ?? "");
        const right = String(m.league_entry_2 ?? m.entry_2 ?? m.away ?? "");
        const samePair =
          (left === resolvedTeam1Id && right === resolvedTeam2Id) ||
          (left === resolvedTeam2Id && right === resolvedTeam1Id);
        return samePair && coerceNumber(m.event) === gameweek;
      }) || null;
    } else {
      const [teamsRes, cupSelectionRes] = await Promise.all([
        supabase
          .from("teams")
          .select("id, entry_id, entry_name, manager_name")
          .in("id", [team1Id, team2Id]),
        supabase
          .from("cup_captain_selections")
          .select("team_id, captain_player_id")
          .in("team_id", [team1Id, team2Id])
          .eq("gameweek", gameweek),
      ]);
      if (teamsRes.error) {
        return jsonError(c, 500, "Failed to fetch teams", teamsRes.error.message);
      }
      (cupSelectionRes.data || []).forEach((row: any) => {
        cupCaptainByTeam[String(row.team_id)] = coerceNumber(row.captain_player_id);
      });
      const teamMap: Record<string, any> = {};
      (teamsRes.data || []).forEach((t: any) => {
        teamMap[String(t.id)] = t;
      });
      team1 = teamMap[team1Id] || null;
      team2 = teamMap[team2Id] || null;
      if (!team1 || !team2) {
        return jsonError(c, 404, "Could not resolve one or both teams");
      }
      rankMap = await buildLeagueRankMap(supabase, currentGw);
    }

    let cupRow: any = null;
    if (type === "cup") {
      if (matchupId) {
        const { data: found } = await supabase
          .from("matchups")
          .select("id, round, leg_1_gameweek, leg_2_gameweek, team_1_id, team_2_id, team_1_leg_1_points, team_1_leg_2_points, team_2_leg_1_points, team_2_leg_2_points")
          .eq("id", matchupId)
          .maybeSingle();
        cupRow = found || null;
      } else {
        const { data: found } = await supabase
          .from("matchups")
          .select("id, round, leg_1_gameweek, leg_2_gameweek, team_1_id, team_2_id, team_1_leg_1_points, team_1_leg_2_points, team_2_leg_1_points, team_2_leg_2_points")
          .limit(50);
        cupRow = (found || []).find((row: any) => {
          const sameTeams =
            (String(row.team_1_id) === team1Id && String(row.team_2_id) === team2Id) ||
            (String(row.team_1_id) === team2Id && String(row.team_2_id) === team1Id);
          const sameGw = coerceNumber(row.leg_1_gameweek) === gameweek || coerceNumber(row.leg_2_gameweek) === gameweek;
          return sameTeams && sameGw;
        }) || null;
      }
    }

    const picks1 = await fetchDraftPicksForEntries([String(team1.entry_id)], gameweek, true);
    const picks2 = await fetchDraftPicksForEntries([String(team2.entry_id)], gameweek, true);
    let bootstrap: any = null;
    try {
      bootstrap = await fetchDraftBootstrap();
    } catch {
      try {
        bootstrap = await fetchJSON<any>(`${FPL_BASE_URL}/bootstrap-static/`);
      } catch {
        bootstrap = null;
      }
    }
    const playerMap = extractDraftPlayerMap(bootstrap || {});
    let liveMap: Record<number, number> = {};
    let liveStatsMap: Record<number, any> = {};
    try {
      const live = await fetchJSON<any>(`${DRAFT_BASE_URL}/event/${gameweek}/live`);
      liveMap = extractLivePointsMap(live);
      liveStatsMap = extractLivePlayerStatsMap(live);
    } catch {
      try {
        const classicLive = await fetchJSON<any>(`${FPL_BASE_URL}/event/${gameweek}/live/`);
        liveMap = extractLivePointsMap(classicLive);
        liveStatsMap = extractLivePlayerStatsMap(classicLive);
      } catch {
        liveMap = {};
        liveStatsMap = {};
      }
    }

    const hasStarted = gameweek < currentGw;

    const mapLineup = (rows: any[] | undefined, teamId: string) =>
      (rows || []).map((pick: any) => {
        const playerId = coerceNumber(pick.element);
        const lineupSlot = coerceNumber(pick.position, 0);
        const isBench = lineupSlot > 11;
        const hasLive = Object.prototype.hasOwnProperty.call(liveMap, playerId);
        const pickPoints =
          Number.isFinite(Number((pick as any).points))
            ? Number((pick as any).points)
            : Number.isFinite(Number((pick as any).event_points))
            ? Number((pick as any).event_points)
            : 0;
        const rawPoints = hasLive ? coerceNumber(liveMap[playerId], 0) : pickPoints;
        const cupCaptainId = cupCaptainByTeam[teamId] || 0;
        const isCupCaptain = type === "cup" && hasStarted && cupCaptainId > 0 && cupCaptainId === playerId;
        const effectivePoints = rawPoints * (isCupCaptain ? 2 : 1);
        const stats = liveStatsMap[playerId] || {};
        return {
          player_id: playerId,
          player_name: playerMap[playerId]?.name || `Player ${playerId}`,
          position: coerceNumber(playerMap[playerId]?.position, 3),
          lineup_slot: lineupSlot || null,
          is_bench: isBench,
          is_captain: !!pick.is_captain,
          is_vice_captain: !!pick.is_vice_captain,
          is_cup_captain: isCupCaptain,
          raw_points: rawPoints,
          multiplier: isCupCaptain ? 2 : 1,
          effective_points: effectivePoints,
          goals_scored: coerceNumber(stats.goals_scored, 0),
          assists: coerceNumber(stats.assists, 0),
          minutes: coerceNumber(stats.minutes, 0),
          defensive_contributions: coerceNumber(stats.defensive_contributions, 0),
          clean_sheets: coerceNumber(stats.clean_sheets, 0),
          goals_conceded: coerceNumber(stats.goals_conceded, 0),
          yellow_cards: coerceNumber(stats.yellow_cards, 0),
          red_cards: coerceNumber(stats.red_cards, 0),
          penalties_missed: coerceNumber(stats.penalties_missed, 0),
          penalties_saved: coerceNumber(stats.penalties_saved, 0),
        };
      });

    const lineup1 = mapLineup(picks1?.picks, team1Id);
    const lineup2 = mapLineup(picks2?.picks, team2Id);

    const total1 = lineup1.reduce((sum, p) => sum + coerceNumber(p.effective_points), 0);
    const total2 = lineup2.reduce((sum, p) => sum + coerceNumber(p.effective_points), 0);

    const scoreFromRows = (() => {
      if (type === "cup" && cupRow) {
        const isLeg1 = coerceNumber(cupRow.leg_1_gameweek) === gameweek;
        const team1Points = isLeg1 ? coerceNumber(cupRow.team_1_leg_1_points) : coerceNumber(cupRow.team_1_leg_2_points);
        const team2Points = isLeg1 ? coerceNumber(cupRow.team_2_leg_1_points) : coerceNumber(cupRow.team_2_leg_2_points);
        return {
          team_1_points: team1Points,
          team_2_points: team2Points,
          round: cupRow.round || null,
          matchup_id: cupRow.id,
        };
      }
      if (!leagueRow) {
        return {
          team_1_points: null,
          team_2_points: null,
          round: null,
          matchup_id: null,
        };
      }
      const left = String(leagueRow.team_1_id ?? leagueRow.league_entry_1 ?? leagueRow.entry_1 ?? leagueRow.home ?? "");
      const direct = left === String(team1.id);
      return {
        team_1_points: direct
          ? coerceNumber(leagueRow.team_1_points ?? leagueRow.league_entry_1_points ?? leagueRow.score_1 ?? leagueRow.home_score)
          : coerceNumber(leagueRow.team_2_points ?? leagueRow.league_entry_2_points ?? leagueRow.score_2 ?? leagueRow.away_score),
        team_2_points: direct
          ? coerceNumber(leagueRow.team_2_points ?? leagueRow.league_entry_2_points ?? leagueRow.score_2 ?? leagueRow.away_score)
          : coerceNumber(leagueRow.team_1_points ?? leagueRow.league_entry_1_points ?? leagueRow.score_1 ?? leagueRow.home_score),
        round: null,
        matchup_id: null,
      };
    })();

    return c.json({
      type,
      gameweek,
      current_gameweek: currentGw,
      matchup: {
        ...scoreFromRows,
        live_team_1_points: total1,
        live_team_2_points: total2,
        is_ongoing: gameweek === currentGw,
        has_started: hasStarted,
      },
      team_1: {
        id: String(team1.id),
        manager_name: team1.manager_name,
        entry_name: team1.entry_name,
        rank: gameweek === currentGw ? rankMap[String(team1.id)] || null : null,
        lineup: lineup1,
      },
      team_2: {
        id: String(team2.id),
        manager_name: team2.manager_name,
        entry_name: team2.entry_name,
        rank: gameweek === currentGw ? rankMap[String(team2.id)] || null : null,
        lineup: lineup2,
      },
    });
  } catch (err: any) {
    return jsonError(c, 500, err.message || "Failed to fetch matchup detail");
  }
});

fixturesHub.get("/lineup", async (c) => {
  try {
    const teamId = String(c.req.query("team") || "").trim();
    const gameweek = coerceNumber(c.req.query("gameweek"));
    const type = String(c.req.query("type") || "cup").toLowerCase() === "league" ? "league" : "cup";

    if (!teamId || !gameweek) {
      return jsonError(c, 400, "Missing required query params: team, gameweek");
    }

    const supabase = getSupabaseAdmin();
    const { data: team, error: teamError } = await supabase
      .from("teams")
      .select("id, entry_id, entry_name, manager_name")
      .eq("id", teamId)
      .maybeSingle();
    if (teamError) {
      return jsonError(c, 500, "Failed to fetch team", teamError.message);
    }
    if (!team) {
      return jsonError(c, 404, "Team not found");
    }

    let currentGw = gameweek;
    try {
      const bootstrap = await fetchDraftBootstrap();
      currentGw = extractDraftCurrentEventId(bootstrap) || currentGw;
    } catch {
      const { data: seasonState } = await supabase
        .from("season_state")
        .select("current_gameweek")
        .eq("season", CURRENT_SEASON)
        .maybeSingle();
      currentGw = parsePositiveInt(seasonState?.current_gameweek) || currentGw;
    }

    let captainPlayerId = 0;
    if (type === "cup") {
      const { data: captainRow } = await supabase
        .from("cup_captain_selections")
        .select("captain_player_id")
        .eq("team_id", teamId)
        .eq("gameweek", gameweek)
        .maybeSingle();
      captainPlayerId = coerceNumber(captainRow?.captain_player_id);
    }

    const picks = await fetchDraftPicksForEntries([String(team.entry_id)], gameweek, true);
    if (!picks) {
      return jsonError(c, 404, "No lineup found for this team and gameweek");
    }

    let bootstrap: any = null;
    try {
      bootstrap = await fetchDraftBootstrap();
    } catch {
      try {
        bootstrap = await fetchJSON<any>(`${FPL_BASE_URL}/bootstrap-static/`);
      } catch {
        bootstrap = {};
      }
    }
    const playerMap = extractDraftPlayerMap(bootstrap);
    let liveMap: Record<number, number> = {};
    let liveStatsMap: Record<number, any> = {};
    try {
      const live = await fetchJSON<any>(`${DRAFT_BASE_URL}/event/${gameweek}/live`);
      liveMap = extractLivePointsMap(live);
      liveStatsMap = extractLivePlayerStatsMap(live);
    } catch {
      try {
        const classicLive = await fetchJSON<any>(`${FPL_BASE_URL}/event/${gameweek}/live/`);
        liveMap = extractLivePointsMap(classicLive);
        liveStatsMap = extractLivePlayerStatsMap(classicLive);
      } catch {
        liveMap = {};
        liveStatsMap = {};
      }
    }

    const hasStarted = gameweek < currentGw;
    const lineup = (picks.picks || []).map((pick: any) => {
      const playerId = coerceNumber(pick.element);
      const lineupSlot = coerceNumber(pick.position, 0);
      const isBench = lineupSlot > 11;
      const hasLive = Object.prototype.hasOwnProperty.call(liveMap, playerId);
      const rawPoints = hasLive ? coerceNumber(liveMap[playerId], 0) : coerceNumber(pick.points, 0);
      const isCupCaptain = type === "cup" && hasStarted && captainPlayerId > 0 && playerId === captainPlayerId;
      const effectivePoints = rawPoints * (isCupCaptain ? 2 : 1);
      const stats = liveStatsMap[playerId] || {};
      return {
        player_id: playerId,
        player_name: playerMap[playerId]?.name || `Player ${playerId}`,
        position: coerceNumber(playerMap[playerId]?.position, 3),
        lineup_slot: lineupSlot || null,
        is_bench: isBench,
        is_captain: !!pick.is_captain,
        is_vice_captain: !!pick.is_vice_captain,
        is_cup_captain: isCupCaptain,
        raw_points: rawPoints,
        multiplier: isCupCaptain ? 2 : 1,
        effective_points: effectivePoints,
        goals_scored: coerceNumber(stats.goals_scored, 0),
        assists: coerceNumber(stats.assists, 0),
        minutes: coerceNumber(stats.minutes, 0),
      };
    });

    return c.json({
      type,
      gameweek,
      current_gameweek: currentGw,
      has_started: hasStarted,
      captain_player_id: captainPlayerId || null,
      total_points: lineup.reduce((sum: number, row: any) => sum + coerceNumber(row.effective_points), 0),
      team: {
        id: String(team.id),
        entry_id: String(team.entry_id),
        entry_name: team.entry_name,
        manager_name: team.manager_name,
      },
      lineup,
    });
  } catch (err: any) {
    return jsonError(c, 500, err.message || "Failed to fetch lineup");
  }
});

// --------------------
// App Router
// --------------------

const app = new Hono({ strict: false });

// Add CORS middleware for public access
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "apikey", "x-client-info"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  })
);

// Health check (debug)
app.get("/health", (c) => {
  return c.json({ ok: true, path: c.req.path });
});

// Debug: consistent JSON 404s
app.notFound((c) => {
  return c.json({ error: { message: "Not found", path: c.req.path } }, 404);
});

// Public read-only routes
app.route("/league-standings", leagueStandings);
app.route("/cup-group-stage", cupGroupStage);
app.route("/goblet-standings", gobletStandings);
app.route("/manager-insights", managerInsights);
app.route("/player-insights", playerInsights);
app.route("/player-history", playerHistory);
app.route("/h2h-standings", h2hStandings);
app.route("/h2h-matchups", h2hMatchups);
app.route("/h2h-rivalries", h2hRivalries);
app.route("/league-history", leagueHistory);
app.route("/live-scores", liveScores);
app.route("/current-gameweek", currentGameweek);
app.route("/manager-ratings", managerRatings);
app.route("/standings-by-gameweek", standingsByGameweek);
app.route("/bracket", bracket);
app.route("/admin", adminRefresh);

// Live matchups endpoints
app.route("/api/context", liveContext);
app.route("/api/live", liveData);
app.route("/api/entry", entryPicks);
app.route("/api/h2h", liveH2H);
app.route("/captain-auth", captainAuth);
app.route("/captain", captainPicks);
app.route("/fixtures", fixturesHub);

// Compatibility: allow routes with "/server" prefix if Supabase passes full path
app.route("/server/league-standings", leagueStandings);
app.route("/server/cup-group-stage", cupGroupStage);
app.route("/server/goblet-standings", gobletStandings);
app.route("/server/manager-insights", managerInsights);
app.route("/server/player-insights", playerInsights);
app.route("/server/player-history", playerHistory);
app.route("/server/h2h-standings", h2hStandings);
app.route("/server/h2h-matchups", h2hMatchups);
app.route("/server/h2h-rivalries", h2hRivalries);
app.route("/server/league-history", leagueHistory);
app.route("/server/live-scores", liveScores);
app.route("/server/current-gameweek", currentGameweek);
app.route("/server/manager-ratings", managerRatings);
app.route("/server/standings-by-gameweek", standingsByGameweek);
app.route("/server/bracket", bracket);
app.route("/server/admin", adminRefresh);

app.route("/server/api/context", liveContext);
app.route("/server/api/live", liveData);
app.route("/server/api/entry", entryPicks);
app.route("/server/api/h2h", liveH2H);
app.route("/server/captain-auth", captainAuth);
app.route("/server/captain", captainPicks);
app.route("/server/fixtures", fixturesHub);

// --------------------
// Legacy Statistics Endpoints
// --------------------

const legacyStats = new Hono();
const allTimeStandings = new Hono();

// All-time manager statistics
legacyStats.get("/all-time", async (c) => {
  try {
    const supabase = getSupabaseAdmin();
    const rows = await computeAllTimeManagerStats(supabase);
    return c.json({ stats: rows });
  } catch (err: any) {
    return jsonError(c, 500, err.message || "Failed to fetch all-time stats");
  }
});

legacyStats.get("/leaders", async (c) => {
  try {
    const supabase = getSupabaseAdmin();
    const season = String(c.req.query("season") || CURRENT_SEASON);
    const [allTime, seasonOnly] = await Promise.all([
      fetchDerivedGameweekStats(supabase),
      fetchDerivedGameweekStats(supabase, season),
    ]);

    return c.json({
      season,
      all_time: allTime.leaders,
      season_leaders: seasonOnly.leaders,
    });
  } catch (err: any) {
    return jsonError(c, 500, err.message || "Failed to fetch leader stats");
  }
});

allTimeStandings.get("/", async (c) => {
  try {
    const supabase = getSupabaseAdmin();
    const rows = await computeAllTimeManagerStats(supabase);
    const standings = rows.map((row, index) => ({
      rank: index + 1,
      manager_name: row.manager_name,
      wins: row.wins,
      draws: row.draws,
      losses: row.losses,
      points: row.total_points,
      points_for: row.points_plus,
      league_titles: row.league_titles,
      cup_wins: row.cup_wins,
      goblet_wins: row.goblet_wins,
      points_per_game: row.points_per_game,
    }));
    return c.json({ standings });
  } catch (err: any) {
    return jsonError(c, 500, err.message || "Failed to fetch all-time standings");
  }
});

// Season standings (legacy)
legacyStats.get("/season-standings/:season", async (c) => {
  try {
    const season = c.req.param("season");
    const competitionType = c.req.query("type") || "league"; // 'league' or 'goblet'

    if (season >= HISTORICAL_STATS_CUTOFF_SEASON) {
      return jsonError(c, 400, "Season must be before 2025/26");
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("legacy_season_standings")
      .select("*")
      .eq("season", season)
      .eq("competition_type", competitionType)
      .order("final_rank", { ascending: true });

    if (error) {
      return jsonError(c, 500, "Failed to fetch season standings", error.message);
    }

    const grouped: Record<string, any> = {};
    (data || []).forEach((row: any) => {
      const manager = toCanonicalManagerName(row.manager_name) || normalizeManagerName(row.manager_name);
      if (!grouped[manager]) {
        grouped[manager] = {
          ...row,
          manager_name: manager,
          wins: 0,
          draws: 0,
          losses: 0,
          points: 0,
          points_for: 0,
          points_against: 0,
          final_rank: row.final_rank,
        };
      }
      const item = grouped[manager];
      item.wins += coerceNumber(row.wins);
      item.draws += coerceNumber(row.draws);
      item.losses += coerceNumber(row.losses);
      item.points += coerceNumber(row.points);
      item.points_for += coerceNumber(row.points_for);
      item.points_against += coerceNumber(row.points_against);
      item.final_rank = Math.min(coerceNumber(item.final_rank, 999), coerceNumber(row.final_rank, 999));
    });

    const standings = Object.values(grouped)
      .sort((a: any, b: any) => coerceNumber(a.final_rank, 999) - coerceNumber(b.final_rank, 999));

    return c.json({ season, competition_type: competitionType, standings });
  } catch (err: any) {
    return jsonError(c, 500, err.message || "Failed to fetch season standings");
  }
});

// Manager profile data
legacyStats.get("/manager/:managerName", async (c) => {
  try {
    const managerName = toCanonicalManagerName(c.req.param("managerName"));
    
    // Validate canonical manager
    if (!managerName) {
      return jsonError(c, 400, "Invalid manager name");
    }

    const supabase = getSupabaseAdmin();
    const managerVariants = getManagerNameVariants(managerName);

    const allTimeRows = await computeAllTimeManagerStats(supabase);
    const allTimeStats = allTimeRows.find((row: any) => row.manager_name === managerName) || null;

    // Fetch season standings
    const { data: seasonStandingsRaw } = await supabase
      .from("legacy_season_standings")
      .select("*")
      .in("manager_name", managerVariants)
      .order("season", { ascending: false });
    const seasonStandings = (seasonStandingsRaw || []).map((row: any) => ({
      ...row,
      manager_name: managerName,
    }));

    // Fetch unified H2H stats (all-time = legacy + current season)
    const h2hAllTime = await fetchUnifiedAllTimeH2H(supabase, managerName);

    // Fetch H2H stats by season
    const { data: h2hBySeasonRaw } = await supabase
      .from("legacy_h2h_stats")
      .select("*")
      .in("manager_name", managerVariants)
      .not("season", "is", null)
      .order("season", { ascending: false })
      .order("opponent_name", { ascending: true });
    const h2hSeasonMap: Record<string, any> = {};
    (h2hBySeasonRaw || []).forEach((row: any) => {
      const opponent = toCanonicalManagerName(row.opponent_name) || normalizeManagerName(row.opponent_name);
      const key = `${row.season}__${opponent}`;
      if (!h2hSeasonMap[key]) {
        h2hSeasonMap[key] = {
          ...row,
          manager_name: managerName,
          opponent_name: opponent,
          wins: 0,
          draws: 0,
          losses: 0,
          games_played: 0,
          avg_points: null,
          _points_total: 0,
        };
      }
      const item = h2hSeasonMap[key];
      item.wins += coerceNumber(row.wins);
      item.draws += coerceNumber(row.draws);
      item.losses += coerceNumber(row.losses);
      item.games_played += coerceNumber(row.games_played);
      item._points_total += coerceNumber(row.avg_points) * coerceNumber(row.games_played);
      item.avg_points = item.games_played > 0 ? Math.round((item._points_total / item.games_played) * 100) / 100 : null;
    });
    const h2hBySeason = Object.values(h2hSeasonMap).map((row: any) => {
      const { _points_total, ...rest } = row;
      return rest;
    });

    // Fetch season trophies
    const { data: trophiesRaw } = await supabase
      .from("legacy_season_trophies")
      .select("*")
      .in("manager_name", managerVariants)
      .order("season", { ascending: false });
    const trophies = (trophiesRaw || []).map((row: any) => ({ ...row, manager_name: managerName }));

    // Fetch manager season stats
    const { data: seasonStatsRaw } = await supabase
      .from("legacy_manager_season_stats")
      .select("*")
      .in("manager_name", managerVariants)
      .order("season", { ascending: false });
    const seasonStats = (seasonStatsRaw || []).map((row: any) => ({ ...row, manager_name: managerName }));

    return c.json({
      manager_name: managerName,
      all_time_stats: allTimeStats,
      season_standings: seasonStandings || [],
      h2h_all_time: h2hAllTime,
      h2h_by_season: h2hBySeason || [],
      trophies: trophies || [],
      season_stats: seasonStats || [],
    });
  } catch (err: any) {
    return jsonError(c, 500, err.message || "Failed to fetch manager profile");
  }
});

// H2H records
legacyStats.get("/h2h/:managerName", async (c) => {
  try {
    const managerName = toCanonicalManagerName(c.req.param("managerName"));
    const season = c.req.query("season"); // Optional: filter by season
    if (!managerName) {
      return jsonError(c, 400, "Invalid manager name");
    }

    const supabase = getSupabaseAdmin();

    if (season) {
      const managerVariants = getManagerNameVariants(managerName);
      const { data, error } = await supabase
        .from("legacy_h2h_stats")
        .select("*")
        .in("manager_name", managerVariants)
        .eq("season", season)
        .order("opponent_name", { ascending: true });

      if (error) {
        return jsonError(c, 500, "Failed to fetch H2H stats", error.message);
      }

      const byOpponent: Record<string, any> = {};
      (data || []).forEach((row: any) => {
        const opponent = toCanonicalManagerName(row.opponent_name) || normalizeManagerName(row.opponent_name);
        if (!byOpponent[opponent]) {
          byOpponent[opponent] = {
            manager_name: managerName,
            opponent_name: opponent,
            season,
            wins: 0,
            draws: 0,
            losses: 0,
            games_played: 0,
            avg_points: null,
            _points_total: 0,
          };
        }
        const item = byOpponent[opponent];
        item.wins += coerceNumber(row.wins);
        item.draws += coerceNumber(row.draws);
        item.losses += coerceNumber(row.losses);
        item.games_played += coerceNumber(row.games_played);
        item._points_total += coerceNumber(row.avg_points) * coerceNumber(row.games_played);
        item.avg_points = item.games_played > 0 ? Math.round((item._points_total / item.games_played) * 100) / 100 : null;
      });

      const h2h_stats = Object.values(byOpponent).map((row: any) => {
        const { _points_total, ...rest } = row;
        return rest;
      }).sort((a: any, b: any) => String(a.opponent_name).localeCompare(String(b.opponent_name)));

      return c.json({ h2h_stats });
    }

    // All-time: merged legacy + current season
    const data = await fetchUnifiedAllTimeH2H(supabase, managerName);
    return c.json({ h2h_stats: data || [] });
  } catch (err: any) {
    return jsonError(c, 500, err.message || "Failed to fetch H2H stats");
  }
});

// Gameweek standings (legacy)
legacyStats.get("/gameweek-standings/:season/:gameweek", async (c) => {
  try {
    const season = c.req.param("season");
    const gameweek = Number(c.req.param("gameweek"));

    if (season >= HISTORICAL_STATS_CUTOFF_SEASON) {
      return jsonError(c, 400, "Season must be before 2025/26");
    }

    if (!gameweek || gameweek < 1 || gameweek > 38) {
      return jsonError(c, 400, "Invalid gameweek");
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("legacy_gameweek_standings")
      .select("*")
      .eq("season", season)
      .eq("gameweek", gameweek)
      .order("rank", { ascending: true });

    if (error) {
      return jsonError(c, 500, "Failed to fetch gameweek standings", error.message);
    }

    return c.json({ season, gameweek, standings: data || [] });
  } catch (err: any) {
    return jsonError(c, 500, err.message || "Failed to fetch gameweek standings");
  }
});

// List all seasons with legacy data
legacyStats.get("/seasons", async (c) => {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("legacy_season_standings")
      .select("season")
      .lt("season", HISTORICAL_STATS_CUTOFF_SEASON);

    if (error) {
      return jsonError(c, 500, "Failed to fetch seasons", error.message);
    }

    const seasons = Array.from(new Set((data || []).map((s: any) => s.season)))
      .sort()
      .reverse();

    return c.json({ seasons });
  } catch (err: any) {
    return jsonError(c, 500, err.message || "Failed to fetch seasons");
  }
});

app.route("/legacy-stats", legacyStats);
app.route("/all-time-standings", allTimeStandings);
app.route("/server/legacy-stats", legacyStats);
app.route("/server/all-time-standings", allTimeStandings);

export default app;
