import React, { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Card } from "../components/ui/card";
import { EDGE_FUNCTIONS_BASE } from "../lib/constants";
import { getSupabaseFunctionHeaders, supabaseUrl } from "../lib/supabaseClient";

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

function LineupTable({ team, matchupType }: { team: TeamDetail; matchupType: "league" | "cup" }) {
  return (
    <Card className="p-4">
      <h3 className="text-lg font-semibold">
        {team.rank != null ? `#${team.rank} ` : ""}{team.manager_name}
      </h3>
      <p className="text-sm text-muted-foreground mb-3">{team.entry_name}</p>
      <div className="mb-2 grid grid-cols-[minmax(140px,1fr)_repeat(11,minmax(34px,auto))] gap-2 text-[10px] text-muted-foreground">
        <div>Player</div>
        <div className="text-right">Goals Scored</div>
        <div className="text-right">Assists</div>
        <div className="text-right">Minutes Played</div>
        <div className="text-right">Defensive Contributions</div>
        <div className="text-right">Clean Sheets</div>
        <div className="text-right">Goals Conceded</div>
        <div className="text-right">Yellow Cards</div>
        <div className="text-right">Red Cards</div>
        <div className="text-right">Penalties Missed</div>
        <div className="text-right">Penalties Saved</div>
        <div className="text-right">Points</div>
      </div>
      <div className="space-y-1 text-sm">
        {team.lineup.map((p) => (
          <div key={`${team.id}-${p.player_id}`} className="grid grid-cols-[minmax(140px,1fr)_repeat(11,minmax(34px,auto))] gap-2 rounded border p-2 text-xs">
            <div className="font-medium">
              {p.player_name}
              {p.is_cup_captain ? <span className="ml-1 text-[10px] text-amber-600">x2</span> : null}
              <div className="text-[10px] text-muted-foreground">Pts {p.effective_points.toFixed(1)}</div>
            </div>
            <div className="text-right">{p.goals_scored}</div>
            <div className="text-right">{p.assists}</div>
            <div className="text-right">{p.minutes}</div>
            <div className="text-right">{p.defensive_contributions}</div>
            <div className="text-right">{p.clean_sheets}</div>
            <div className="text-right">{p.goals_conceded}</div>
            <div className="text-right">{p.yellow_cards}</div>
            <div className="text-right">{p.red_cards}</div>
            <div className="text-right">{p.penalties_missed}</div>
            <div className="text-right">{p.penalties_saved}</div>
            <div className="text-right font-semibold">{p.effective_points.toFixed(1)}</div>
          </div>
        ))}
      </div>
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

  return (
    <div className="space-y-6">
      <div>
        <Link to="/fixtures" className="text-sm text-muted-foreground hover:underline">← Back to Fixtures</Link>
        <h1 className="text-3xl font-bold mt-2">{data.type === "cup" ? "Cup Matchup" : "League Matchup"} • GW {data.gameweek}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Score: {data.matchup.team_1_points ?? data.matchup.live_team_1_points.toFixed(1)} - {data.matchup.team_2_points ?? data.matchup.live_team_2_points.toFixed(1)}
          {data.matchup.round ? ` • ${data.matchup.round}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <LineupTable team={data.team_1} matchupType={data.type} />
        <LineupTable team={data.team_2} matchupType={data.type} />
      </div>
    </div>
  );
}
