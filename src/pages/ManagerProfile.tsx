/**
 * Manager Profile Page
 * 
 * Displays comprehensive statistics for a single manager.
 * Uses standardized layout shared by all managers.
 */

import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getSupabaseFunctionHeaders, supabaseUrl } from "../lib/supabaseClient";
import { Card } from "../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { CANONICAL_MANAGERS } from "../lib/canonicalManagers";
import { EDGE_FUNCTIONS_BASE, HISTORICAL_STATS_CUTOFF_SEASON } from "../lib/constants";
import leagueTrophy from "../assets/trophies/League Cup Icon.png";
import cupTrophy from "../assets/trophies/FFA Cup Icon + Year.png";
import gobletTrophy from "../assets/trophies/Goblet Icon.png";

interface ManagerProfileData {
  manager_name: string;
  all_time_stats: any;
  season_standings: any[];
  h2h_all_time: any[];
  h2h_by_season: any[];
  trophies: any[];
  season_stats: any[];
}

type SortDir = "asc" | "desc";

function normalizeFixtureManagerName(name: string) {
  const normalized = String(name || "").trim().toUpperCase();
  if (!normalized) return "";
  const first = normalized.split(/\s+/)[0] || normalized;
  if (first === "MATTHEW") return "MATT";
  return first;
}

export default function ManagerProfile() {
  const { managerName } = useParams<{ managerName: string }>();
  const [data, setData] = useState<ManagerProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seasonSort, setSeasonSort] = useState<{ key: string; dir: SortDir }>({ key: "season", dir: "desc" });
  const [h2hAllTimeSort, setH2hAllTimeSort] = useState<{ key: string; dir: SortDir }>({ key: "opponent_name", dir: "asc" });
  const [h2hSeasonSort, setH2hSeasonSort] = useState<{ key: string; dir: SortDir }>({ key: "opponent_name", dir: "asc" });
  const [selectedH2HSeason, setSelectedH2HSeason] = useState<string>("");
  const [currentRank, setCurrentRank] = useState<number | null>(null);
  const [managerPhotoUrl, setManagerPhotoUrl] = useState<string | null>(null);
  const [currentSeasonFixtures, setCurrentSeasonFixtures] = useState<Array<{
    key: string;
    gameweek: number;
    competition: "League" | "Cup";
    opponent: string;
    manager_points: number | null;
    opponent_points: number | null;
    href: string | null;
  }>>([]);
  const [, setManagerTeamId] = useState<string | null>(null);
  const [nextFixtureName, setNextFixtureName] = useState<string>("—");

  useEffect(() => {
    if (!managerName) return;

    async function loadProfile() {
      try {
        setLoading(true);
        setError(null);

        const normalizedName = managerName.toUpperCase();
        if (!CANONICAL_MANAGERS.includes(normalizedName as (typeof CANONICAL_MANAGERS)[number])) {
          throw new Error("Manager not found");
        }

        const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/legacy-stats/manager/${normalizedName}`;
        const res = await fetch(url, { headers: getSupabaseFunctionHeaders() });
        const payload = await res.json();

        if (!res.ok || payload?.error) {
          throw new Error(payload?.error?.message || "Failed to load manager profile");
        }

        setData({
          manager_name: payload.manager_name || normalizedName,
          all_time_stats: payload.all_time_stats || null,
          season_standings: (payload.season_standings || []).filter(
            (s: any) => s.season < HISTORICAL_STATS_CUTOFF_SEASON
          ),
          h2h_all_time: payload.h2h_all_time || [],
          h2h_by_season: payload.h2h_by_season || [],
          trophies: payload.trophies || [],
          season_stats: payload.season_stats || [],
        });
      } catch (err: any) {
        setError(err.message || "Failed to load manager profile");
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [managerName]);

  useEffect(() => {
    const seasons = Array.from(
      new Set((data?.h2h_by_season || []).map((row: any) => row.season || "Unknown")),
    ).sort((a, b) => b.localeCompare(a));
    if (seasons.length === 0) {
      if (selectedH2HSeason) setSelectedH2HSeason("");
      return;
    }
    if (!selectedH2HSeason || !seasons.includes(selectedH2HSeason)) {
      setSelectedH2HSeason(seasons[0]);
    }
  }, [data, selectedH2HSeason]);

  useEffect(() => {
    if (!data?.manager_name) return;
    async function loadCurrentSeasonExtras() {
      try {
        const [fixturesRes, standingsRes] = await Promise.all([
          fetch(`${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/fixtures`, {
            headers: getSupabaseFunctionHeaders(),
          }),
          fetch(`${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/h2h-standings`, {
            headers: getSupabaseFunctionHeaders(),
          }),
        ]);
        const fixturesPayload = await fixturesRes.json();
        const standingsPayload = await standingsRes.json();
        const rows: Array<{
          key: string;
          gameweek: number;
          competition: "League" | "Cup";
          opponent: string;
          manager_points: number | null;
          opponent_points: number | null;
          href: string | null;
        }> = [];

        if (fixturesRes.ok && !fixturesPayload?.error) {
          const manager = data.manager_name;
          const consume = (groups: any[], competition: "League" | "Cup") => {
            (groups || []).forEach((group: any) => {
              (group.matchups || []).forEach((m: any) => {
                const t1 = normalizeFixtureManagerName(m.team_1?.manager_name || "");
                const t2 = normalizeFixtureManagerName(m.team_2?.manager_name || "");
                const isT1 = t1 === manager;
                const isT2 = t2 === manager;
                if (!isT1 && !isT2) return;
                rows.push({
                  key: `${competition}-${group.gameweek}-${m.team_1_id}-${m.team_2_id}`,
                  gameweek: Number(group.gameweek || m.gameweek || 0),
                  competition,
                  opponent: isT1 ? (m.team_2?.manager_name || "—") : (m.team_1?.manager_name || "—"),
                  manager_points: isT1 ? Number(m.team_1_points ?? 0) : Number(m.team_2_points ?? 0),
                  opponent_points: isT1 ? Number(m.team_2_points ?? 0) : Number(m.team_1_points ?? 0),
                  href: m.matchup_id
                    ? `/matchup/${competition.toLowerCase()}/${group.gameweek}/${m.team_1_id}/${m.team_2_id}?matchupId=${encodeURIComponent(String(m.matchup_id))}`
                    : `/matchup/${competition.toLowerCase()}/${group.gameweek}/${m.team_1_id}/${m.team_2_id}`,
                });
              });
            });
          };
          consume(fixturesPayload?.league || [], "League");
          consume(fixturesPayload?.cup || [], "Cup");
          const currentGw = Number(fixturesPayload?.current_gameweek || 1);
          const next = rows.find((r) => r.gameweek >= currentGw);
          setNextFixtureName(next ? `${next.opponent} (${next.competition})` : "—");
        }

        if (standingsRes.ok && !standingsPayload?.error) {
          const match = (standingsPayload?.standings || []).find((row: any) => {
            return normalizeFixtureManagerName(row.manager_name || "") === data.manager_name;
          });
          setCurrentRank(match?.rank ?? null);
          setManagerTeamId(match?.team_id ? String(match.team_id) : null);
        } else {
          setManagerTeamId(null);
        }

        const teamId = standingsPayload?.standings
          ? String(((standingsPayload.standings || []).find((row: any) => normalizeFixtureManagerName(row.manager_name || "") === data.manager_name)?.team_id || ""))
          : "";
        if (teamId) {
          for (const gw of [29, 30, 31, 32]) {
            const existingCup = rows.find((r) => r.competition === "Cup" && r.gameweek === gw);
            if (existingCup) continue;
            try {
              const lineupUrl = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/fixtures/lineup?team=${encodeURIComponent(teamId)}&gameweek=${gw}&type=cup`;
              const lineupRes = await fetch(lineupUrl, { headers: getSupabaseFunctionHeaders() });
              const lineupPayload = await lineupRes.json();
              rows.push({
                key: `Cup-${gw}-${teamId}`,
                gameweek: gw,
                competition: "Cup",
                opponent: "Cup Week",
                manager_points: lineupRes.ok && !lineupPayload?.error ? Number(lineupPayload.total_points ?? 0) : null,
                opponent_points: null,
                href: `/lineup/cup/${gw}/${teamId}`,
              });
            } catch {
              rows.push({
                key: `Cup-${gw}-${teamId}`,
                gameweek: gw,
                competition: "Cup",
                opponent: "Cup Week",
                manager_points: null,
                opponent_points: null,
                href: `/lineup/cup/${gw}/${teamId}`,
              });
            }
          }
        }

        rows.sort((a, b) => a.gameweek - b.gameweek);
        setCurrentSeasonFixtures(rows);
      } catch {
        setCurrentSeasonFixtures([]);
        setCurrentRank(null);
        setManagerTeamId(null);
        setNextFixtureName("—");
      }
    }
    loadCurrentSeasonExtras();
  }, [data?.manager_name]);

  useEffect(() => {
    async function loadManagerPhoto() {
      if (!data?.manager_name) return;
      try {
        const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/manager-media?manager_name=${encodeURIComponent(data.manager_name)}`;
        const res = await fetch(url, { headers: getSupabaseFunctionHeaders() });
        const payload = await res.json();
        if (!res.ok || payload?.error) {
          setManagerPhotoUrl(null);
          return;
        }
        setManagerPhotoUrl(payload?.media?.manager_photo_url || null);
      } catch {
        setManagerPhotoUrl(null);
      }
    }
    loadManagerPhoto();
  }, [data?.manager_name]);

  if (loading) {
    return (
      <Card className="p-6">
        <h1 className="mb-4 text-xl font-semibold">Manager Profile</h1>
        <p className="text-sm text-muted-foreground">Loading...</p>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="p-6">
        <h1 className="mb-4 text-xl font-semibold">Manager Profile</h1>
        <p className="text-sm text-destructive">{error || "Manager not found"}</p>
      </Card>
    );
  }

  // Format season standings for table
  const seasonStandingsRows = data.season_standings
    .filter((s) => s.competition_type === "league")
    .map((s) => ({
      rank: s.final_rank === 1 ? "C" : s.final_rank,
      manager_name: s.manager_name,
      wins: s.wins,
      draws: s.draws,
      losses: s.losses,
      points_for: s.points_for,
      points: s.points,
      season: s.season,
    }));

  const sortRows = (rows: any[], key: string, dir: SortDir) => {
    return [...rows].sort((a, b) => {
      const av = a?.[key];
      const bv = b?.[key];
      const an = Number(av);
      const bn = Number(bv);
      let cmp = 0;
      if (!Number.isNaN(an) && !Number.isNaN(bn) && av !== "" && bv !== "") {
        cmp = an - bn;
      } else {
        cmp = String(av ?? "").localeCompare(String(bv ?? ""));
      }
      return dir === "asc" ? cmp : -cmp;
    });
  };

  const sortedSeasonStandings = sortRows(seasonStandingsRows, seasonSort.key, seasonSort.dir);

  const sortedH2HAllTime = sortRows(data.h2h_all_time || [], h2hAllTimeSort.key, h2hAllTimeSort.dir);

  const h2hBySeason = data.h2h_by_season.reduce<Record<string, any[]>>((acc, row) => {
    const season = row.season || "Unknown";
    if (!acc[season]) acc[season] = [];
    const wins = Number(row.wins || 0);
    const draws = Number(row.draws || 0);
    const losses = Number(row.losses || 0);
    const gamesPlayed = wins + draws + losses;
    const avgPoints = gamesPlayed > 0 ? ((wins * 3) + draws) / gamesPlayed : null;
    acc[season].push({
      ...row,
      wins,
      draws,
      losses,
      games_played: gamesPlayed,
      avg_points: avgPoints,
    });
    return acc;
  }, {});

  const h2hSeasons = Object.keys(h2hBySeason).sort((a, b) => b.localeCompare(a));

  const sortedH2HBySeason = (() => {
    const out: Record<string, any[]> = {};
    Object.entries(h2hBySeason).forEach(([season, rows]) => {
      out[season] = sortRows(rows, h2hSeasonSort.key, h2hSeasonSort.dir);
    });
    return out;
  })();

  const toggleSort = (
    setSort: React.Dispatch<React.SetStateAction<{ key: string; dir: SortDir }>>,
    key: string,
  ) => {
    setSort((prev) => ({
      key,
      dir: prev.key === key && prev.dir === "asc" ? "desc" : "asc",
    }));
  };

  const sortLabel = (current: { key: string; dir: SortDir }, key: string) =>
    current.key === key ? (current.dir === "asc" ? " ↑" : " ↓") : "";

  const latestStanding = sortedSeasonStandings[0] || null;
  const leagueTitles = Number(data.all_time_stats?.league_titles || 0);
  const cupWins = Number(data.all_time_stats?.cup_wins || 0);
  const gobletWins = Number(data.all_time_stats?.goblet_wins || 0);
  const trophyIcons = [
    ...Array.from({ length: Math.max(0, leagueTitles) }, (_, i) => ({
      key: `league-${i}`,
      src: leagueTrophy,
      alt: "League trophy",
      title: "League Title",
      className: "h-16 w-12",
    })),
    ...Array.from({ length: Math.max(0, cupWins) }, (_, i) => ({
      key: `cup-${i}`,
      src: cupTrophy,
      alt: "Cup trophy",
      title: "Cup Win",
      className: "h-14 w-10",
    })),
    ...Array.from({ length: Math.max(0, gobletWins) }, (_, i) => ({
      key: `goblet-${i}`,
      src: gobletTrophy,
      alt: "Goblet trophy",
      title: "Goblet Win",
      className: "h-12 w-8",
    })),
  ];

  return (
    <div className="space-y-6 rounded-2xl bg-zinc-300/60 p-4 md:p-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-4 mb-2">
          <Link to="/home" className="text-sm text-zinc-700 hover:underline">
            ← Back to Home
          </Link>
        </div>
        <h1 className="text-3xl font-bold text-zinc-900">{data.manager_name} Manager Insights</h1>
        <p className="text-sm text-zinc-700 mt-2">Historical performance dashboard</p>
      </div>

      {data.all_time_stats && (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr_1fr]">
            <Card className="rounded-3xl border-zinc-200 bg-zinc-100 p-6">
              <div className="h-44 w-full rounded-2xl border-2 border-zinc-900/70 bg-white/70 flex items-center justify-center text-zinc-700">
                {managerPhotoUrl ? (
                  <img src={managerPhotoUrl} alt={`${data.manager_name} profile`} className="h-32 w-32 rounded-full border-4 border-zinc-900/70 object-cover" />
                ) : (
                  <div className="h-28 w-28 rounded-full border-4 border-zinc-900/70 flex items-center justify-center text-4xl">👤</div>
                )}
              </div>
            </Card>

            <div className="space-y-4">
              <Card className="rounded-3xl border-zinc-200 bg-zinc-100 p-5">
                <h2 className="text-2xl font-semibold mb-3 text-center">All Time Record</h2>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-sm text-zinc-700">W</p>
                    <p className="text-4xl font-bold">{data.all_time_stats.wins || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-zinc-700">D</p>
                    <p className="text-4xl font-bold">{data.all_time_stats.draws || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-zinc-700">L</p>
                    <p className="text-4xl font-bold">{data.all_time_stats.losses || 0}</p>
                  </div>
                </div>
              </Card>

              <div className="grid grid-cols-3 gap-3">
                <Card className="rounded-3xl border-zinc-200 bg-zinc-100 p-4 text-center">
                  <p className="text-sm text-zinc-700">Current Standing</p>
                  <p className="text-4xl font-bold">{currentRank ?? latestStanding?.rank ?? "—"}</p>
                </Card>
                <Card className="rounded-3xl border-zinc-200 bg-zinc-100 p-4 text-center">
                  <p className="text-sm text-zinc-700">Next Fixture</p>
                  <p className="text-lg font-bold leading-tight">{nextFixtureName}</p>
                </Card>
                <Card className="rounded-3xl border-zinc-200 bg-zinc-100 p-4 text-center">
                  <p className="text-sm text-zinc-700">All Time Points</p>
                  <p className="text-4xl font-bold">{data.all_time_stats.total_points || 0}</p>
                </Card>
              </div>
            </div>

            <Card className="rounded-3xl border-zinc-200 bg-zinc-100 p-5">
              <h3 className="text-lg font-semibold mb-4">Trophy Cabinet</h3>
              <div className="flex items-end gap-2 flex-wrap min-h-14">
                {trophyIcons.length > 0 ? (
                  trophyIcons.map((icon) => (
                    <img key={icon.key} src={icon.src} alt={icon.alt} title={icon.title} className={`${icon.className} object-contain`} />
                  ))
                ) : (
                  <p className="text-sm text-zinc-700">No trophies yet.</p>
                )}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center text-sm">
                <div>{leagueTitles}</div>
                <div>{cupWins}</div>
                <div>{gobletWins}</div>
              </div>
              <div className="mt-4 rounded-2xl border border-zinc-300 bg-white/60 p-3">
                <p className="text-sm text-zinc-700">Points Per Game</p>
                <p className="text-3xl font-bold">{data.all_time_stats.points_per_game?.toFixed(2) || "0.00"}</p>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_1fr]">
            <Card className="rounded-3xl border-zinc-200 bg-zinc-100 p-5">
              <h3 className="text-3xl font-bold tracking-wide text-zinc-500 mb-3">Fixtures</h3>
              <div className="max-h-[320px] overflow-y-auto rounded-xl border border-zinc-300">
                {currentSeasonFixtures.length === 0 ? (
                  <div className="p-4 text-sm text-zinc-700">No recent fixture records.</div>
                ) : (
                  <div className="divide-y divide-zinc-300">
                    {currentSeasonFixtures.map((fixture, index) => (
                      <Link
                        to={fixture.href || "#"}
                        key={fixture.key}
                        className={`grid grid-cols-[100px_1fr_100px] items-center ${fixture.href ? "hover:bg-zinc-300/70 transition-colors" : ""} ${
                          index % 2 === 0 ? "bg-zinc-200/70" : "bg-white/80"
                        }`}
                      >
                        <div className={`px-3 py-3 font-bold text-3xl text-center ${index % 2 ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-900"}`}>
                          GW {fixture.gameweek}
                        </div>
                        <div className="px-3 py-3 font-semibold">
                          {data.manager_name} vs {fixture.opponent}
                          <span className="ml-2 text-xs text-zinc-600">[{fixture.competition}]</span>
                        </div>
                        <div className="px-3 py-3 text-sm font-semibold text-right">
                          {fixture.opponent_points == null
                            ? (fixture.manager_points == null ? "—" : fixture.manager_points.toFixed(1))
                            : `${fixture.manager_points ?? 0} - ${fixture.opponent_points ?? 0}`}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            <Card className="rounded-3xl border-zinc-200 bg-zinc-100 p-5">
              <h3 className="text-xl font-semibold mb-4">Manager Insight Metrics</h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-5 text-sm">
                <div>
                  <p className="text-zinc-700">Points Per Game</p>
                  <p className="text-2xl font-bold">{data.all_time_stats.points_per_game?.toFixed(2) || "0.00"}</p>
                </div>
                <div>
                  <p className="text-zinc-700">50+ GW&apos;s</p>
                  <p className="text-2xl font-bold">{data.all_time_stats.fifty_plus_weeks || 0}</p>
                </div>
                <div>
                  <p className="text-zinc-700">Longest Win Streak</p>
                  <p className="text-2xl font-bold">{data.all_time_stats.longest_win_streak || 0}</p>
                  <p className="text-xs text-zinc-600">{data.all_time_stats.longest_win_streak_spans || "—"}</p>
                </div>
                <div>
                  <p className="text-zinc-700">Longest Unbeaten</p>
                  <p className="text-2xl font-bold">{data.all_time_stats.longest_undefeated_streak || 0}</p>
                  <p className="text-xs text-zinc-600">{data.all_time_stats.longest_undefeated_streak_spans || "—"}</p>
                </div>
                <div>
                  <p className="text-zinc-700">Longest Losing</p>
                  <p className="text-2xl font-bold">{data.all_time_stats.longest_loss_streak || 0}</p>
                  <p className="text-xs text-zinc-600">{data.all_time_stats.longest_loss_streak_spans || "—"}</p>
                </div>
                <div>
                  <p className="text-zinc-700">Longest Winless</p>
                  <p className="text-2xl font-bold">{data.all_time_stats.longest_winless_streak || 0}</p>
                  <p className="text-xs text-zinc-600">{data.all_time_stats.longest_winless_streak_spans || "—"}</p>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}

      {/* Tabs */}
      <Tabs defaultValue="standings" className="w-full">
        <TabsList className="bg-zinc-200/70">
          <TabsTrigger value="standings">Season Standings</TabsTrigger>
          <TabsTrigger value="h2h">Head-to-Head</TabsTrigger>
          <TabsTrigger value="trophies">Trophies</TabsTrigger>
        </TabsList>

        <TabsContent value="standings" className="mt-4">
          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-4">Season-by-Season League Standings</h3>
            <div className="fpl-table-container">
              <Table>
                <TableHeader>
                  <TableRow className="fpl-table-header">
                  <TableHead className="cursor-pointer" onClick={() => toggleSort(setSeasonSort, "season")}>Season{sortLabel(seasonSort, "season")}</TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => toggleSort(setSeasonSort, "rank")}>Rank{sortLabel(seasonSort, "rank")}</TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => toggleSort(setSeasonSort, "wins")}>W{sortLabel(seasonSort, "wins")}</TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => toggleSort(setSeasonSort, "draws")}>D{sortLabel(seasonSort, "draws")}</TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => toggleSort(setSeasonSort, "losses")}>L{sortLabel(seasonSort, "losses")}</TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => toggleSort(setSeasonSort, "points_for")}>For{sortLabel(seasonSort, "points_for")}</TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => toggleSort(setSeasonSort, "points")}>Pts{sortLabel(seasonSort, "points")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="fpl-table-body">
                  {sortedSeasonStandings.map((row) => (
                    <TableRow key={`${row.season}-${row.rank}`}>
                      <TableCell className="fpl-manager-name">{row.season}</TableCell>
                      <TableCell className="fpl-numeric">{row.rank}</TableCell>
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
          </Card>
        </TabsContent>

        <TabsContent value="h2h" className="mt-4 space-y-4">
          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-4">All-Time H2H Records</h3>
            <div className="fpl-table-container">
              <Table>
                <TableHeader>
                  <TableRow className="fpl-table-header">
                  <TableHead className="cursor-pointer" onClick={() => toggleSort(setH2hAllTimeSort, "opponent_name")}>Opponent{sortLabel(h2hAllTimeSort, "opponent_name")}</TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => toggleSort(setH2hAllTimeSort, "wins")}>W{sortLabel(h2hAllTimeSort, "wins")}</TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => toggleSort(setH2hAllTimeSort, "draws")}>D{sortLabel(h2hAllTimeSort, "draws")}</TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => toggleSort(setH2hAllTimeSort, "losses")}>L{sortLabel(h2hAllTimeSort, "losses")}</TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => toggleSort(setH2hAllTimeSort, "avg_points")}>Avg Pts{sortLabel(h2hAllTimeSort, "avg_points")}</TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => toggleSort(setH2hAllTimeSort, "games_played")}>GP{sortLabel(h2hAllTimeSort, "games_played")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="fpl-table-body">
                  {sortedH2HAllTime.map((h2h) => (
                    <TableRow key={h2h.opponent_name}>
                      <TableCell className="fpl-manager-name">{h2h.opponent_name}</TableCell>
                      <TableCell className="fpl-numeric">{h2h.wins || 0}</TableCell>
                      <TableCell className="fpl-numeric">{h2h.draws || 0}</TableCell>
                      <TableCell className="fpl-numeric">{h2h.losses || 0}</TableCell>
                      <TableCell className="fpl-numeric">{h2h.avg_points?.toFixed(2) || "–"}</TableCell>
                      <TableCell className="fpl-points">{h2h.games_played || 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-4">H2H by Season</h3>
            {h2hSeasons.length === 0 ? (
              <p className="text-sm text-muted-foreground">No season H2H data available.</p>
            ) : (
              <div className="space-y-6">
                <div>
                  <label className="text-sm font-medium mb-2 block">Season</label>
                  <select
                    value={selectedH2HSeason}
                    onChange={(e) => setSelectedH2HSeason(e.target.value)}
                    className="px-3 py-2 border rounded-md"
                  >
                    {h2hSeasons.map((season) => (
                      <option key={season} value={season}>
                        {season}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="fpl-table-container">
                  <Table>
                    <TableHeader>
                      <TableRow className="fpl-table-header">
                        <TableHead className="cursor-pointer" onClick={() => toggleSort(setH2hSeasonSort, "opponent_name")}>Opponent{sortLabel(h2hSeasonSort, "opponent_name")}</TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => toggleSort(setH2hSeasonSort, "wins")}>W{sortLabel(h2hSeasonSort, "wins")}</TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => toggleSort(setH2hSeasonSort, "draws")}>D{sortLabel(h2hSeasonSort, "draws")}</TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => toggleSort(setH2hSeasonSort, "losses")}>L{sortLabel(h2hSeasonSort, "losses")}</TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => toggleSort(setH2hSeasonSort, "avg_points")}>Avg Pts{sortLabel(h2hSeasonSort, "avg_points")}</TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => toggleSort(setH2hSeasonSort, "games_played")}>GP{sortLabel(h2hSeasonSort, "games_played")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="fpl-table-body">
                      {(sortedH2HBySeason[selectedH2HSeason] || []).map((h2h) => (
                        <TableRow key={`${selectedH2HSeason}-${h2h.opponent_name}`}>
                          <TableCell className="fpl-manager-name">{h2h.opponent_name}</TableCell>
                          <TableCell className="fpl-numeric">{h2h.wins}</TableCell>
                          <TableCell className="fpl-numeric">{h2h.draws}</TableCell>
                          <TableCell className="fpl-numeric">{h2h.losses}</TableCell>
                          <TableCell className="fpl-numeric">
                            {h2h.avg_points == null ? "–" : Number(h2h.avg_points).toFixed(2)}
                          </TableCell>
                          <TableCell className="fpl-points">{h2h.games_played}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="trophies" className="mt-4">
          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-4">Trophies</h3>
            {data.trophies.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Season</TableHead>
                    <TableHead>League</TableHead>
                    <TableHead>League of Lads Cup</TableHead>
                    <TableHead>Goblet</TableHead>
                    <TableHead>Treble</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.trophies.map((trophy) => (
                    <TableRow key={trophy.season}>
                      <TableCell className="font-medium">{trophy.season}</TableCell>
                      <TableCell className="text-center">
                        {trophy.league_champion ? "✓" : "–"}
                      </TableCell>
                      <TableCell className="text-center">
                        {trophy.cup_winner ? "✓" : "–"}
                      </TableCell>
                      <TableCell className="text-center">
                        {trophy.goblet_winner ? "✓" : "–"}
                      </TableCell>
                      <TableCell className="text-center">
                        {trophy.treble ? "✓" : "–"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">No trophies yet.</p>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Manager Navigation */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">Other Managers</h3>
        <div className="flex flex-wrap gap-2">
          {CANONICAL_MANAGERS.filter((m) => m !== data.manager_name).map((manager) => (
            <Link
              key={manager}
              to={`/manager/${manager.toLowerCase()}`}
              className="px-3 py-1 text-sm border rounded-md hover:bg-muted transition-colors"
            >
              {manager}
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
