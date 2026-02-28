import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../components/ui/card";
import { EDGE_FUNCTIONS_BASE } from "../lib/constants";
import { getSupabaseFunctionHeaders, supabaseUrl } from "../lib/supabaseClient";
import { FootballPitch, PitchPlayer } from "../components/FootballPitch";
import { PlayerStats, PlayerStatsModal } from "../components/PlayerStatsModal";

type TeamRef = {
  id: string;
  entry_name: string | null;
  manager_name: string | null;
  club_crest_url?: string | null;
};

type Fixture = {
  fixture_id: string;
  matchup_id?: string;
  type: "league" | "cup";
  gameweek: number;
  round?: string;
  leg?: number;
  team_1_id: string;
  team_2_id: string;
  team_1_points: number;
  team_2_points: number;
  team_1_rank?: number | null;
  team_2_rank?: number | null;
  team_1: TeamRef | null;
  team_2: TeamRef | null;
};

type FixtureGroup = {
  gameweek: number;
  matchups: Fixture[];
};

type Payload = {
  season: string;
  current_gameweek: number;
  league: FixtureGroup[];
  cup: FixtureGroup[];
  cup_group?: Array<{
    gameweek: number;
    rows: Array<{
      fixture_id: string;
      gameweek: number;
      type: "cup_group";
      team_id: string;
      team: TeamRef | null;
      week_points: number | null;
      cumulative_points: number;
      rank: number | null;
      rank_change: number;
    }>;
  }>;
};

function FixtureRow({ fixture }: { fixture: Fixture }) {
  const baseHref = `/matchup/${fixture.type}/${fixture.gameweek}/${fixture.team_1_id}/${fixture.team_2_id}`;
  const href = fixture.matchup_id ? `${baseHref}?matchupId=${encodeURIComponent(fixture.matchup_id)}` : baseHref;
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerStats | null>(null);

  const handlePlayerClick = async (player: PitchPlayer) => {
    try {
      const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/player-history?player_id=${encodeURIComponent(String(player.player_id))}`;
      const res = await fetch(url, { headers: getSupabaseFunctionHeaders() });
      const payload = await res.json();
      if (!res.ok || payload?.error) {
        throw new Error(payload?.error?.message || "Failed to fetch player history");
      }
      setSelectedPlayer({
        ...player,
        history: (payload.history || []).map((h: any) => ({
          gameweek: h.gameweek,
          points: h.points ?? 0,
          goals: 0,
          assists: 0,
          minutes: 0,
        })),
      });
    } catch {
      setSelectedPlayer({
        ...player,
        history: [],
      });
    }
  };

  // If fixture contains last_lineup fields (upcoming/unstarted), render pitch for each team
  if ((fixture as any).last_lineup_1 || (fixture as any).last_lineup_2) {
    const last1 = (fixture as any).last_lineup_1 || [];
    const last2 = (fixture as any).last_lineup_2 || [];
    const convert = (rows: any[]): PitchPlayer[] =>
      rows.map((r) => ({
        player_id: r.player_id,
        player_name: r.player_name,
        position: r.position || 3,
        raw_points: r.points ?? 0,
        effective_points: r.points ?? 0,
        is_captain: false,
        is_vice_captain: false,
        is_cup_captain: false,
        multiplier: 1,
      }));

    return (
      <div className="block w-full rounded-md border bg-background/80 p-3">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
              {fixture.team_1_rank != null ? <span className="font-semibold">#{fixture.team_1_rank}</span> : null}
              {fixture.team_1?.club_crest_url ? <img src={fixture.team_1.club_crest_url} alt="" className="h-4 w-4 rounded object-cover border" /> : null}
              {fixture.team_1?.entry_name || "—"}
            </div>
            <div className="text-sm font-medium">{fixture.team_1?.manager_name || "—"}</div>
            <FootballPitch players={convert(last1)} onPlayerClick={handlePlayerClick} showCaptain={true} />
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{fixture.team_1_points} - {fixture.team_2_points}</div>
            {fixture.type === "cup" && fixture.leg ? (
              <div className="text-xs text-muted-foreground">{fixture.round || "Cup"} • Leg {fixture.leg}</div>
            ) : null}
            <Link to={href} className="inline-block mt-2 text-xs hover:underline text-muted-foreground">
              View matchup
            </Link>
          </div>
          <div>
            <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
              {fixture.team_2_rank != null ? <span className="font-semibold">#{fixture.team_2_rank}</span> : null}
              {fixture.team_2?.club_crest_url ? <img src={fixture.team_2.club_crest_url} alt="" className="h-4 w-4 rounded object-cover border" /> : null}
              {fixture.team_2?.entry_name || "—"}
            </div>
            <div className="text-sm font-medium">{fixture.team_2?.manager_name || "—"}</div>
            <FootballPitch players={convert(last2)} onPlayerClick={handlePlayerClick} showCaptain={true} />
          </div>
        </div>
        <PlayerStatsModal
          player={selectedPlayer!}
          isOpen={!!selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
          showHistory={true}
        />
      </div>
    );
  }

  return (
    <Link
      to={href}
      className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-md border bg-background/80 p-3 hover:bg-background transition-colors"
    >
      <div className="text-right">
        {fixture.team_1_rank != null ? (
          <div className="text-xs text-muted-foreground">#{fixture.team_1_rank}</div>
        ) : null}
        <div className="font-medium">{fixture.team_1?.manager_name || "—"}</div>
        <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
          {fixture.team_1?.club_crest_url ? <img src={fixture.team_1.club_crest_url} alt="" className="h-4 w-4 rounded object-cover border" /> : null}
          {fixture.team_1?.entry_name || "—"}
        </div>
      </div>
      <div className="text-center font-semibold">
        {fixture.team_1_points} - {fixture.team_2_points}
        {fixture.type === "cup" && fixture.leg ? (
          <div className="text-xs text-muted-foreground">{fixture.round || "Cup"} • Leg {fixture.leg}</div>
        ) : null}
      </div>
      <div>
        {fixture.team_2_rank != null ? (
          <div className="text-xs text-muted-foreground">#{fixture.team_2_rank}</div>
        ) : null}
        <div className="font-medium">{fixture.team_2?.manager_name || "—"}</div>
        <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
          {fixture.team_2?.club_crest_url ? <img src={fixture.team_2.club_crest_url} alt="" className="h-4 w-4 rounded object-cover border" /> : null}
          {fixture.team_2?.entry_name || "—"}
        </div>
      </div>
    </Link>
  );
}

export default function FixturesPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const REFRESH_MS = 30_000; // 30s so ongoing gameweek updates automatically
  useEffect(() => {
    async function load(silent = false) {
      try {
        if (!silent) setLoading(true);
        setError(null);
        const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/fixtures`;
        const res = await fetch(url, { headers: getSupabaseFunctionHeaders() });
        const payload = await res.json();
        if (!res.ok || payload?.error) {
          throw new Error(payload?.error?.message || "Failed to load fixtures");
        }
        setData(payload);
      } catch (err: any) {
        if (!silent) setError(err.message || "Failed to load fixtures");
      } finally {
        if (!silent) setLoading(false);
      }
    }
    load(false);
    const timer = setInterval(() => load(true), REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  if (loading) {
    return <Card className="p-6"><p className="text-sm text-muted-foreground">Loading fixtures…</p></Card>;
  }
  if (error || !data) {
    return <Card className="p-6"><p className="text-sm text-destructive">{error || "Failed to load fixtures"}</p></Card>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Season Fixtures</h1>
        <p className="text-sm text-muted-foreground mt-2">League and FFA Cup fixtures ordered by gameweek. Click matchups for lineups.</p>
      </div>

      <Card className="p-4">
        <h2 className="text-xl font-semibold mb-3">All Fixtures</h2>
        {(() => {
          const gwMap: Record<number, { league: Fixture[]; cup: Fixture[]; cupGroup: NonNullable<Payload["cup_group"]>[number]["rows"] }> = {};
          (data.league || []).forEach((group) => {
            const gw = Number(group.gameweek || 0);
            if (!gwMap[gw]) gwMap[gw] = { league: [], cup: [], cupGroup: [] };
            gwMap[gw].league.push(...(group.matchups || []));
          });
          (data.cup || []).forEach((group) => {
            const gw = Number(group.gameweek || 0);
            if (!gwMap[gw]) gwMap[gw] = { league: [], cup: [], cupGroup: [] };
            gwMap[gw].cup.push(...(group.matchups || []));
          });
          (data.cup_group || []).forEach((group) => {
            const gw = Number(group.gameweek || 0);
            if (!gwMap[gw]) gwMap[gw] = { league: [], cup: [], cupGroup: [] };
            gwMap[gw].cupGroup.push(...(group.rows || []));
          });
          const gameweeks = Object.keys(gwMap).map(Number).sort((a, b) => a - b);

          return (
            <div className="space-y-5">
              {gameweeks.map((gw) => {
                const section = gwMap[gw];
                return (
                  <div key={`gw-${gw}`} className="space-y-2">
                    <h3 className="text-sm font-semibold text-muted-foreground">GW {gw}</h3>

                    {section.league.length > 0 ? (
                      <div className="text-xs font-semibold uppercase text-muted-foreground">GW {gw} - League</div>
                    ) : null}
                    {section.league.map((fixture) => (
                      <FixtureRow key={fixture.fixture_id} fixture={fixture} />
                    ))}

                    {section.cupGroup.length > 0 ? (
                      <div className="rounded-md border bg-background/80 p-3">
                        <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">FFA Cup Group Stage</div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b text-left">
                                <th className="px-2 py-2">Rank</th>
                                <th className="px-2 py-2">Team</th>
                                <th className="px-2 py-2">Manager</th>
                                <th className="px-2 py-2 text-right">GW Pts</th>
                                <th className="px-2 py-2 text-right">Group Δ</th>
                              </tr>
                            </thead>
                            <tbody>
                              {section.cupGroup.map((row) => (
                                <tr key={row.fixture_id} className="border-b last:border-b-0">
                                  <td className="px-2 py-2">{row.rank ?? "—"}</td>
                                  <td className="px-2 py-2 inline-flex items-center gap-1">
                                    {row.team?.club_crest_url ? (
                                      <img src={row.team.club_crest_url} alt="" className="h-4 w-4 rounded object-cover border" />
                                    ) : null}
                                    <span>{row.team?.entry_name || "—"}</span>
                                  </td>
                                  <td className="px-2 py-2">{row.team?.manager_name || "—"}</td>
                                  <td className="px-2 py-2 text-right">{row.week_points == null ? "—" : row.week_points}</td>
                                  <td className="px-2 py-2 text-right">
                                    {row.rank_change > 0 ? `+${row.rank_change}` : `${row.rank_change}`}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : null}

                    {section.cup.length > 0 ? (
                      <div className="text-xs font-semibold uppercase text-muted-foreground">GW {gw} - FFA Cup</div>
                    ) : null}
                    {section.cup.map((fixture) => (
                      <FixtureRow key={fixture.fixture_id} fixture={fixture} />
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </Card>
    </div>
  );
}
