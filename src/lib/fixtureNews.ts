export type FixtureNewsPlayer = {
  manager: string;
  playerName: string;
  points: number;
  minutes?: number;
  goals?: number;
  assists?: number;
};

function formatHaul(p: FixtureNewsPlayer) {
  const extras = [p.goals ? `${p.goals}G` : "", p.assists ? `${p.assists}A` : ""].filter(Boolean).join(", ");
  return `${p.playerName} (${p.manager}) ${p.points} pts${extras ? ` · ${extras}` : ""}`;
}

export function buildLeagueFixtureSummary(opts: {
  managerA: string;
  managerB: string;
  scoreA: number;
  scoreB: number;
  players?: FixtureNewsPlayer[];
}): string {
  const a = opts.managerA;
  const b = opts.managerB;
  const scoreA = Math.round(Number(opts.scoreA || 0));
  const scoreB = Math.round(Number(opts.scoreB || 0));
  const margin = Math.abs(scoreA - scoreB);
  const winner = scoreA === scoreB ? null : scoreA > scoreB ? a : b;
  const loser = winner === a ? b : winner === b ? a : null;

  let game = "";
  if (!winner) game = "A share of the spoils.";
  else if (margin <= 5) game = `A nail-biter. ${winner} sneaked it by ${margin}.`;
  else if (margin <= 10) game = `A tight, ${margin}-point game. ${winner} nicked it.`;
  else if (margin >= 25) game = `A ${margin}-point blowout. ${winner} ran away with it.`;
  else game = `${winner} beat ${loser} by ${margin}.`;

  const players = [...(opts.players || [])].filter((p) => p.playerName);
  const byPoints = [...players].sort((x, y) => y.points - x.points);
  const played = players.filter((p) => Number(p.minutes || 0) > 0 || p.points !== 0);
  const byLow = [...(played.length ? played : players)].sort((x, y) => x.points - y.points);

  const tops = byPoints.filter((p) => p.points >= 8).slice(0, 2);
  const lows = byLow.filter((p) => p.points <= 2).slice(0, 2);

  const parts = [game];
  if (tops.length) parts.push(`Top: ${tops.map(formatHaul).join("; ")}.`);
  if (lows.length) parts.push(`Quiet night: ${lows.map(formatHaul).join("; ")}.`);

  if (winner && tops[0] && tops[0].manager === winner && tops[0].points >= 12 && margin <= 10) {
    parts.push(`${tops[0].playerName}'s haul dragged ${winner} over the line.`);
  } else if (winner && tops[0] && tops[0].manager === loser && margin <= 12) {
    parts.push(`Not enough: ${tops[0].playerName} starred for ${loser} in a losing cause.`);
  } else if (winner) {
    const winnerHaul = byPoints.find((p) => p.manager === winner && p.points >= 14);
    const loserQuiet = byLow.find((p) => p.manager === loser && p.points <= 1);
    if (winnerHaul && loserQuiet && margin >= 6 && margin <= 12) {
      parts.push(
        `${winner} came back on the back of ${winnerHaul.playerName} while ${loserQuiet.playerName} went missing.`,
      );
    }
  }

  return parts.filter(Boolean).join(" ");
}
