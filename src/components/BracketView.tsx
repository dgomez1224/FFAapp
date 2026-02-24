/**
 * Bracket View - Public Read-Only
 * 
 * Displays knockout bracket with two-leg ties.
 * No authentication required - uses static entry ID to resolve tournament context.
 */

import React, { useEffect, useState } from "react";
import { getSupabaseFunctionHeaders, supabaseUrl } from "../lib/supabaseClient";
import { Card } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { useTournamentContext } from "../lib/tournamentContext";
import { EDGE_FUNCTIONS_BASE, CURRENT_SEASON } from "../lib/constants";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

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
  const { loading: contextLoading } = useTournamentContext();
  const [group, setGroup] = useState<BracketResponse["group"] | null>({
    registeredCount: 0,
    standings: [],
    autoRegistered: true,
    start_gameweek: null,
    end_gameweek: null,
  });
  const [rounds, setRounds] = useState<BracketRound[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<string>("current");

  useEffect(() => {
    // Only load current season bracket if we're showing current season
    if (contextLoading || (showLegacySelector && selectedSeason !== "current")) {
      return;
    }

    async function loadBracket() {
      setLoading(true);
      setError(null);

      try {
        const functionsBase = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}`;
        const res = await fetch(`${functionsBase}/bracket`, {
          headers: getSupabaseFunctionHeaders(),
        });
        const payload: BracketResponse = await res.json();

        if (!res.ok || payload?.error) {
          // Don't throw error - just set empty state
          console.warn("Bracket load warning:", payload?.error?.message || "Unable to load bracket");
          setGroup({ registeredCount: 0, standings: [], autoRegistered: true, start_gameweek: null, end_gameweek: null });
          setRounds([]);
        } else {
          setGroup(payload.group ?? { registeredCount: 0, standings: [], autoRegistered: true, start_gameweek: null, end_gameweek: null });
          setRounds(payload.rounds ?? []);
        }
      } catch (err: any) {
        console.error("Bracket load error:", err);
        // Set empty state instead of error - allow UI to render
        setGroup({ registeredCount: 0, standings: [], autoRegistered: true, start_gameweek: null, end_gameweek: null });
        setRounds([]);
      } finally {
        setLoading(false);
      }
    }

    loadBracket();
  }, [contextLoading, showLegacySelector, selectedSeason]);

  const renderEmptyBracket = () => {
    // Simple 8-team knockout skeleton: 4 quarter-finals, 2 semis, 1 final.
    const quarterfinals = [1, 2, 3, 4];
    const semifinals = [1, 2];

    return (
      <div className="mt-2 flex gap-6 overflow-x-auto text-xs text-muted-foreground">
        <div className="space-y-2">
          <div className="text-center text-[11px] font-semibold uppercase">Quarter-finals</div>
          {quarterfinals.map((n) => (
            <div key={`qf-${n}`} className="w-48 rounded-md border bg-muted/40 p-2">
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
            <div key={`sf-${n}`} className="w-48 rounded-md border bg-muted/40 p-2">
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
          <div className="w-48 rounded-md border bg-muted/40 p-2">
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
          title={`FFA Cup knockout bracket ${legacy.season}`}
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
        <div>
          <h1 className="text-2xl font-semibold">Knockout bracket</h1>
          <p className="text-sm text-muted-foreground">
            Two-leg ties with automatic progression based on aggregate score.
          </p>
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
              <div className="mb-3">
                <h2 className="text-lg font-semibold">FFA Cup Group Stage</h2>
                <p className="text-sm text-muted-foreground">
                  {group.autoRegistered ? "All league members are auto-registered." : "Group stage standings."}
                </p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Rank</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Manager</TableHead>
                    <TableHead className="text-right">Total Points</TableHead>
                    <TableHead className="text-right">Captain Points</TableHead>
                    <TableHead className="text-right">Played</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.standings.map((team) => {
                    const advancingCount = Math.ceil(group.standings.length * 0.8);
                    const advancing = team.rank <= advancingCount;
                    return (
                      <TableRow
                        key={team.team_id}
                        className={advancing ? "bg-green-50 dark:bg-green-950/40 font-semibold" : ""}
                      >
                        <TableCell>{team.rank}</TableCell>
                        <TableCell>{team.entry_name}</TableCell>
                        <TableCell>{team.manager_name}</TableCell>
                        <TableCell className="text-right font-medium">
                          {team.total_points}
                        </TableCell>
                        <TableCell className="text-right">{team.captain_points}</TableCell>
                        <TableCell className="text-right">{team.played}</TableCell>
                        <TableCell className="text-center">
                          {advancing ? (
                            <span className="text-green-600 dark:text-green-400">Advancing</span>
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
        rounds.length === 0 ? (
          <Card className="p-4">
            <p className="text-sm text-muted-foreground mb-2">
              Knockout bracket will appear once the group stage is complete.
            </p>
            {renderEmptyBracket()}
          </Card>
        ) : (
          <Card className="overflow-x-auto p-4">
            <div className="flex gap-6 min-w-max">
              {rounds.map((round) => (
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
                              <span className="truncate">{team1Name}</span>
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
                              <span className="truncate">{team2Name}</span>
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
