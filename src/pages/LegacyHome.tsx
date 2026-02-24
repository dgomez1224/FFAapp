/**
 * Home Page - Legacy League Standings
 * 
 * Displays league standings tables using FPL-style formatting.
 * Shows all-time stats and season-by-season standings.
 */

import React, { useEffect, useState } from "react";
import { getSupabaseFunctionHeaders, supabase, supabaseUrl } from "../lib/supabaseClient";
import { Card } from "../components/ui/card";
import { LegacyStandingsTable } from "../components/LegacyStandingsTable";
import { EDGE_FUNCTIONS_BASE, HISTORICAL_STATS_CUTOFF_SEASON } from "../lib/constants";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Link } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";

interface AllTimeStat {
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
}

interface SeasonStanding {
  season: string;
  manager_name: string;
  final_rank: number;
  wins: number;
  draws: number;
  losses: number;
  points_for: number;
  points: number;
  competition_type: string;
}

interface LeaderLine {
  manager_name: string;
  value: number;
  details: string | null;
}

interface LeaderMetric {
  value: number;
  leaders: LeaderLine[];
}

interface LegacyLeadersPayload {
  season: string;
  all_time: {
    points_in_gameweek: LeaderMetric;
    most_50_plus_gws: LeaderMetric;
    longest_win_streak: LeaderMetric;
    longest_unbeaten_streak: LeaderMetric;
    longest_losing_streak: LeaderMetric;
    longest_winless_streak: LeaderMetric;
  };
  season_leaders: {
    points_in_gameweek: LeaderMetric;
    most_50_plus_gws: LeaderMetric;
    longest_win_streak: LeaderMetric;
    longest_unbeaten_streak: LeaderMetric;
    longest_losing_streak: LeaderMetric;
    longest_winless_streak: LeaderMetric;
  };
}

function canonicalManagerName(name: string): string {
  const normalized = String(name || "").trim().toUpperCase();
  if (normalized === "MATTHEW") return "MATT";
  return normalized;
}

export default function Home() {
  const [allTimeStats, setAllTimeStats] = useState<AllTimeStat[]>([]);
  const [seasons, setSeasons] = useState<string[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [leagueStandings, setLeagueStandings] = useState<SeasonStanding[]>([]);
  const [gobletStandings, setGobletStandings] = useState<SeasonStanding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allTimeSort, setAllTimeSort] = useState<{ key: string; dir: "asc" | "desc" }>({
    key: "points",
    dir: "desc",
  });
  const [leaders, setLeaders] = useState<LegacyLeadersPayload | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch all-time stats
        const allTimeUrl = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/legacy-stats/all-time`;
        const allTimeRes = await fetch(allTimeUrl, { headers: getSupabaseFunctionHeaders() });
        const allTimePayload = await allTimeRes.json();
        if (!allTimeRes.ok || allTimePayload?.error) {
          throw new Error(allTimePayload?.error?.message || "Failed to fetch all-time stats");
        }
        setAllTimeStats(allTimePayload?.stats || []);

        // Fetch available seasons
        const { data: seasonsData, error: seasonsError } = await supabase
          .from("legacy_season_standings")
          .select("season")
          .lt("season", HISTORICAL_STATS_CUTOFF_SEASON);
        if (seasonsError) {
          throw new Error(seasonsError.message);
        }
        const uniqueSeasons = Array.from(
          new Set((seasonsData || []).map((row) => row.season))
        )
          .sort()
          .reverse();
        if (uniqueSeasons.length > 0) {
          setSeasons(uniqueSeasons);
          if (!selectedSeason) {
            setSelectedSeason(uniqueSeasons[0]);
          }
        }
      } catch (err: any) {
        setError(err.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  useEffect(() => {
    async function loadLeaders() {
      try {
        const leadersUrl = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/legacy-stats/leaders${selectedSeason ? `?season=${encodeURIComponent(selectedSeason)}` : ""}`;
        const leadersRes = await fetch(leadersUrl, { headers: getSupabaseFunctionHeaders() });
        const leadersPayload = await leadersRes.json();
        if (!leadersRes.ok || leadersPayload?.error) {
          throw new Error(leadersPayload?.error?.message || "Failed to fetch legacy leaders");
        }
        setLeaders(leadersPayload);
      } catch (err) {
        console.error("Failed to load legacy leaders", err);
      }
    }
    loadLeaders();
  }, [selectedSeason]);

  useEffect(() => {
    if (!selectedSeason) return;

    async function loadSeasonStandings() {
      try {
        const [leagueRes, gobletRes] = await Promise.all([
          supabase
            .from("legacy_season_standings")
            .select("*")
            .eq("season", selectedSeason)
            .eq("competition_type", "league")
            .order("final_rank", { ascending: true }),
          supabase
            .from("legacy_season_standings")
            .select("*")
            .eq("season", selectedSeason)
            .eq("competition_type", "goblet")
            .order("final_rank", { ascending: true }),
        ]);

        if (leagueRes.error) {
          throw new Error(leagueRes.error.message);
        }
        if (gobletRes.error) {
          throw new Error(gobletRes.error.message);
        }

        const mergeRows = (rows: SeasonStanding[]) => {
          const map = new Map<string, SeasonStanding>();
          (rows || []).forEach((row) => {
            const manager = canonicalManagerName(row.manager_name);
            const existing = map.get(manager);
            if (!existing) {
              map.set(manager, { ...row, manager_name: manager });
              return;
            }
            map.set(manager, {
              ...existing,
              wins: existing.wins + (row.wins || 0),
              draws: existing.draws + (row.draws || 0),
              losses: existing.losses + (row.losses || 0),
              points_for: existing.points_for + (row.points_for || 0),
              points: existing.points + (row.points || 0),
              final_rank: Math.min(existing.final_rank || 999, row.final_rank || 999),
            });
          });
          return Array.from(map.values()).sort((a, b) => (a.final_rank || 999) - (b.final_rank || 999));
        };

        setLeagueStandings(mergeRows((leagueRes.data || []) as SeasonStanding[]));
        setGobletStandings(mergeRows((gobletRes.data || []) as SeasonStanding[]));
      } catch (err) {
        console.error("Failed to load season standings:", err);
      }
    }

    loadSeasonStandings();
  }, [selectedSeason]);

  if (loading) {
    return (
      <Card className="p-6">
        <h1 className="mb-4 text-xl font-semibold">League Standings</h1>
        <p className="text-sm text-muted-foreground">Loading...</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <h1 className="mb-4 text-xl font-semibold">League Standings</h1>
        <p className="text-sm text-destructive">{error}</p>
      </Card>
    );
  }

  const allTimeTableData = allTimeStats.map((stat) => ({
    manager_name: stat.manager_name,
    wins: stat.wins,
    draws: stat.draws,
    losses: stat.losses,
    points_for: stat.points_plus,
    points: stat.total_points,
  }));

  const sortedAllTimeTableData = [...allTimeTableData].sort((a: any, b: any) => {
    const av = a?.[allTimeSort.key];
    const bv = b?.[allTimeSort.key];
    const an = Number(av);
    const bn = Number(bv);
    let cmp = 0;
    if (!Number.isNaN(an) && !Number.isNaN(bn) && av !== "" && bv !== "") {
      cmp = an - bn;
    } else {
      cmp = String(av ?? "").localeCompare(String(bv ?? ""));
    }
    return allTimeSort.dir === "asc" ? cmp : -cmp;
  });

  const toggleAllTimeSort = (key: string) => {
    setAllTimeSort((prev) => ({
      key,
      dir: prev.key === key && prev.dir === "asc" ? "desc" : "asc",
    }));
  };

  const allTimeSortLabel = (key: string) =>
    allTimeSort.key === key ? (allTimeSort.dir === "asc" ? " ↑" : " ↓") : "";

  const renderLeader = (row?: LeaderMetric) => {
    if (!row || !row.leaders?.length) return "—";
    return row.leaders
      .map((l) => {
        const details = l.details || "";
        const isPointsInGwFormat = details.startsWith(`${l.value}:`);
        if (isPointsInGwFormat) return `${l.manager_name} (${details})`;
        return `${l.manager_name} (${l.value} GW${details ? `: ${details}` : ""})`;
      })
      .join(" / ");
  };

  // Format season standings for tables
  const leagueTableData = leagueStandings.map((s) => ({
    rank: s.final_rank === 1 ? "C" : s.final_rank,
    manager_name: s.manager_name,
    wins: s.wins,
    draws: s.draws,
    losses: s.losses,
    points_for: s.points_for,
    points: s.points,
  }));

  const gobletTableData = gobletStandings.map((s) => ({
    rank: s.final_rank === 1 ? "C" : s.final_rank,
    manager_name: s.manager_name,
    wins: s.wins,
    draws: s.draws,
    losses: s.losses,
    points_for: s.points_for,
    points: s.points,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">FFA League Standings</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Historical league statistics and standings
        </p>
      </div>

      <Tabs defaultValue="all-time" className="w-full">
        <TabsList>
          <TabsTrigger value="all-time">All-Time</TabsTrigger>
          <TabsTrigger value="season">By Season</TabsTrigger>
        </TabsList>

        <TabsContent value="all-time" className="mt-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-3 text-gray-900">All-Time League Standings</h3>
              <div className="fpl-table-container">
                <Table>
                  <TableHeader>
                    <TableRow className="fpl-table-header">
                    <TableHead className="cursor-pointer" onClick={() => toggleAllTimeSort("manager_name")}>Manager{allTimeSortLabel("manager_name")}</TableHead>
                    <TableHead className="cursor-pointer text-right" onClick={() => toggleAllTimeSort("wins")}>W{allTimeSortLabel("wins")}</TableHead>
                    <TableHead className="cursor-pointer text-right" onClick={() => toggleAllTimeSort("draws")}>D{allTimeSortLabel("draws")}</TableHead>
                    <TableHead className="cursor-pointer text-right" onClick={() => toggleAllTimeSort("losses")}>L{allTimeSortLabel("losses")}</TableHead>
                    <TableHead className="cursor-pointer text-right" onClick={() => toggleAllTimeSort("points_for")}>For{allTimeSortLabel("points_for")}</TableHead>
                    <TableHead className="cursor-pointer text-right" onClick={() => toggleAllTimeSort("points")}>Pts{allTimeSortLabel("points")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="fpl-table-body">
                    {sortedAllTimeTableData.map((row) => (
                      <TableRow key={row.manager_name}>
                        <TableCell className="fpl-manager-name">{row.manager_name}</TableCell>
                        <TableCell className="fpl-numeric">{row.wins}</TableCell>
                        <TableCell className="fpl-numeric">{row.draws}</TableCell>
                        <TableCell className="fpl-numeric">{row.losses}</TableCell>
                        <TableCell className="fpl-numeric">{row.points_for}</TableCell>
                        <TableCell className="fpl-points">{row.points}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-2">Manager Profiles:</p>
                <div className="flex flex-wrap gap-2">
                  {allTimeStats.map((stat) => (
                    <Link
                      key={stat.manager_name}
                      to={`/manager/${stat.manager_name.toLowerCase()}`}
                      className="px-3 py-1 text-sm border rounded-md hover:bg-muted transition-colors"
                    >
                      {stat.manager_name}
                    </Link>
                  ))}
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-3 text-gray-900">All-Time Stat Leaders</h3>
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Points in a GW</TableCell>
                    <TableCell>{renderLeader(leaders?.all_time.points_in_gameweek)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Most 50+ GW&apos;s</TableCell>
                    <TableCell>{renderLeader(leaders?.all_time.most_50_plus_gws)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Longest Win Streak</TableCell>
                    <TableCell>{renderLeader(leaders?.all_time.longest_win_streak)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Longest Unbeaten Streak</TableCell>
                    <TableCell>{renderLeader(leaders?.all_time.longest_unbeaten_streak)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Longest Losing Streak</TableCell>
                    <TableCell>{renderLeader(leaders?.all_time.longest_losing_streak)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Longest Winless Streak</TableCell>
                    <TableCell>{renderLeader(leaders?.all_time.longest_winless_streak)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="season" className="mt-4 space-y-4">
          {seasons.length > 0 && (
            <Card className="p-4">
              <div className="mb-4">
                <label className="text-sm font-medium mb-2 block">Select Season</label>
                <select
                  value={selectedSeason || ""}
                  onChange={(e) => setSelectedSeason(e.target.value)}
                  className="px-3 py-2 border rounded-md"
                >
                  {seasons.map((season) => (
                    <option key={season} value={season}>
                      {season}
                    </option>
                  ))}
                </select>
              </div>
            </Card>
          )}

          {selectedSeason && (
            <>
              <Card className="p-4">
                <LegacyStandingsTable
                  standings={leagueTableData}
                  title={`${selectedSeason} League Standings`}
                  showPointsFor={true}
                />
              </Card>

              {gobletTableData.length > 0 && (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <Card className="p-4">
                    <LegacyStandingsTable
                      standings={gobletTableData}
                      title={`${selectedSeason} Goblet Standings`}
                      showPointsFor={true}
                    />
                  </Card>
                  <Card className="p-4">
                    <h3 className="text-lg font-semibold mb-3">{selectedSeason} Season Leaders</h3>
                    <Table>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium">Points in a GW</TableCell>
                          <TableCell>{renderLeader(leaders?.season_leaders.points_in_gameweek)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">Most 50+ GW&apos;s</TableCell>
                          <TableCell>{renderLeader(leaders?.season_leaders.most_50_plus_gws)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">Longest Win Streak</TableCell>
                          <TableCell>{renderLeader(leaders?.season_leaders.longest_win_streak)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">Longest Unbeaten Streak</TableCell>
                          <TableCell>{renderLeader(leaders?.season_leaders.longest_unbeaten_streak)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">Longest Losing Streak</TableCell>
                          <TableCell>{renderLeader(leaders?.season_leaders.longest_losing_streak)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">Longest Winless Streak</TableCell>
                          <TableCell>{renderLeader(leaders?.season_leaders.longest_winless_streak)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </Card>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
