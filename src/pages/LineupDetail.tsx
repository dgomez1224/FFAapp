import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Card } from "../components/ui/card";
import { EDGE_FUNCTIONS_BASE } from "../lib/constants";
import { getSupabaseFunctionHeaders, supabaseUrl } from "../lib/supabaseClient";
import { FootballPitch, PitchPlayer } from "../components/FootballPitch";
import { PlayerStats, PlayerStatsModal } from "../components/PlayerStatsModal";

type Payload = {
  type: "cup" | "league";
  gameweek: number;
  has_started: boolean;
  total_points: number;
  team: {
    id: string;
    entry_name: string | null;
    manager_name: string | null;
  };
  lineup: Array<{
    player_id: number;
    player_name: string;
    player_image_url?: string | null;
    position: number;
    is_captain: boolean;
    is_vice_captain: boolean;
    is_cup_captain: boolean;
    raw_points: number;
    multiplier: number;
    effective_points: number;
    goals_scored?: number;
    assists?: number;
    minutes?: number;
  }>;
};

export default function LineupDetailPage() {
  const { type, gameweek, teamId } = useParams<{ type: "cup" | "league"; gameweek: string; teamId: string }>();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerStats | null>(null);

  useEffect(() => {
    async function load() {
      if (!type || !gameweek || !teamId) return;
      try {
        setLoading(true);
        setError(null);
        const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/fixtures/lineup?team=${encodeURIComponent(teamId)}&gameweek=${encodeURIComponent(gameweek)}&type=${encodeURIComponent(type)}`;
        const res = await fetch(url, { headers: getSupabaseFunctionHeaders() });
        const payload = await res.json();
        if (!res.ok || payload?.error) {
          throw new Error(payload?.error?.message || "Failed to fetch lineup");
        }
        setData(payload);
      } catch (err: any) {
        setError(err?.message || "Failed to fetch lineup");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [type, gameweek, teamId]);

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

  if (loading) return <Card className="p-6"><p className="text-sm text-muted-foreground">Loading lineup...</p></Card>;
  if (error || !data) return <Card className="p-6"><p className="text-sm text-destructive">{error || "Failed to load lineup"}</p></Card>;

  const players: PitchPlayer[] = data.lineup.map((p) => ({ ...p }));

  return (
    <div className="space-y-4">
      <div>
        <Link to={`/manager/${String(data.team.manager_name || "").toLowerCase()}`} className="text-sm text-muted-foreground hover:underline">
          ← Back to manager
        </Link>
        <h1 className="text-2xl font-semibold mt-2">
          {data.team.manager_name || "Manager"} • GW {data.gameweek} {data.type === "cup" ? "Cup" : "League"} Lineup
        </h1>
      </div>

      <Card className="p-6">
        <div className="mb-3">
          <p className="text-sm text-muted-foreground">{data.team.entry_name || "Team"}</p>
          <p className="text-lg font-semibold">Total Points: {Number(data.total_points || 0).toFixed(1)}</p>
        </div>
        <FootballPitch players={players} onPlayerClick={handlePlayerClick} showCaptain={true} />
      </Card>

      <PlayerStatsModal
        player={selectedPlayer!}
        isOpen={!!selectedPlayer}
        onClose={() => setSelectedPlayer(null)}
        showHistory={true}
      />
    </div>
  );
}
