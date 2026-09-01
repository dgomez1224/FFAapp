/**
 * Unified matchup probability models.
 *
 * 3-Way Live Heuristic — site logistic + explicit draw (ThisWeekMatchups).
 * 2-Way Gaussian — Zorya ffa-winprob.js engine (normal score-diff, draw folded 50/50).
 */

export type OddsModelId = "heuristic" | "gaussian-incl" | "gaussian-excl";

export type PlayerStatus = "done" | "live" | "upcoming";

export type PlayerOddsInput = {
  player_id: number;
  name: string;
  points: number;
  remaining: number;
  frac: number;
  status: PlayerStatus;
  is_captain: boolean;
};

export type WinProbs = {
  team1: number;
  draw: number;
  team2: number;
};

export const ODDS_MODELS: Array<{ id: OddsModelId; label: string; short: string }> = [
  { id: "heuristic", label: "3-Way Live Heuristic", short: "3-way live" },
  { id: "gaussian-incl", label: "2-Way Gaussian (Incl. Completed GWs)", short: "2-way incl." },
  { id: "gaussian-excl", label: "2-Way Gaussian (Excl. Completed GWs)", short: "2-way excl." },
];

export function nextOddsModel(current: OddsModelId): OddsModelId {
  const index = ODDS_MODELS.findIndex((model) => model.id === current);
  return ODDS_MODELS[(index + 1) % ODDS_MODELS.length]?.id ?? "heuristic";
}

export function oddsModelMeta(id: OddsModelId) {
  return ODDS_MODELS.find((model) => model.id === id) ?? ODDS_MODELS[0];
}

export function isTwoWayModel(id: OddsModelId): boolean {
  return id === "gaussian-incl" || id === "gaussian-excl";
}

function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

function normCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

/** Zorya matchProbs: P(win) uses a 0.5-pt continuity correction around a draw band. */
export function gaussianMatchProbs(projA: number, varA: number, projB: number, varB: number): { w: number; d: number; l: number } {
  const mean = projA - projB;
  const sigma = Math.sqrt(Math.max(0, varA) + Math.max(0, varB));
  if (sigma < 1e-9) {
    if (mean > 0) return { w: 1, d: 0, l: 0 };
    if (mean < 0) return { w: 0, d: 0, l: 1 };
    return { w: 0, d: 1, l: 0 };
  }
  const w = 1 - normCdf((0.5 - mean) / sigma);
  const l = normCdf((-0.5 - mean) / sigma);
  const d = Math.max(0, 1 - w - l);
  return { w, d, l };
}

export function heuristicWinProbabilities(proj1: number, proj2: number): WinProbs {
  const diff = proj1 - proj2;
  const p1Raw = 1 / (1 + Math.exp(-0.16 * diff));
  const closeness = Math.exp(-Math.abs(diff) / 7);
  const draw = Math.min(0.28, 0.06 + 0.22 * closeness);
  const rest = 1 - draw;
  return {
    team1: p1Raw * rest,
    draw,
    team2: (1 - p1Raw) * rest,
  };
}

export function percentParts(probs: WinProbs): WinProbs {
  const raw = [probs.team1, probs.draw, probs.team2].map((value) => Math.round(value * 100));
  raw[0] += 100 - raw.reduce((sum, value) => sum + value, 0);
  return { team1: raw[0], draw: raw[1], team2: raw[2] };
}

export function teamProjection(players: PlayerOddsInput[], model: OddsModelId): number {
  if (model === "gaussian-excl") {
    return players.reduce((sum, player) => sum + Number(player.remaining || 0), 0);
  }
  return players.reduce((sum, player) => sum + Number(player.points || 0) + Number(player.remaining || 0), 0);
}

export function teamVariance(players: PlayerOddsInput[]): number {
  return players.reduce((sum, player) => sum + 9 * Math.max(0, Number(player.frac || 0)), 0);
}

export function breakdownProjected(player: PlayerOddsInput, model: OddsModelId): number {
  if (model === "gaussian-excl") return Number(player.remaining || 0);
  return Number(player.points || 0) + Number(player.remaining || 0);
}

export function computeMatchupOdds(
  team1: PlayerOddsInput[],
  team2: PlayerOddsInput[],
  model: OddsModelId,
): {
  probs: WinProbs;
  proj1: number;
  proj2: number;
  twoWay: boolean;
} {
  const proj1 = teamProjection(team1, model);
  const proj2 = teamProjection(team2, model);

  if (model === "heuristic") {
    return {
      probs: percentParts(heuristicWinProbabilities(proj1, proj2)),
      proj1,
      proj2,
      twoWay: false,
    };
  }

  const var1 = teamVariance(team1);
  const var2 = teamVariance(team2);
  const raw = gaussianMatchProbs(proj1, var1, proj2, var2);
  let pLeft = Math.round((raw.w + raw.d / 2) * 100);
  if (var1 + var2 > 0) {
    pLeft = Math.min(99, Math.max(1, pLeft));
  }
  pLeft = Math.max(0, Math.min(100, pLeft));
  return {
    probs: { team1: pLeft, draw: 0, team2: 100 - pLeft },
    proj1,
    proj2,
    twoWay: true,
  };
}
