/**
 * Legal FPL XI selection for Team of the Week.
 * Positions are FPL element_type: 1 GK, 2 DEF, 3 MID, 4 FWD.
 */

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

export type TotwLineup = {
  GK: TotwPlayer[];
  DEF: TotwPlayer[];
  MID: TotwPlayer[];
  FWD: TotwPlayer[];
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

export function selectBestTotwLineup(players: TotwPlayer[]): {
  lineup: TotwLineup;
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

  const lineup: TotwLineup = { GK: [], DEF: [], MID: [], FWD: [] };
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
