import React, { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Card } from "../components/ui/card";
import { EDGE_FUNCTIONS_BASE } from "../lib/constants";
import { getSupabaseFunctionHeaders, supabaseUrl } from "../lib/supabaseClient";
import { FootballPitch, PitchPlayer } from "../components/FootballPitch";
import { PlayerStatsModal, PlayerStats } from "../components/PlayerStatsModal";

type LineupPlayer = {
  player_id: number;
  player_name: string;
  player_image_url?: string | null;
  position: number;
  lineup_slot?: number | null;
  is_bench?: boolean;
  is_captain: boolean;
  is_vice_captain: boolean;
  is_cup_captain: boolean;
  raw_points: number;
  multiplier: number;
  effective_points: number;
  goals_scored: number;
  assists: number;
  minutes: number;
  defensive_contributions: number;
  clean_sheets: number;
  goals_conceded: number;
  yellow_cards: number;
  red_cards: number;
  penalties_missed: number;
  penalties_saved: number;
};

type TeamDetail = {
  id: string;
  manager_name: string;
  entry_name: string;
  club_crest_url?: string | null;
  rank: number | null;
  total_points: number;
  lineup: LineupPlayer[];
};

type Payload = {
  type: "league" | "cup";
  gameweek: number;
  current_gameweek: number;
  matchup: {
    team_1_points: number | null;
    team_2_points: number | null;
    live_team_1_points: number;
    live_team_2_points: number;
    round: string | null;
    matchup_id: string | null;
    has_started?: boolean;
  };
  team_1: TeamDetail;
  team_2: TeamDetail;
};

function TeamPitchDisplay({
  team,
  matchupType,
}: {
  team: TeamDetail;
  matchupType: "league" | "cup";
}) {
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerStats | null>(null);

  const starters = team.lineup
    .filter((p) => !p.is_bench)
    .sort((a, b) => (a.lineup_slot ?? 99) - (b.lineup_slot ?? 99));
  const bench = team.lineup
    .filter((p) => !!p.is_bench)
    .sort((a, b) => (a.lineup_slot ?? 99) - (b.lineup_slot ?? 99));

  const pitchPlayers: PitchPlayer[] = starters.map((p) => ({
    player_id: p.player_id,
    player_name: p.player_name,
    player_image_url: p.player_image_url || null,
    position: p.position,
    raw_points: p.raw_points,
    effective_points: p.effective_points,
    is_captain: p.is_captain,
    is_vice_captain: p.is_vice_captain,
    is_cup_captain: p.is_cup_captain,
    multiplier: p.multiplier,
    goals_scored: p.goals_scored,
    assists: p.assists,
    minutes: p.minutes,
  }));

  const handlePlayerClick = async (player: PitchPlayer) => {
    const fullPlayer = team.lineup.find((p) => p.player_id === player.player_id);
    if (!fullPlayer) return;

    try {
      const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/player-history?player_id=${encodeURIComponent(String(player.player_id))}`;
      const res = await fetch(url, { headers: getSupabaseFunctionHeaders() });
      const payload = await res.json();
      if (!res.ok || payload?.error) {
        throw new Error(payload?.error?.message || "Failed to fetch player history");
      }

      setSelectedPlayer({
        ...fullPlayer,
        position: fullPlayer.position,
        history: (payload.history || []).map((h: any) => ({
          gameweek: h.gameweek,
          points: h.points ?? 0,
          goals: h.goals ?? 0,
          assists: h.assists ?? 0,
          minutes: h.minutes ?? 0,
          opponent_team_name: h.opponent_team_name ?? null,
          was_home: h.was_home,
          fixture: h.fixture ?? null,
          result: h.result ?? null,
          kickoff_time: h.kickoff_time ?? null,
        })),
      });
    } catch {
      setSelectedPlayer({
        ...fullPlayer,
        position: fullPlayer.position,
        history: [],
      });
    }
  };

  return (
    <Card className="p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">
          {team.rank != null ? `#${team.rank} ` : ""}
          <span className="inline-flex items-center gap-2">
            {team.club_crest_url ? <img src={team.club_crest_url} alt="" className="h-5 w-5 rounded object-cover border" /> : null}
            {team.manager_name}
          </span>
        </h3>
        <p className="text-sm text-muted-foreground">{team.entry_name}</p>
      </div>

      <div className="mb-4">
        <FootballPitch players={pitchPlayers} onPlayerClick={handlePlayerClick} showCaptain={true} />
      </div>

      <PlayerStatsModal
        player={selectedPlayer!}
        isOpen={!!selectedPlayer}
        onClose={() => setSelectedPlayer(null)}
        showHistory={true}
        showEffectivePoints={matchupType === "cup"}
      />

      {/* Substitute/Bench info */}
      {starters.length > 0 && (
        <div className="mt-4 text-sm space-y-2">
          <p className="text-muted-foreground">
            {starters.filter((p) => p.position === 1).length} GK • {starters.filter((p) => p.position === 2).length} DEF •{" "}
            {starters.filter((p) => p.position === 3).length} MID • {starters.filter((p) => p.position === 4).length} FWD
          </p>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Bench</p>
            {bench.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {bench.map((p) => (
                  <button
                    key={`${p.player_id}-bench`}
                    onClick={() =>
                      handlePlayerClick({
                        player_id: p.player_id,
                        player_name: p.player_name,
                        position: p.position,
                        raw_points: p.raw_points,
                        effective_points: p.effective_points,
                        is_captain: p.is_captain,
                        is_vice_captain: p.is_vice_captain,
                        is_cup_captain: p.is_cup_captain,
                        multiplier: p.multiplier,
                        goals_scored: p.goals_scored,
                        assists: p.assists,
                        minutes: p.minutes,
                      })
                    }
                    className="rounded border px-2 py-1 text-xs hover:bg-muted"
                  >
                    {p.player_name} ({Math.round(p.effective_points)})
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No bench data</p>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

export default function MatchupDetailPage() {
  const { type, gameweek, team1, team2 } = useParams<{ type: "league" | "cup"; gameweek: string; team1: string; team2: string }>();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load(silent = false) {
      if (!type || !gameweek || !team1 || !team2) return;
      try {
        if (!silent) {
          setLoading(true);
        }
        if (!silent || !data) {
          setError(null);
        }
        const params = new URLSearchParams({
          type,
          gameweek,
          team1,
          team2,
        });
        const matchupId = searchParams.get("matchupId");
        if (matchupId) params.set("matchupId", matchupId);

        const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/fixtures/matchup?${params.toString()}`;
        const res = await fetch(url, { headers: getSupabaseFunctionHeaders() });
        const payload = await res.json();
        if (!res.ok || payload?.error) {
          throw new Error(payload?.error?.message || "Failed to load matchup detail");
        }
        if (!mounted) return;
        setData(payload);
        setLastUpdated(Date.now());
      } catch (err: any) {
        if (!mounted) return;
        if (!silent) {
          setError(err.message || "Failed to load matchup detail");
        }
      } finally {
        if (!mounted) return;
        if (!silent) {
          setLoading(false);
        }
      }
    }

    load(false);
    const timer = window.setInterval(() => {
      load(true);
    }, 10000);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [type, gameweek, team1, team2, searchParams]);

  if (loading) return <Card className="p-6"><p className="text-sm text-muted-foreground">Loading matchup…</p></Card>;
  if (error || !data) return <Card className="p-6"><p className="text-sm text-destructive">{error || "Failed to load matchup"}</p></Card>;

  const leagueLiveTeam1 = (data.team_1.lineup || []).reduce(
    (sum, player) => sum + (player.is_bench ? 0 : Number(player.effective_points || 0)),
    0,
  );
  const leagueLiveTeam2 = (data.team_2.lineup || []).reduce(
    (sum, player) => sum + (player.is_bench ? 0 : Number(player.effective_points || 0)),
    0,
  );
  const team1Points = data.type === "league" ? leagueLiveTeam1 : (data.matchup.team_1_points ?? data.matchup.live_team_1_points);
  const team2Points = data.type === "league" ? leagueLiveTeam2 : (data.matchup.team_2_points ?? data.matchup.live_team_2_points);
  const team1Score = Math.round(team1Points);
  const team2Score = Math.round(team2Points);

  return (
    <div className="space-y-6">
      <div>
        <Link to="/fixtures" className="text-sm text-muted-foreground hover:underline">
          ← Back to Fixtures
        </Link>
        <h1 className="text-3xl font-bold mt-2">{data.type === "cup" ? "Cup Matchup" : "League Matchup"} • GW {data.gameweek}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Live updates every 10s{lastUpdated ? ` • Last refresh ${new Date(lastUpdated).toLocaleTimeString()}` : ""}
        </p>
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
          <div className="text-right">
            <p className="font-semibold inline-flex items-center gap-2 justify-end">
              {data.team_1.club_crest_url ? <img src={data.team_1.club_crest_url} alt="" className="h-5 w-5 rounded object-cover border" /> : null}
              {data.team_1.manager_name}
            </p>
            <p className="text-sm text-muted-foreground">{data.team_1.entry_name}</p>
          </div>
          <div className="text-center">
            <p className="text-4xl font-bold">
              {team1Score} - {team2Score}
            </p>
            {data.matchup.round && <p className="text-xs text-muted-foreground mt-1">{data.matchup.round}</p>}
          </div>
          <div>
            <p className="font-semibold inline-flex items-center gap-2">
              {data.team_2.club_crest_url ? <img src={data.team_2.club_crest_url} alt="" className="h-5 w-5 rounded object-cover border" /> : null}
              {data.team_2.manager_name}
            </p>
            <p className="text-sm text-muted-foreground">{data.team_2.entry_name}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TeamPitchDisplay team={data.team_1} matchupType={data.type} />
        <TeamPitchDisplay team={data.team_2} matchupType={data.type} />
      </div>
    </div>
  );
}
