/**
 * Bracket View - Public Read-Only
 * 
 * Displays knockout bracket with two-leg ties.
 * No authentication required - uses static entry ID to resolve tournament context.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSupabaseFunctionHeaders, supabaseUrl } from "../lib/supabaseClient";
import { Card } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { useTournamentContext } from "../lib/tournamentContext";
import { EDGE_FUNCTIONS_BASE, CURRENT_SEASON } from "../lib/constants";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { useManagerCrestMap } from "../lib/useManagerCrestMap";
import cupTrophy from "../assets/trophies/FFA Cup Icon + Year.png";

/** Cup knockout starts at GW 29; use for lineup links from bracket. */
const CUP_LINEUP_GAMEWEEK = 29;

interface MatchupTeam {
  id: string;
  entry_name: string;
  manager_name: string;
  seed: number | null;
}

interface Matchup {
  id: string;
  round: string;
  matchup_number: number;
  team_1_id: string | null;
  team_2_id: string | null;
  leg_1_gameweek: number;
  leg_2_gameweek: number;
  team_1_leg_1_points: number | null;
  team_1_leg_2_points: number | null;
  team_2_leg_1_points: number | null;
  team_2_leg_2_points: number | null;
  winner_id: string | null;
  tie_breaker_applied: string | null;
  status: string;
  team_1: MatchupTeam | null;
  team_2: MatchupTeam | null;
}

interface BracketRound {
  round: string;
  matchups: Matchup[];
}

interface GroupStanding {
  team_id: string;
  entry_name: string;
  manager_name: string;
  manager_short_name: string;
  total_points: number;
  captain_points: number;
  current_week_points?: number;
  current_week_captain?: number;
  played: number;
  rank: number;
}

interface BracketResponse {
  tournament: {
    id: string;
    name: string;
    season: string;
    status: string;
  } | null;
  group: {
    registeredCount: number;
    standings: GroupStanding[];
    autoRegistered: boolean;
    start_gameweek: number | null;
    end_gameweek: number | null;
  };
  rounds: BracketRound[];
  error?: { message?: string };
}

type BracketViewProps = {
  /**
   * When true (default), show a season selector so users can switch
   * between the current season bracket and legacy embedded brackets.
   * On the main dashboard "Cup" tab we hide this and always show current.
   */
  showLegacySelector?: boolean;
};

/** True when every team has finished all group-stage gameweeks (or calendar is past group end). */
function isGroupStageComplete(
  g: BracketResponse["group"] | null,
  currentGw: number,
): boolean {
  if (!g?.standings?.length) return false;
  const start = g.start_gameweek ?? CUP_LINEUP_GAMEWEEK;
  const end = g.end_gameweek ?? start + 3;
  const expectedRounds = Math.max(1, end - start + 1);
  const allPlayedEnough = g.standings.every((s) => (s.played ?? 0) >= expectedRounds);
  const calendarPastGroup = currentGw > 0 && currentGw > end;
  return allPlayedEnough || calendarPastGroup;
}

/**
 * When the DB has no knockout `matchups` yet, derive a preview QF bracket from group standings
 * (same top fraction as the table: ceil(n * 0.8)), seeded 1vN, 2vN-1, …
 */
function buildSyntheticKnockoutRounds(
  standings: GroupStanding[],
  startGw: number,
  endGw: number,
): BracketRound[] {
  const adv = Math.max(2, Math.ceil(standings.length * 0.8));
  const top = standings.slice(0, adv);
  const pairCount = Math.floor(top.length / 2);
  if (pairCount < 1) return [];

  const toTeam = (s: GroupStanding): MatchupTeam => ({
    id: s.team_id,
    entry_name: s.entry_name,
    manager_name: s.manager_name,
    seed: s.rank,
  });

  const leg1 = endGw + 1;
  const leg2 = endGw + 2;

  const qfMatchups: Matchup[] = [];
  for (let i = 0; i < pairCount; i++) {
    const hi = top[i];
    const lo = top[top.length - 1 - i];
    qfMatchups.push({
      id: `preview-qf-${i + 1}`,
      round: "Quarter-finals",
      matchup_number: i + 1,
      team_1_id: hi.team_id,
      team_2_id: lo.team_id,
      leg_1_gameweek: leg1,
      leg_2_gameweek: leg2,
      team_1_leg_1_points: null,
      team_1_leg_2_points: null,
      team_2_leg_1_points: null,
      team_2_leg_2_points: null,
      winner_id: null,
      tie_breaker_applied: null,
      status: "preview",
      team_1: toTeam(hi),
      team_2: toTeam(lo),
    });
  }

  const tbd = (id: string, round: string, num: number): Matchup => ({
    id,
    round,
    matchup_number: num,
    team_1_id: null,
    team_2_id: null,
    leg_1_gameweek: leg1,
    leg_2_gameweek: leg2,
    team_1_leg_1_points: null,
    team_1_leg_2_points: null,
    team_2_leg_1_points: null,
    team_2_leg_2_points: null,
    winner_id: null,
    tie_breaker_applied: null,
    status: "preview",
    team_1: null,
    team_2: null,
  });

  const semiCount = Math.max(1, Math.floor(pairCount / 2));
  const semiMatchups = Array.from({ length: semiCount }, (_, i) =>
    tbd(`preview-sf-${i + 1}`, "Semi-finals", i + 1),
  );

  return [
    { round: "Quarter-finals", matchups: qfMatchups },
    { round: "Semi-finals", matchups: semiMatchups },
    { round: "Final", matchups: [tbd("preview-final", "Final", 1)] },
  ];
}

/** Column order (legacy DB uses "QF"). */
const DISPLAY_ROUND_ORDER: Record<string, number> = {
  "Quarter-finals": 1,
  QF: 1,
  "Semi-finals": 2,
  Final: 3,
};

function isQfRoundLabel(round: string): boolean {
  const r = String(round);
  return r === "Quarter-finals" || r === "QF";
}

function sortBracketRoundsForDisplay(rs: BracketRound[]): BracketRound[] {
  return [...rs].sort(
    (a, b) =>
      (DISPLAY_ROUND_ORDER[a.round] ?? 99) - (DISPLAY_ROUND_ORDER[b.round] ?? 99) ||
      a.round.localeCompare(b.round),
  );
}

/**
 * When the API returns only quarter-final matchups (e.g. legacy "QF" rows), append Semi-finals + Final
 * placeholder columns so the layout matches a full bracket until those rows exist in `matchups`.
 */
function mergeKnockoutLaterRoundPlaceholders(rounds: BracketRound[], endGw: number): BracketRound[] {
  if (!rounds.length) return rounds;

  const byRound = new Map(rounds.map((r) => [r.round, r]));
  const qfRound = rounds.find((r) => isQfRoundLabel(r.round));
  const qfCount = qfRound?.matchups.length ?? 0;
  if (qfCount < 1) return sortBracketRoundsForDisplay(rounds);

  const expectedSemi = Math.max(1, Math.floor(qfCount / 2));
  const hasSemi = byRound.has("Semi-finals");
  const hasFinal = byRound.has("Final");
  if (hasSemi && hasFinal) return sortBracketRoundsForDisplay(rounds);

  const sfLeg1 = endGw + 3;
  const sfLeg2 = endGw + 4;
  const fiLeg1 = endGw + 5;
  const fiLeg2 = endGw + 6;

  const placeholderMatchup = (
    id: string,
    round: string,
    num: number,
    l1: number,
    l2: number,
  ): Matchup => ({
    id,
    round,
    matchup_number: num,
    team_1_id: null,
    team_2_id: null,
    leg_1_gameweek: l1,
    leg_2_gameweek: l2,
    team_1_leg_1_points: null,
    team_1_leg_2_points: null,
    team_2_leg_1_points: null,
    team_2_leg_2_points: null,
    winner_id: null,
    tie_breaker_applied: null,
    status: "placeholder",
    team_1: null,
    team_2: null,
  });

  const next = [...rounds];
  if (!hasSemi) {
    next.push({
      round: "Semi-finals",
      matchups: Array.from({ length: expectedSemi }, (_, i) =>
        placeholderMatchup(`ui-sf-${i + 1}`, "Semi-finals", i + 1, sfLeg1, sfLeg2),
      ),
    });
  }
  if (!hasFinal) {
    next.push({
      round: "Final",
      matchups: [placeholderMatchup("ui-final", "Final", 1, fiLeg1, fiLeg2)],
    });
  }
  return sortBracketRoundsForDisplay(next);
}

/** Group table rank (1 = best); else `team.seed` from API when set. */
function resolveKnockoutSeed(
  teamId: string | null | undefined,
  team: MatchupTeam | null | undefined,
  standingRankByTeamId: Map<string, number>,
): number | null {
  if (!teamId) return null;
  const fromGroup = standingRankByTeamId.get(String(teamId));
  if (fromGroup != null && fromGroup > 0) return fromGroup;
  const s = team?.seed;
  if (s != null && s > 0) return s;
  return null;
}

const LEGACY_BRACKETS: Array<{ season: string; src: string }> = [
  {
    season: "2021/22",
    src: "https://brackethq.com/b/i1kz/embed/",
  },
  {
    season: "2022/23",
    src: "https://brackethq.com/b/pcq4/embed/",
  },
  {
    season: "2023/24",
    src: "https://brackethq.com/b/cydwb/embed/",
  },
  {
    season: "2024/25",
    src: "https://brackethq.com/b/5ucnc/embed/",
  },
];

export function BracketView({ showLegacySelector = true }: BracketViewProps) {
  const navigate = useNavigate();
  const { loading: contextLoading } = useTournamentContext();
  const { getCrest } = useManagerCrestMap();
  const [currentGw, setCurrentGw] = useState<number>(0);
  const [group, setGroup] = useState<BracketResponse["group"] | null>({
    registeredCount: 0,
    standings: [],
    autoRegistered: true,
    start_gameweek: null,
    end_gameweek: null,
  });
  const [rounds, setRounds] = useState<BracketRound[]>([]);
  const displayRounds = useMemo(() => {
    const start = group?.start_gameweek ?? CUP_LINEUP_GAMEWEEK;
    const endGw = group?.end_gameweek ?? start + 3;

    if (rounds.length > 0) {
      return mergeKnockoutLaterRoundPlaceholders(rounds, endGw);
    }
    if (!group?.standings?.length) return [];
    if (!isGroupStageComplete(group, currentGw)) return [];
    return buildSyntheticKnockoutRounds(group.standings, start, endGw);
  }, [rounds, group, currentGw]);

  const standingRankByTeamId = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of group?.standings ?? []) {
      if (s.team_id) m.set(String(s.team_id), s.rank);
    }
    return m;
  }, [group?.standings]);

  const groupStageComplete = useMemo(
    () => isGroupStageComplete(group, currentGw),
    [group, currentGw],
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<string>("current");
  const [refreshBracketTrigger, setRefreshBracketTrigger] = useState(0);
  const pollingIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const handleRefresh = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setRefreshBracketTrigger((t) => t + 1);
  };

  useEffect(() => {
    if (contextLoading || (showLegacySelector && selectedSeason !== "current")) {
      return;
    }

    let cancelled = false;

    async function loadBracket(): Promise<boolean> {
      if (cancelled) return true;
      let eventFinished = true;
      try {
        const gwRes = await fetch(
          `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/current-gameweek`,
          { headers: getSupabaseFunctionHeaders() as HeadersInit }
        );
        const gwData = gwRes.ok ? await gwRes.json() : null;
        if (gwData?.current_gameweek && !cancelled) {
          setCurrentGw(gwData.current_gameweek);
        }
        eventFinished = gwData?.event_finished === true || gwData?.current_event_finished === true;
      } catch {
        // default eventFinished stays true (no polling)
      }
      if (cancelled) return true;
      setLoading(true);
      setError(null);

      try {
        const functionsBase = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}`;
        const res = await fetch(`${functionsBase}/bracket`, {
          headers: getSupabaseFunctionHeaders() as HeadersInit,
        });
        const payload: BracketResponse = await res.json();

        if (cancelled) return true;

        if (!res.ok || payload?.error) {
          console.warn("Bracket load warning:", payload?.error?.message);
          setGroup({ registeredCount: 0, standings: [], autoRegistered: true, start_gameweek: null, end_gameweek: null });
          setRounds([]);
        } else {
          setGroup(payload.group ?? { registeredCount: 0, standings: [], autoRegistered: true, start_gameweek: null, end_gameweek: null });
          setRounds(payload.rounds ?? []);
        }

        // Overlay names only from h2h-matchups (live scores come from /bracket server-side)
        try {
          const mRes = await fetch(
            `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/h2h-matchups`,
            { headers: getSupabaseFunctionHeaders() as HeadersInit }
          );
          if (mRes.ok && !cancelled) {
            const mJson = await mRes.json();
            const nameByTeamId: Record<string, { entry_name: string; manager_name: string }> = {};

            (mJson?.matchups || []).forEach((m: any) => {
              if (m.team_1_id && m.team_1?.entry_name) {
                nameByTeamId[String(m.team_1_id)] = {
                  entry_name: m.team_1.entry_name,
                  manager_name: m.team_1.manager_name || m.team_1.entry_name,
                };
              }
              if (m.team_2_id && m.team_2?.entry_name) {
                nameByTeamId[String(m.team_2_id)] = {
                  entry_name: m.team_2.entry_name,
                  manager_name: m.team_2.manager_name || m.team_2.entry_name,
                };
              }
            });

            if (Object.keys(nameByTeamId).length > 0 && !cancelled) {
              setGroup((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  standings: prev.standings.map((s) => {
                    const names = nameByTeamId[String(s.team_id)];
                    return names ? { ...s, ...names } : s;
                  }),
                };
              });
            }
          }
        } catch {
          // Non-fatal
        }

      } catch (err: any) {
        if (!cancelled) {
          setGroup({ registeredCount: 0, standings: [], autoRegistered: true, start_gameweek: null, end_gameweek: null });
          setRounds([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
      return eventFinished;
    }

    loadBracket().then((eventFinished) => {
      if (!eventFinished) {
        pollingIntervalRef.current = setInterval(loadBracket, 300_000);
      }
    });
    return () => {
      cancelled = true;
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [contextLoading, showLegacySelector, selectedSeason, refreshBracketTrigger]);

  const renderEmptyBracket = () => {
    // Simple 8-team knockout skeleton: 4 quarter-finals, 2 semis, 1 final.
    const quarterfinals = [1, 2, 3, 4];
    const semifinals = [1, 2];

    return (
      <div className="mt-2 flex gap-6 overflow-x-auto text-xs text-muted-foreground">
        <div className="space-y-2">
          <div className="text-center text-[11px] font-semibold uppercase">Quarter-finals</div>
          {quarterfinals.map((n) => (
            <div key={`qf-${n}`} className="w-48 rounded-md border bg-background/80 p-2">
              <div className="mb-1 text-[10px] uppercase tracking-wide">Match {n}</div>
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">TBD</span>
                  <span className="text-[10px]">– / – (–)</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">TBD</span>
                  <span className="text-[10px]">– / – (–)</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <div className="text-center text-[11px] font-semibold uppercase">Semi-finals</div>
          {semifinals.map((n) => (
            <div key={`sf-${n}`} className="w-48 rounded-md border bg-background/80 p-2">
              <div className="mb-1 text-[10px] uppercase tracking-wide">Semi {n}</div>
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">QF winner</span>
                  <span className="text-[10px]">– / – (–)</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">QF winner</span>
                  <span className="text-[10px]">– / – (–)</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <div className="text-center text-[11px] font-semibold uppercase">Final</div>
          <div className="w-48 rounded-md border bg-background/80 p-2">
            <div className="mb-1 text-[10px] uppercase tracking-wide">Final</div>
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">Semi winner</span>
                <span className="text-[10px]">– / – (–)</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">Semi winner</span>
                <span className="text-[10px]">– / – (–)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderLegacyEmbed = () => {
    const legacy = LEGACY_BRACKETS.find((b) => b.season === selectedSeason);
    if (!legacy) return null;
    const publicBracketUrl = legacy.src.replace("/embed/", "/");

    return (
      <Card className="overflow-hidden p-0">
        <iframe
          key={legacy.season}
          src={legacy.src}
          width="100%"
          height="750"
          frameBorder={0}
          title={`League of Lads knockout bracket ${legacy.season}`}
          loading="lazy"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
        <div className="border-t p-3 text-sm text-muted-foreground">
          If the bracket does not load inline,{" "}
          <a
            href={publicBracketUrl}
            target="_blank"
            rel="noreferrer"
            className="underline hover:no-underline"
          >
            open the {legacy.season} bracket in a new tab
          </a>
          .
        </div>
      </Card>
    );
  };

  const renderLegacyActions = () => {
    const legacy = LEGACY_BRACKETS.find((b) => b.season === selectedSeason);
    if (!legacy) return null;
    const publicBracketUrl = legacy.src.replace("/embed/", "/");

    return (
      <Card className="p-3">
        <div>
          <h2 className="text-base font-semibold">Legacy Bracket: {legacy.season}</h2>
          <p className="text-sm text-muted-foreground">
            Embedded in-app. You can also open BracketHQ directly.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <a
            href={publicBracketUrl}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-2 text-sm border rounded-md hover:bg-muted transition-colors"
          >
            Open Full Bracket
          </a>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img src={cupTrophy} alt="" className="h-10 w-10 object-contain" aria-hidden />
          <div>
            <h1 className="text-2xl font-semibold">FFA Bench Boost Cup</h1>
            <p className="text-sm text-muted-foreground">
              Two-leg ties with automatic progression based on aggregate score.
            </p>
          </div>
        </div>
        {showLegacySelector && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Season</span>
            <Select value={selectedSeason} onValueChange={setSelectedSeason}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select season" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">{CURRENT_SEASON} (current)</SelectItem>
                {LEGACY_BRACKETS.map((b) => (
                  <SelectItem key={b.season} value={b.season}>
                    {b.season}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Show loading state only for current season */}
      {(!showLegacySelector || selectedSeason === "current") && (contextLoading || loading) && (
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Loading bracket...</p>
        </Card>
      )}

      {/* Show error message if there's an error (but still show dropdown) */}
      {error && (!showLegacySelector || selectedSeason === "current") && (
        <Card className="p-4">
          <p className="text-sm text-destructive">{error}</p>
        </Card>
      )}

      {/* Legacy brackets: only embed, no current-season group/bracket */}
      {showLegacySelector && selectedSeason !== "current" && (
        <>
          {renderLegacyActions()}
          {renderLegacyEmbed()}
        </>
      )}

      {/* Current season view: group stage + bracket (or skeleton) */}
      {(!showLegacySelector || selectedSeason === "current") && !contextLoading && !loading && group && (
        <>
          {group.standings.length > 0 ? (
            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">FFA Cup Group Stage</h2>
                  <p className="text-sm text-muted-foreground">
                    {group.autoRegistered ? "All league members are auto-registered." : "Group stage standings."}
                  </p>
                </div>
                {typeof localStorage !== "undefined" && localStorage.getItem("ffa_is_admin") === "true" && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await fetch(`${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/admin/score-cup-gameweek-auto`, {
                          method: "POST",
                          headers: getSupabaseFunctionHeaders() as HeadersInit,
                        });
                        setRefreshBracketTrigger((t) => t + 1);
                      } catch {
                        // ignore
                      }
                    }}
                    className="text-xs text-muted-foreground underline hover:text-foreground"
                  >
                    Refresh Scores
                  </button>
                )}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Rank</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Manager</TableHead>
                    <TableHead className="text-right">Total Pts</TableHead>
                    <TableHead className="text-right">GW Pts</TableHead>
                    <TableHead className="text-right">Total C Pts</TableHead>
                    <TableHead className="text-right">GW C Pts</TableHead>
                    <TableHead className="text-right">Played</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.standings.map((team) => {
                    const advancingCount = Math.ceil(group.standings.length * 0.8);
                    const advancing = team.rank <= advancingCount;
                    const cupStartGw = group?.start_gameweek ?? currentGw;
                    const cupEndGw = group?.end_gameweek ?? currentGw;
                    const linkGw = (currentGw >= cupStartGw && currentGw <= cupEndGw && currentGw > 0)
                      ? currentGw
                      : cupStartGw;
                    const fixtureHref = linkGw && team.team_id
                      ? `/lineup/cup/${linkGw}/${team.team_id}`
                      : null;
                    return (
                      <TableRow
                        key={team.team_id}
                        className={
                          (advancing ? "bg-green-50 dark:bg-green-950/40 font-semibold " : "") +
                          "cursor-pointer hover:bg-muted/50 transition-colors"
                        }
                        onClick={() => navigate(fixtureHref ?? `/lineup/cup/${CUP_LINEUP_GAMEWEEK}/${team.team_id}`)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            navigate(fixtureHref ?? `/lineup/cup/${CUP_LINEUP_GAMEWEEK}/${team.team_id}`);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <TableCell>{team.rank}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getCrest(team.manager_name) ? (
                              <img
                                src={getCrest(team.manager_name)!}
                                alt=""
                                className="h-4 w-4 rounded object-cover border"
                              />
                            ) : null}
                            <span>{team.entry_name}</span>
                          </div>
                        </TableCell>
                        <TableCell>{team.manager_name}</TableCell>
                        <TableCell className="text-right font-medium">
                          {team.total_points ?? 0}
                        </TableCell>
                        <TableCell className="text-right">
                          {team.current_week_points ?? 0}
                        </TableCell>
                        <TableCell className="text-right">
                          {(team.captain_points ?? 0) * 2}
                        </TableCell>
                        <TableCell className="text-right">
                          {(team.current_week_captain ?? 0) * 2}
                        </TableCell>
                        <TableCell className="text-right">{team.played}</TableCell>
                        <TableCell className="text-center">
                          {advancing ? (
                            <span className="text-green-600 dark:text-green-400">
                              {groupStageComplete ? "Qualified" : "Advancing"}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Eliminated</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          ) : group.registeredCount > 0 ? (
            <Card className="p-4">
              <div className="mb-3">
                <h2 className="text-lg font-semibold">FFA Cup Group Stage</h2>
                <p className="text-sm text-muted-foreground">
                  All {group.registeredCount} league members are auto-registered. Tournament begins at gameweek 29.
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                Group stage standings will appear once the tournament begins.
              </p>
            </Card>
          ) : null}
        </>
      )}

      {(!showLegacySelector || selectedSeason === "current") && !contextLoading && !loading && (
        displayRounds.length === 0 ? (
          <Card className="p-4">
            <p className="text-sm text-muted-foreground mb-2">
              Knockout bracket will appear once the group stage is complete.
            </p>
            {renderEmptyBracket()}
          </Card>
        ) : (
          <Card className="overflow-x-auto p-4">
            {rounds.length === 0 && displayRounds.length > 0 && (
              <p className="mb-3 text-xs text-amber-800 dark:text-amber-200">
                Preview from group standings. Official two-leg fixtures and scores will appear here
                once knockout matchups are created in the database.
              </p>
            )}
            <div className="flex gap-6 min-w-max">
              {displayRounds.map((round) => (
                <div key={round.round} className="space-y-4">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground text-center">
                    {round.round}
                  </h2>
                  <div className="space-y-3">
                    {round.matchups.map((m) => {
                      const team1Name =
                        m.team_1?.entry_name ??
                        (m.team_1_id ? `Team ${m.team_1_id}` : "TBD");
                      const team2Name =
                        m.team_2?.entry_name ??
                        (m.team_2_id ? `Team ${m.team_2_id}` : "TBD");
                      const team1Seed = resolveKnockoutSeed(m.team_1_id, m.team_1, standingRankByTeamId);
                      const team2Seed = resolveKnockoutSeed(m.team_2_id, m.team_2, standingRankByTeamId);

                      const team1Agg =
                        (m.team_1_leg_1_points ?? 0) +
                        (m.team_1_leg_2_points ?? 0);
                      const team2Agg =
                        (m.team_2_leg_1_points ?? 0) +
                        (m.team_2_leg_2_points ?? 0);

                      const winner = m.winner_id;

                      return (
                        <div
                          key={m.id}
                          className="relative w-64 rounded-md border bg-card p-3 text-xs"
                        >
                          <div className="mb-1 flex items-center justify-between">
                            <span className="font-medium">
                              Match {m.matchup_number}
                            </span>
                            <span className="text-[10px] uppercase text-muted-foreground">
                              GW {m.leg_1_gameweek} &amp; {m.leg_2_gameweek}
                            </span>
                          </div>
                          <div className="space-y-1">
                            <div
                              className={
                                "flex items-center justify-between gap-2" +
                                (winner && winner === m.team_1_id
                                  ? " font-semibold text-emerald-600"
                                  : "")
                              }
                            >
                              <span className="flex min-w-0 flex-1 items-center gap-1.5">
                                {team1Seed != null ? (
                                  <span
                                    className="shrink-0 text-[10px] font-semibold tabular-nums text-muted-foreground"
                                    title={`Seed ${team1Seed}`}
                                  >
                                    #{team1Seed}
                                  </span>
                                ) : null}
                                <span className="truncate">{team1Name}</span>
                              </span>
                              <span>
                                {m.team_1_leg_1_points ?? "–"} /{" "}
                                {m.team_1_leg_2_points ?? "–"} (
                                {isNaN(team1Agg) ? "–" : team1Agg})
                              </span>
                            </div>
                            <div
                              className={
                                "flex items-center justify-between gap-2" +
                                (winner && winner === m.team_2_id
                                  ? " font-semibold text-emerald-600"
                                  : "")
                              }
                            >
                              <span className="flex min-w-0 flex-1 items-center gap-1.5">
                                {team2Seed != null ? (
                                  <span
                                    className="shrink-0 text-[10px] font-semibold tabular-nums text-muted-foreground"
                                    title={`Seed ${team2Seed}`}
                                  >
                                    #{team2Seed}
                                  </span>
                                ) : null}
                                <span className="truncate">{team2Name}</span>
                              </span>
                              <span>
                                {m.team_2_leg_1_points ?? "–"} /{" "}
                                {m.team_2_leg_2_points ?? "–"} (
                                {isNaN(team2Agg) ? "–" : team2Agg})
                              </span>
                            </div>
                          </div>
                          {m.tie_breaker_applied && (
                            <div className="mt-2 text-[10px] text-muted-foreground">
                              Tie-breaker: {m.tie_breaker_applied}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
    </div>
  );
}
