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
  position: number;
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
  rank: number | null;
  total_points: number;
  lineup: LineupPlayer[];
};

type Payload = {
  type: "league" | "cup";
  gameweek: number;
  matchup: {
    team_1_points: number | null;
    team_2_points: number | null;
    live_team_1_points: number;
    live_team_2_points: number;
    round: string | null;
    matchup_id: string | null;
  };
  team_1: TeamDetail;
  team_2: TeamDetail;
};

function TeamPitchDisplay({ team, matchupType }: { team: TeamDetail; matchupType: "league" | "cup" }) {
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerStats | null>(null);

  const pitchPlayers: PitchPlayer[] = team.lineup.map((p) => ({
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
  }));

  const handlePlayerClick = (player: PitchPlayer) => {
    const fullPlayer = team.lineup.find((p) => p.player_id === player.player_id);
    if (fullPlayer) {
      setSelectedPlayer({
        ...fullPlayer,
        position: fullPlayer.position,
      });
    }
  };

  return (
    <Card className="p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">
          {team.rank != null ? `#${team.rank} ` : ""}
          {team.manager_name}
        </h3>
        <p className="text-sm text-muted-foreground">{team.entry_name}</p>
        <p className="text-sm font-medium mt-2">Total Points: {team.total_points}</p>
      </div>

      <div className="mb-4">
        <FootballPitch players={pitchPlayers} onPlayerClick={handlePlayerClick} showCaptain={true} />
      </div>

      <PlayerStatsModal
        player={selectedPlayer!}
        isOpen={!!selectedPlayer}
        onClose={() => setSelectedPlayer(null)}
        showHistory={false}
      />

      {/* Substitute/Bench info */}
      {team.lineup.length > 0 && (
        <div className="mt-4 text-sm">
          <p className="text-muted-foreground">
            {team.lineup.filter((p) => p.position === 1).length} GK • {team.lineup.filter((p) => p.position === 2).length} DEF •{" "}
            {team.lineup.filter((p) => p.position === 3).length} MID • {team.lineup.filter((p) => p.position === 4).length} FWD
          </p>
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

  useEffect(() => {
    async function load() {
      if (!type || !gameweek || !team1 || !team2) return;
      try {
        setLoading(true);
        setError(null);
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
        setData(payload);
      } catch (err: any) {
        setError(err.message || "Failed to load matchup detail");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [type, gameweek, team1, team2, searchParams]);

  if (loading) return <Card className="p-6"><p className="text-sm text-muted-foreground">Loading matchup…</p></Card>;
  if (error || !data) return <Card className="p-6"><p className="text-sm text-destructive">{error || "Failed to load matchup"}</p></Card>;

  const team1Points = data.matchup.team_1_points ?? data.matchup.live_team_1_points;
  const team2Points = data.matchup.team_2_points ?? data.matchup.live_team_2_points;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/fixtures" className="text-sm text-muted-foreground hover:underline">
          ← Back to Fixtures
        </Link>
        <h1 className="text-3xl font-bold mt-2">{data.type === "cup" ? "Cup Matchup" : "League Matchup"} • GW {data.gameweek}</h1>
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
          <div className="text-right">
            <p className="font-semibold">{data.team_1.manager_name}</p>
            <p className="text-sm text-muted-foreground">{data.team_1.entry_name}</p>
          </div>
          <div className="text-center">
            <p className="text-4xl font-bold">
              {team1Points.toFixed(1)} - {team2Points.toFixed(1)}
            </p>
            {data.matchup.round && <p className="text-xs text-muted-foreground mt-1">{data.matchup.round}</p>}
          </div>
          <div>
            <p className="font-semibold">{data.team_2.manager_name}</p>
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
