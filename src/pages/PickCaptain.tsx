import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { EDGE_FUNCTIONS_BASE } from "../lib/constants";
import { getSupabaseFunctionHeaders, supabaseUrl } from "../lib/supabaseClient";
import {
  clearCaptainSessionToken,
  getCaptainSessionToken,
} from "../lib/captainSession";
import { FootballPitch, PitchPlayer } from "../components/FootballPitch";
import { PlayerStatsModal, PlayerStats } from "../components/PlayerStatsModal";

type CaptainPlayer = {
  id: number;
  name: string;
  image_url?: string | null;
  team: number | null;
  position: number | null;
};

type CaptainContext = {
  manager_name: string;
  team_name: string | null;
  gameweek: number;
  players: CaptainPlayer[];
  selected_captain_id: number | null;
  selected_captain_name: string | null;
  selected_vice_captain_id: number | null;
  selected_vice_captain_name: string | null;
};

export default function PickCaptain() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [context, setContext] = useState<CaptainContext | null>(null);
  const [captainId, setCaptainId] = useState<number | null>(null);
  const [viceCaptainId, setViceCaptainId] = useState<number | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerStats | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const token = useMemo(() => getCaptainSessionToken(), []);

  const loadContext = async () => {
    if (!token) {
      navigate("/sign-in", { replace: true });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/captain/context?token=${encodeURIComponent(token)}`;
      const res = await fetch(url, { headers: getSupabaseFunctionHeaders() });
      const payload = await res.json();
      if (!res.ok || payload?.error) {
        throw new Error(payload?.error?.message || "Failed to load captain context");
      }
      setContext(payload);
      setCaptainId(payload.selected_captain_id ?? null);
      setViceCaptainId(payload.selected_vice_captain_id ?? null);
      if ((payload.selected_vice_captain_id ?? null) && !payload.selected_vice_captain_name) {
        const resolvedViceName =
          (payload.players || []).find((p: CaptainPlayer) => p.id === payload.selected_vice_captain_id)?.name || null;
        if (resolvedViceName) {
          setContext((prev) => (prev ? { ...prev, selected_vice_captain_name: resolvedViceName } : prev));
        }
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load captain context");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContext();
  }, []);

  const handleSave = async () => {
    if (!token || !captainId || !viceCaptainId) {
      setError("Please choose both a captain and vice-captain.");
      return;
    }
    if (captainId === viceCaptainId) {
      setError("Captain and vice-captain must be different players.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/captain/select`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getSupabaseFunctionHeaders(),
        },
        body: JSON.stringify({
          token,
          captain_player_id: captainId,
          vice_captain_player_id: viceCaptainId,
        }),
      });
      const payload = await res.json();
      if (!res.ok || payload?.error) {
        throw new Error(payload?.error?.message || "Failed to save captain");
      }
      const captainName = (context?.players || []).find((p) => p.id === captainId)?.name || payload?.captain_name || `Player ${captainId}`;
      const viceName = (context?.players || []).find((p) => p.id === viceCaptainId)?.name || payload?.vice_captain_name || `Player ${viceCaptainId}`;
      setSuccess(
        `Captaincy saved for GW${payload.gameweek}: C ${captainName} / VC ${viceName}`,
      );
      await loadContext();
    } catch (err: any) {
      setError(err?.message || "Failed to save captain");
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      if (token) {
        const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/captain-auth/sign-out`;
        await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getSupabaseFunctionHeaders(),
          },
          body: JSON.stringify({ token }),
        });
      }
    } finally {
      clearCaptainSessionToken();
      navigate("/sign-in", { replace: true });
    }
  };

  const pitchPlayers = (context?.players || []).map((p) => ({
    player_id: p.id,
    player_name: p.name,
    player_image_url: p.image_url || null,
    position: p.position || 3,
    raw_points: 0,
    effective_points: 0,
    is_captain: p.id === captainId,
    is_vice_captain: p.id === viceCaptainId,
    is_cup_captain: p.id === captainId,
    multiplier: p.id === captainId ? 2 : 1,
  })) as PitchPlayer[];

  const handlePlayerClick = async (player: PitchPlayer) => {
    // Fetch history for the player and show in modal
    setHistoryLoading(true);
    setError(null);
    try {
      const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/player-history?player_id=${encodeURIComponent(
        String(player.player_id),
      )}`;
      const res = await fetch(url, { headers: getSupabaseFunctionHeaders() });
      const payload = await res.json();
      if (!res.ok || payload?.error) {
        throw new Error(payload?.error?.message || "Failed to fetch player history");
      }

      const stats: PlayerStats = {
        player_id: player.player_id,
        player_name: player.player_name,
        position: player.position,
        raw_points: 0,
        effective_points: 0,
        is_captain: player.is_captain,
        is_vice_captain: player.is_vice_captain,
        is_cup_captain: player.is_cup_captain,
        multiplier: player.multiplier,
        goals_scored: (payload.history || [])[0]?.goals ?? 0,
        assists: (payload.history || [])[0]?.assists ?? 0,
        minutes: (payload.history || [])[0]?.minutes ?? 0,
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
      };

      setSelectedPlayer(stats);
    } catch (err: any) {
      setError(err?.message || "Failed to fetch player history");
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSelectCaptainFromModal = (playerId: number) => {
    setCaptainId(playerId);
    setSelectedPlayer(null);
  };

  const handleSelectViceCaptainFromModal = (playerId: number) => {
    setViceCaptainId(playerId);
    setSelectedPlayer(null);
  };

  if (loading) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">Loading captain picks...</p>
      </Card>
    );
  }

  if (!context) {
    return (
      <Card className="p-6">
        <p className="text-sm text-destructive">{error || "No captain context available."}</p>
        <div className="mt-4">
          <Button onClick={() => navigate("/sign-in")}>Go to Sign In</Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Pick Captain</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {context.manager_name} {context.team_name ? `(${context.team_name})` : ""} | GW{context.gameweek}
            </p>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            Sign Out
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Your Team</h2>
        <FootballPitch players={pitchPlayers} onPlayerClick={handlePlayerClick} showCaptain={true} />

        <div className="mt-5 flex items-center gap-2">
          <Button onClick={handleSave} disabled={saving || !captainId || !viceCaptainId || captainId === viceCaptainId}>
            {saving ? "Saving..." : "Save Captains"}
          </Button>
          {context.selected_captain_name && (
            <p className="text-sm text-muted-foreground">
              Current selection: C {context.selected_captain_name}
              {context.selected_vice_captain_name ? ` / VC ${context.selected_vice_captain_name}` : ""}
            </p>
          )}
        </div>

        {error && <p className="text-sm text-destructive mt-3">{error}</p>}
        {success && <p className="text-sm text-emerald-600 mt-3">{success}</p>}
      </Card>

      {historyLoading && (
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Loading player history...</p>
        </Card>
      )}

      <PlayerStatsModal
        player={selectedPlayer!}
        isOpen={!!selectedPlayer}
        onClose={() => setSelectedPlayer(null)}
        showHistory={true}
        onSelectCaptain={handleSelectCaptainFromModal}
        onSelectViceCaptain={handleSelectViceCaptainFromModal}
      />
    </div>
  );
}
