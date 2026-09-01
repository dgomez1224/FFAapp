import { getManagerDivision, type Division } from "./divisions";

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
    b.minutes - a.minutes
  );
}

function topNPoints(players: TotwPlayer[], n: number) {
  return players.slice(0, n).reduce((sum, p) => sum + p.points, 0);
}

export function selectBestTotwLineup(players: TotwPlayer[]): {
  lineup: TotwResponse["lineup"];
  formation: string;
  totalPoints: number;
  bench: TotwPlayer[];
} {
  const byPosition = {
    GK: players.filter((p) => p.position === 1).sort(compareTotwPlayers),
    DEF: players.filter((p) => p.position === 2).sort(compareTotwPlayers),
    MID: players.filter((p) => p.position === 3).sort(compareTotwPlayers),
    FWD: players.filter((p) => p.position === 4).sort(compareTotwPlayers),
  };

  const lineup: TotwResponse["lineup"] = { GK: [], DEF: [], MID: [], FWD: [] };
  if (byPosition.GK.length) lineup.GK = [byPosition.GK[0]];

  let best = FORMATIONS[0];
  let bestPoints = -1;
  for (const formation of FORMATIONS) {
    if (byPosition.DEF.length < formation.def) continue;
    if (byPosition.MID.length < formation.mid) continue;
    if (byPosition.FWD.length < formation.fwd) continue;
    const total =
      topNPoints(byPosition.DEF, formation.def) +
      topNPoints(byPosition.MID, formation.mid) +
      topNPoints(byPosition.FWD, formation.fwd);
    if (total > bestPoints) {
      bestPoints = total;
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
  const players =
    scope === "all"
      ? pool.players
      : pool.players.filter((p) => getManagerDivision(p.manager_name) === (scope as Division));
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
