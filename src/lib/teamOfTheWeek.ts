import { getManagerDivision, getManagerEntryId, type Division } from "./divisions";
import { EDGE_FUNCTIONS_BASE } from "./constants";
import { getSupabaseFunctionHeaders, supabaseUrl } from "./supabaseClient";
import type { Standing } from "./useDivisionStandings";

export type TotwPlayer = {
  player_id: number;
  player_name: string;
  web_name?: string | null;
  position: number;
  points: number;
  bonus: number;
  goals: number;
  assists: number;
  clean_sheets: number;
  bps: number;
  minutes: number;
  team: string;
  manager_name: string;
  /** All league managers who own this player (league-wide TOTW display). */
  manager_names?: string[];
  player_image_url?: string | null;
};

export type TotwScope = "all" | "division_one" | "division_two";

export type TotwPool = {
  gameweek: number;
  latest_completed?: number;
  current_gameweek?: number;
  players: TotwPlayer[];
};

export type TotwResponse = {
  gameweek: number;
  latest_completed?: number;
  current_gameweek?: number;
  formation: string;
  total_points: number;
  xi_count?: number;
  lineup: {
    GK: TotwPlayer[];
    DEF: TotwPlayer[];
    MID: TotwPlayer[];
    FWD: TotwPlayer[];
  };
  bench: TotwPlayer[];
};

const FORMATIONS = [
  { def: 3, mid: 5, fwd: 2 },
  { def: 3, mid: 4, fwd: 3 },
  { def: 4, mid: 4, fwd: 2 },
  { def: 4, mid: 3, fwd: 3 },
  { def: 4, mid: 5, fwd: 1 },
  { def: 5, mid: 3, fwd: 2 },
  { def: 5, mid: 4, fwd: 1 },
];

export function compareTotwPlayers(a: TotwPlayer, b: TotwPlayer) {
  return (
    b.points - a.points ||
    b.bonus - a.bonus ||
    b.goals - a.goals ||
    b.assists - a.assists ||
    b.bps - a.bps ||
    b.minutes - a.minutes ||
    String(a.manager_name || "").localeCompare(String(b.manager_name || ""))
  );
}

/** One entry per player_id — keeps the highest-scoring ownership row. */
export function uniqueTotwPlayersById(players: TotwPlayer[]): TotwPlayer[] {
  const map = new Map<number, TotwPlayer>();
  for (const p of players) {
    const existing = map.get(p.player_id);
    if (!existing || compareTotwPlayers(p, existing) < 0) {
      map.set(p.player_id, { ...p });
    }
  }
  return [...map.values()];
}

/**
 * League-wide TOTW: best stats per player_id with every owning manager listed.
 * Division pools should not use this — they keep division-local ownership only.
 */
export function aggregatePlayersForLeagueTotw(players: TotwPlayer[]): TotwPlayer[] {
  const best = uniqueTotwPlayersById(players);
  const managersById = new Map<number, string[]>();
  for (const p of players) {
    const name = String(p.manager_name || "").trim();
    if (!name) continue;
    const list = managersById.get(p.player_id) || [];
    if (!list.includes(name)) list.push(name);
    managersById.set(p.player_id, list);
  }
  return best.map((p) => {
    const names = (managersById.get(p.player_id) || []).sort((a, b) => a.localeCompare(b));
    return {
      ...p,
      manager_names: names,
      manager_name: names.join(", "),
    };
  });
}

export function selectBestTotwLineup(players: TotwPlayer[]): {
  lineup: TotwResponse["lineup"];
  formation: string;
  totalPoints: number;
  bench: TotwPlayer[];
} {
  const pool = uniqueTotwPlayersById(players);
  const byPosition = {
    GK: pool.filter((p) => p.position === 1).sort(compareTotwPlayers),
    DEF: pool.filter((p) => p.position === 2).sort(compareTotwPlayers),
    MID: pool.filter((p) => p.position === 3).sort(compareTotwPlayers),
    FWD: pool.filter((p) => p.position === 4).sort(compareTotwPlayers),
  };

  const lineup: TotwResponse["lineup"] = { GK: [], DEF: [], MID: [], FWD: [] };
  if (byPosition.GK.length) lineup.GK = [byPosition.GK[0]];

  let best = FORMATIONS[0];
  let bestPoints = -1;
  let bestBonus = -1;
  let bestBps = -1;
  for (const formation of FORMATIONS) {
    if (byPosition.DEF.length < formation.def) continue;
    if (byPosition.MID.length < formation.mid) continue;
    if (byPosition.FWD.length < formation.fwd) continue;
    const xi = [
      ...byPosition.DEF.slice(0, formation.def),
      ...byPosition.MID.slice(0, formation.mid),
      ...byPosition.FWD.slice(0, formation.fwd),
    ];
    const total = xi.reduce((sum, p) => sum + p.points, 0);
    const bonus = xi.reduce((sum, p) => sum + p.bonus, 0);
    const bps = xi.reduce((sum, p) => sum + p.bps, 0);
    if (
      total > bestPoints ||
      (total === bestPoints && bonus > bestBonus) ||
      (total === bestPoints && bonus === bestBonus && bps > bestBps)
    ) {
      bestPoints = total;
      bestBonus = bonus;
      bestBps = bps;
      best = formation;
    }
  }

  lineup.DEF = byPosition.DEF.slice(0, best.def);
  lineup.MID = byPosition.MID.slice(0, best.mid);
  lineup.FWD = byPosition.FWD.slice(0, best.fwd);

  const used = new Set(
    [...lineup.GK, ...lineup.DEF, ...lineup.MID, ...lineup.FWD].map((p) => p.player_id),
  );
  const bench: TotwPlayer[] = [];
  const nextGk = byPosition.GK.find((p) => !used.has(p.player_id));
  if (nextGk) bench.push(nextGk);
  const nextDef = byPosition.DEF.find((p) => !used.has(p.player_id));
  if (nextDef) bench.push(nextDef);
  const nextMid = byPosition.MID.find((p) => !used.has(p.player_id));
  if (nextMid) bench.push(nextMid);
  const nextFwd = byPosition.FWD.find((p) => !used.has(p.player_id));
  if (nextFwd) bench.push(nextFwd);

  const xi = [...lineup.GK, ...lineup.DEF, ...lineup.MID, ...lineup.FWD];
  return {
    lineup,
    formation: `${lineup.DEF.length}-${lineup.MID.length}-${lineup.FWD.length}`,
    totalPoints: xi.reduce((sum, p) => sum + p.points, 0),
    bench,
  };
}

export function totwFromPool(pool: TotwPool, scope: TotwScope): TotwResponse {
  const scoped =
    scope === "all"
      ? pool.players
      : pool.players.filter((p) => getManagerDivision(p.manager_name) === (scope as Division));
  const players =
    scope === "all" ? aggregatePlayersForLeagueTotw(scoped) : uniqueTotwPlayersById(scoped);
  const selected = selectBestTotwLineup(players);
  return {
    gameweek: pool.gameweek,
    latest_completed: pool.latest_completed,
    current_gameweek: pool.current_gameweek,
    formation: selected.formation,
    total_points: selected.totalPoints,
    xi_count:
      selected.lineup.GK.length +
      selected.lineup.DEF.length +
      selected.lineup.MID.length +
      selected.lineup.FWD.length,
    lineup: selected.lineup,
    bench: selected.bench,
  };
}

const totwCache = new Map<string, TotwPool>();
const totwInflight = new Map<string, Promise<TotwPool>>();

async function loadTotwPool(gameweek?: number): Promise<TotwPool> {
  const gwRes = await fetch(`${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/current-gameweek`, {
    headers: getSupabaseFunctionHeaders(),
  });
  const gwPayload = await gwRes.json();
  const current = Number(gwPayload?.current_gameweek || 1);
  const previous = Number(gwPayload?.previous_gameweek || Math.max(1, current - 1));
  const finished = gwPayload?.event_finished === true || gwPayload?.current_event_finished === true;
  const latestCompleted = finished ? current : previous;
  const targetGw = gameweek && gameweek >= 1 && gameweek <= latestCompleted ? gameweek : latestCompleted;

  const standings = (
    await Promise.all(
      (["division_one", "division_two"] as const).map(async (division) => {
        const res = await fetch(
          `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/h2h-standings?division=${division}`,
          { headers: getSupabaseFunctionHeaders() },
        );
        const payload = await res.json();
        return (Array.isArray(payload?.standings) ? payload.standings : []) as Standing[];
      }),
    )
  ).flat();
  standings.sort((a, b) =>
    String(a.manager_name || "").localeCompare(String(b.manager_name || "")),
  );

  const allPlayers: TotwPlayer[] = [];
  await Promise.allSettled(
    standings.map(async (standing) => {
      const teamKey =
        standing.team_id || standing.entry_id || getManagerEntryId(standing.manager_name || "") || "";
      if (!teamKey) return;
      const params = new URLSearchParams({
        team: String(teamKey),
        gameweek: String(targetGw),
        type: "league",
      });
      const res = await fetch(`${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/fixtures/lineup?${params}`, {
        headers: getSupabaseFunctionHeaders(),
      });
      const payload = await res.json();
      const lineup = Array.isArray(payload?.lineup) ? payload.lineup : [];
      lineup.forEach((p: any) => {
        const playerId = Number(p.player_id);
        if (!playerId) return;
        const points = Number(p.effective_points ?? p.raw_points ?? p.total_points ?? 0);
        const minutes = Number(p.minutes || 0);
        if (minutes <= 0 && points <= 0) return;
        const next: TotwPlayer = {
          player_id: playerId,
          player_name: p.player_name,
          web_name: p.web_name || null,
          position: Number(p.position || 0),
          points,
          bonus: Number(p.bonus || 0),
          goals: Number(p.goals_scored || 0),
          assists: Number(p.assists || 0),
          clean_sheets: Number(p.clean_sheets || 0),
          bps: Number(p.bps || 0),
          minutes,
          team: String(p.team_name || p.team || ""),
          manager_name: String(standing.manager_name || ""),
          player_image_url: p.player_image_url || null,
        };
        allPlayers.push(next);
      });
    }),
  );

  return {
    gameweek: targetGw,
    latest_completed: latestCompleted,
    current_gameweek: current,
    players: allPlayers,
  };
}

/** Shared fetch so dashboard and /team-of-the-week show the same XI for the same gameweek. */
export function fetchTotwPool(gameweek?: number): Promise<TotwPool> {
  const key = String(gameweek || "latest");
  const cached = totwCache.get(key);
  if (cached) return Promise.resolve(cached);
  const pending = totwInflight.get(key);
  if (pending) return pending;
  const request = loadTotwPool(gameweek)
    .then((pool) => {
      totwCache.set(key, pool);
      totwCache.set(String(pool.gameweek), pool);
      totwInflight.delete(key);
      return pool;
    })
    .catch((err) => {
      totwInflight.delete(key);
      throw err;
    });
  totwInflight.set(key, request);
  return request;
}
