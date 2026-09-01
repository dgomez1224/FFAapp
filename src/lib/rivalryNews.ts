import { EDGE_FUNCTIONS_BASE } from "./constants";
import { getSupabaseFunctionHeaders, supabaseUrl } from "./supabaseClient";
import { normalizeManagerName } from "./canonicalManagers";
import { buildRivalryNewsItem, findRivalry, leagueMatchupPath, type RivalryH2H, type RivalryNewsDraft } from "./rivalries";
import { getManagerEntryId } from "./divisions";

type H2HRow = { opponent_name?: string; wins?: number; draws?: number; losses?: number };

function recordFor(rows: H2HRow[], opponent: string): RivalryH2H | null {
  const row = rows.find((r) => normalizeManagerName(r.opponent_name) === opponent);
  if (!row) return null;
  return {
    aWins: Number(row.wins || 0),
    draws: Number(row.draws || 0),
    bWins: Number(row.losses || 0),
  };
}

async function fetchH2H(manager: string): Promise<H2HRow[]> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(
      `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/legacy-stats/h2h/${encodeURIComponent(manager)}`,
      { headers: getSupabaseFunctionHeaders(), signal: controller.signal },
    );
    const payload = await res.json();
    return Array.isArray(payload?.h2h_stats) ? payload.h2h_stats : [];
  } catch {
    return [];
  } finally {
    window.clearTimeout(timer);
  }
}

export async function loadRivalryNews(now = new Date().toISOString()): Promise<RivalryNewsDraft[]> {
  const headers = getSupabaseFunctionHeaders();
  const items: RivalryNewsDraft[] = [];

  const gwRes = await fetch(`${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/current-gameweek`, { headers });
  const gwPayload = await gwRes.json();
  const current = Number(gwPayload?.current_gameweek || 1);
  const previous = Number(gwPayload?.previous_gameweek || Math.max(1, current - 1));
  const finished = gwPayload?.event_finished === true || gwPayload?.current_event_finished === true;
  const thisWeekStatus: "upcoming" | "live" | "completed" = finished
    ? "completed"
    : "live";

  const [d1, d2, prevWeek] = await Promise.all([
    fetch(`${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/h2h-matchups?division=division_one`, { headers }).then((r) => r.json()),
    fetch(`${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/h2h-matchups?division=division_two`, { headers }).then((r) => r.json()),
    fetch(`${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/league-activity/previous-week-results`, { headers })
      .then((r) => r.json())
      .catch(() => null),
  ]);

  const thisWeekPairs = [...(d1?.matchups || []), ...(d2?.matchups || [])]
    .map((m: any) => {
      const a = normalizeManagerName(m?.team_1?.manager_name);
      const b = normalizeManagerName(m?.team_2?.manager_name);
      if (!a || !b) return null;
      const rivalry = findRivalry(a, b);
      if (!rivalry) return null;
      const scoreA = Number(m.live_team_1_points ?? m.team_1_points ?? 0);
      const scoreB = Number(m.live_team_2_points ?? m.team_2_points ?? 0);
      const status =
        thisWeekStatus === "completed"
          ? "completed"
          : scoreA > 0 || scoreB > 0
            ? "live"
            : "upcoming";
      return {
        a,
        b,
        rivalry,
        scoreA,
        scoreB,
        gameweek: Number(m.gameweek || current),
        status,
        team1: String(m.team_1_entry_id || m.team_1_id || getManagerEntryId(a) || ""),
        team2: String(m.team_2_entry_id || m.team_2_id || getManagerEntryId(b) || ""),
      };
    })
    .filter(Boolean) as Array<{
    a: string;
    b: string;
    rivalry: NonNullable<ReturnType<typeof findRivalry>>;
    scoreA: number;
    scoreB: number;
    gameweek: number;
    status: "upcoming" | "live" | "completed";
    team1: string;
    team2: string;
  }>;

  const lastGw = Number(prevWeek?.gameweek || previous);
  const lastWeekPairs = (Array.isArray(prevWeek?.fixtures) ? prevWeek.fixtures : [])
    .map((f: any) => {
      const a = normalizeManagerName(f?.team_1?.manager_name);
      const b = normalizeManagerName(f?.team_2?.manager_name);
      if (!a || !b) return null;
      const rivalry = findRivalry(a, b);
      if (!rivalry) return null;
      const potm = Array.isArray(f?.potm) ? f.potm : [];
      return {
        a,
        b,
        rivalry,
        scoreA: Number(f?.team_1?.points || 0),
        scoreB: Number(f?.team_2?.points || 0),
        gameweek: lastGw,
        status: "completed" as const,
        team1: String(f?.team_1?.entry_id || getManagerEntryId(a) || ""),
        team2: String(f?.team_2?.entry_id || getManagerEntryId(b) || ""),
        topPerformers: potm.slice(0, 3).map((p: any) => ({
          manager: String(p.manager_name || ""),
          playerName: String(p.player_name || ""),
          points: Number(p.total_points || 0),
          goals: Number(p.goals_scored || 0),
          assists: Number(p.assists || 0),
        })),
      };
    })
    .filter(Boolean) as Array<{
    a: string;
    b: string;
    rivalry: NonNullable<ReturnType<typeof findRivalry>>;
    scoreA: number;
    scoreB: number;
    gameweek: number;
    status: "completed";
    team1: string;
    team2: string;
    topPerformers: Array<{ manager: string; playerName: string; points: number; goals?: number; assists?: number }>;
  }>;

  const seen = new Set<string>();
  const combined = [...thisWeekPairs, ...lastWeekPairs].filter((row) => {
    const key = `${row.gameweek}-${[row.a, row.b].sort().join("-")}-${row.status}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const h2hCache: Record<string, H2HRow[]> = {};
  const uniqueManagers = [...new Set(combined.map((row) => row.a))];
  await Promise.all(
    uniqueManagers.map(async (manager) => {
      h2hCache[manager] = await fetchH2H(manager);
    }),
  );
  for (const row of combined) {
    const h2h = recordFor(h2hCache[row.a], row.b);
    items.push(
      buildRivalryNewsItem({
        rivalry: row.rivalry,
        managerA: row.a,
        managerB: row.b,
        status: row.status,
        gameweek: row.gameweek,
        scoreA: row.scoreA,
        scoreB: row.scoreB,
        h2h,
        topPerformers: "topPerformers" in row ? row.topPerformers : undefined,
        publishedAt: now,
        matchupUrl: leagueMatchupPath(row.gameweek, row.team1, row.team2),
      }),
    );
  }

  return items;
}
