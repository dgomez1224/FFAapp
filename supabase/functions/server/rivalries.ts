/**
 * Named league rivalries. Participants use canonical manager names.
 */

export type RivalryType =
  | "french_derby"
  | "dalton_derby"
  | "cugino_derby"
  | "lansing_derby"
  | "sibling_derby"
  | "misc";

export type Rivalry = {
  id: string;
  name: string;
  type: RivalryType;
  participants: string[];
  description: string;
  rivalryLevel: "intense" | "moderate" | "friendly";
  region?: string;
  background?: string;
};

export const RIVALRIES: Rivalry[] = [
  {
    id: "french_derby_1",
    name: "French Derby",
    type: "french_derby",
    participants: ["LENNART", "KARIM"],
    description: "French footballing pride between two of the league's most passionate managers.",
    rivalryLevel: "intense",
    background: "Both managers bring French flair and tactical knowledge to every encounter.",
  },
  {
    id: "french_derby_2",
    name: "French Derby",
    type: "french_derby",
    participants: ["HENRI", "LENNART"],
    description: "A clash of French football philosophies between two decorated managers.",
    rivalryLevel: "intense",
    background: "Henri and Lennart have a long history of competitive matches dating back to the league's early days.",
  },
  {
    id: "dalton_derby",
    name: "Dalton Derby",
    type: "dalton_derby",
    participants: ["MATT", "DAVID", "BENJI", "CHRIS", "ANDREW", "MARCO"],
    description: "The local derby featuring managers from the Dalton area. Bragging rights are always on the line.",
    rivalryLevel: "intense",
    background: "The Dalton Derby is the most hotly contested local rivalry in the league.",
  },
  {
    id: "cugino_derby_1",
    name: "Cugino Derby",
    type: "cugino_derby",
    participants: ["MATT", "IAN"],
    description: "Italian football heritage between two managers with deep footballing knowledge.",
    rivalryLevel: "intense",
  },
  {
    id: "cugino_derby_2",
    name: "Cugino Derby",
    type: "cugino_derby",
    participants: ["MATT", "PATRICK"],
    description: "Italian footballing pride on the line as two tactical managers face off.",
    rivalryLevel: "moderate",
  },
  {
    id: "cugino_derby_3",
    name: "Cugino Derby",
    type: "cugino_derby",
    participants: ["MATT", "LUKE"],
    description: "Italian heritage meets American ambition in this matchup.",
    rivalryLevel: "moderate",
  },
  {
    id: "cugino_derby_4",
    name: "Cugino Derby",
    type: "cugino_derby",
    participants: ["IAN", "PATRICK"],
    description: "A clash of Italian football philosophies.",
    rivalryLevel: "moderate",
  },
  {
    id: "cugino_derby_5",
    name: "Cugino Derby",
    type: "cugino_derby",
    participants: ["IAN", "LUKE"],
    description: "Italian-American footballing pride at stake.",
    rivalryLevel: "friendly",
  },
  {
    id: "cugino_derby_6",
    name: "Cugino Derby",
    type: "cugino_derby",
    participants: ["PATRICK", "LUKE"],
    description: "Two managers with Italian heritage battle for supremacy.",
    rivalryLevel: "friendly",
  },
  {
    id: "lansing_derby_1",
    name: "Lansing Derby",
    type: "lansing_derby",
    participants: ["LUKE", "GRANT"],
    description: "The Lansing local derby between two managers from Michigan's capital city.",
    rivalryLevel: "intense",
  },
  {
    id: "lansing_derby_2",
    name: "Lansing Derby",
    type: "lansing_derby",
    participants: ["LUKE", "ZACH"],
    description: "Lansing bragging rights on the line.",
    rivalryLevel: "moderate",
  },
  {
    id: "lansing_derby_3",
    name: "Lansing Derby",
    type: "lansing_derby",
    participants: ["IAN", "GRANT"],
    description: "The battle for Lansing supremacy.",
    rivalryLevel: "moderate",
  },
  {
    id: "lansing_derby_4",
    name: "Lansing Derby",
    type: "lansing_derby",
    participants: ["IAN", "ZACH"],
    description: "Lansing footballing pride at stake.",
    rivalryLevel: "friendly",
  },
  {
    id: "lansing_derby_5",
    name: "Lansing Derby",
    type: "lansing_derby",
    participants: ["GRANT", "ZACH"],
    description: "Two Lansing natives battle for city bragging rights.",
    rivalryLevel: "friendly",
  },
  {
    id: "sibling_derby",
    name: "Sibling Derby",
    type: "sibling_derby",
    participants: ["CHRIS", "BRENDAN"],
    description: "Brothers Chris and Brendan face off with family bragging rights on the line.",
    rivalryLevel: "intense",
    background: "Brothers Chris and Brendan bring their lifelong rivalry to the fantasy pitch.",
  },
  {
    id: "misc_1",
    name: "Matt vs Max",
    type: "misc",
    participants: ["MATT", "MAX"],
    description: "A competitive rivalry between two of the league's most consistent managers.",
    rivalryLevel: "moderate",
  },
  {
    id: "misc_2",
    name: "David vs Rohun",
    type: "misc",
    participants: ["DAVID", "ROHUN"],
    description: "An emerging rivalry between two managers with contrasting styles.",
    rivalryLevel: "moderate",
  },
  {
    id: "misc_3",
    name: "Benji vs Jordan",
    type: "misc",
    participants: ["BENJI", "JORDAN"],
    description: "A matchup that regularly produces drama.",
    rivalryLevel: "friendly",
  },
];

function canon(name: unknown): string | null {
  const upper = String(name ?? "").trim().toUpperCase();
  if (!upper) return null;
  if (upper === "MATTHEW") return "MATT";
  if (upper === "SEB") return "SEBASTIAN";
  const first = upper.split(/[^A-Z]+/).filter(Boolean)[0] || upper;
  return first || null;
}

export function leagueMatchupPath(gameweek: number, team1?: string | number | null, team2?: string | number | null) {
  if (!gameweek || team1 == null || team2 == null || team1 === "" || team2 === "") return "/dashboard";
  return `/matchup/league/${gameweek}/${encodeURIComponent(String(team1))}/${encodeURIComponent(String(team2))}`;
}

export function findRivalry(managerA: unknown, managerB: unknown): Rivalry | null {
  const a = canon(managerA);
  const b = canon(managerB);
  if (!a || !b || a === b) return null;
  const pair = RIVALRIES.find(
    (r) => r.participants.length === 2 && r.participants.includes(a) && r.participants.includes(b),
  );
  if (pair) return pair;
  return (
    RIVALRIES.find(
      (r) => r.participants.length > 2 && r.participants.includes(a) && r.participants.includes(b),
    ) || null
  );
}

export type RivalryNewsDraft = {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  category: "league";
  kind: string;
  rivalryType: RivalryType;
  publishedAt: string;
};

export function buildRivalryNewsItem(opts: {
  rivalry: Rivalry;
  managerA: string;
  managerB: string;
  status: "upcoming" | "live" | "completed";
  gameweek: number;
  scoreA?: number;
  scoreB?: number;
  h2h?: { aWins: number; bWins: number; draws: number } | null;
  topPerformers?: Array<{ manager: string; playerName: string; points: number; goals?: number; assists?: number }>;
  publishedAt: string;
  matchupUrl?: string;
}): RivalryNewsDraft {
  const a = opts.managerA;
  const b = opts.managerB;
  const rivalry = opts.rivalry;
  const played = opts.h2h ? opts.h2h.aWins + opts.h2h.bWins + opts.h2h.draws : 0;
  let h2hLine = "";
  if (opts.h2h && played > 0) {
    h2hLine = `All-time H2H: ${a} ${opts.h2h.aWins}–${opts.h2h.draws}–${opts.h2h.bWins} ${b} (${played} meetings).`;
    if (opts.h2h.aWins > opts.h2h.bWins) h2hLine += ` ${a} holds the historical edge.`;
    else if (opts.h2h.bWins > opts.h2h.aWins) h2hLine += ` ${b} holds the historical edge.`;
    else h2hLine += " This rivalry has been evenly matched.";
  }
  const flavor = rivalry.background || rivalry.description;
  const scoreA = Math.round(Number(opts.scoreA || 0));
  const scoreB = Math.round(Number(opts.scoreB || 0));
  const url = opts.matchupUrl || "/dashboard";

  if (opts.status === "upcoming") {
    return {
      id: `rivalry-upcoming-${opts.gameweek}-${a}-${b}-${rivalry.id}`,
      title: `${rivalry.name} preview: ${a} vs ${b}`,
      summary: [flavor, h2hLine, `GW ${opts.gameweek} is next.`].filter(Boolean).join(" "),
      url,
      source: "League of Lads",
      category: "league",
      kind: "rivalry",
      rivalryType: rivalry.type,
      publishedAt: opts.publishedAt,
    };
  }

  if (opts.status === "live") {
    return {
      id: `rivalry-live-${opts.gameweek}-${a}-${b}-${rivalry.id}`,
      title: `LIVE ${rivalry.name}: ${a} ${scoreA}–${scoreB} ${b}`,
      summary: [`The ${rivalry.name} is underway in GW ${opts.gameweek}.`, h2hLine, flavor]
        .filter(Boolean)
        .join(" "),
      url,
      source: "League of Lads",
      category: "league",
      kind: "rivalry",
      rivalryType: rivalry.type,
      publishedAt: opts.publishedAt,
    };
  }

  const winner = scoreA === scoreB ? null : scoreA > scoreB ? a : b;
  const margin = Math.abs(scoreA - scoreB);
  let narrative = "";
  if (!winner) narrative = "A tense draw — neither side could take the bragging rights.";
  else if (margin <= 8) narrative = `A tight, hard-fought ${rivalry.name}. ${winner} nicked it.`;
  else narrative = `${winner} takes the bragging rights in this ${rivalry.name}.`;

  const stars = (opts.topPerformers || [])
    .slice(0, 3)
    .map((p) => `${p.playerName} (${p.manager}) ${p.points} pts`)
    .join("; ");

  return {
    id: `rivalry-done-${opts.gameweek}-${a}-${b}-${rivalry.id}`,
    title: `${rivalry.name}: ${a} ${scoreA}–${scoreB} ${b}`,
    summary: [narrative, stars ? `Top performers: ${stars}.` : "", h2hLine, flavor].filter(Boolean).join(" "),
    url,
    source: "League of Lads",
    category: "league",
    kind: "rivalry",
    rivalryType: rivalry.type,
    publishedAt: opts.publishedAt,
  };
}
