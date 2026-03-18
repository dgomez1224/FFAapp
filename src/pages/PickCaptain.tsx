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
import PlayerStatsTable from "../components/PlayerStatsTable";
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
  const [livePoints, setLivePoints] = useState<Record<number, number>>({});
  const [liveStats, setLiveStats] = useState<Record<number, any>>({});
  const [currentGw, setCurrentGw] = useState<number>(0);
  const [nextGw, setNextGw] = useState<number>(0);
  const [gwLocked, setGwLocked] = useState<boolean>(false);

  const token = useMemo(() => getCaptainSessionToken(), []);
  const toPositiveIntOrNull = (value: unknown): number | null => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
  };

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
      const normalizedPlayers: CaptainPlayer[] = (payload.players || [])
        .map((p: any) => ({
          id: toPositiveIntOrNull(p?.id) ?? 0,
          name: String(p?.name || "").trim() || `Player ${p?.id}`,
          image_url: p?.image_url || null,
          team: toPositiveIntOrNull(p?.team),
          position: toPositiveIntOrNull(p?.position),
        }))
        .filter((p: CaptainPlayer) => p.id > 0);
      const normalizedCaptainId = toPositiveIntOrNull(payload.selected_captain_id);
      const normalizedViceCaptainId = toPositiveIntOrNull(payload.selected_vice_captain_id);
      const normalizedContext: CaptainContext = {
        ...payload,
        players: normalizedPlayers,
        selected_captain_id: normalizedCaptainId,
        selected_vice_captain_id: normalizedViceCaptainId,
      };

      setContext(normalizedContext);

      // Fetch points for the current cup gameweek: live when GW is active, final when event_finished
      try {
        const gwRes = await fetch(
          `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/current-gameweek`,
          { headers: getSupabaseFunctionHeaders() }
        );
        const gwData = gwRes.ok ? await gwRes.json() : null;
        const activeGw = gwData?.current_gameweek ?? normalizedContext.gameweek;
        const eventFinished =
          gwData?.current_event_finished === true || gwData?.event_finished === true;
        const cGw = gwData?.current_gameweek ?? 0;
        const nGw = eventFinished ? cGw + 1 : cGw;
        // GW is locked if it has already started OR is already finished
        const locked = !eventFinished === false ? false : false;
        // Simpler: locked = current GW has started and NOT finished yet,
        // OR current GW is finished (picks are for next GW which hasn't started)
        // Captain picks should only be blocked if the TARGET gameweek has started.
        // Target GW = next GW if event_finished, else current GW.
        // Lock saving if target GW == current GW and event has started (not finished yet).
        const targetGw = eventFinished ? cGw + 1 : cGw;
        const isLocked = !eventFinished && cGw > 0;
        // Actually: lock = GW is currently IN PROGRESS (started but not finished)
        // Allow picks only when: GW hasn't started yet (upcoming) OR between GWs (finished)
        const gwInProgress = cGw > 0 && !eventFinished;
        setCurrentGw(cGw);
        setNextGw(targetGw);
        setGwLocked(gwInProgress);
        if (activeGw > 0) {
          const liveRes = await fetch(
            `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/api/live?event=${activeGw}`,
            { headers: getSupabaseFunctionHeaders() }
          );
          if (liveRes.ok) {
            const liveData = await liveRes.json();
            const pts: Record<number, number> = {};
            const stats: Record<number, any> = {};
            const elements = liveData?.elements ?? {};
            Object.entries(elements).forEach(([key, el]: [string, any]) => {
              const id = Number(key);
              if (!id) return;
              const p = el?.stats?.total_points ?? el?.total_points ?? el?.points ?? 0;
              pts[id] = p;
              if (el?.stats) stats[id] = el.stats;
            });
            setLivePoints(pts);
            setLiveStats(stats);
          }
        }
      } catch {
        // non-fatal
      }
      setCaptainId(normalizedCaptainId);
      setViceCaptainId(normalizedViceCaptainId);
      if (normalizedViceCaptainId && !payload.selected_vice_captain_name) {
        const resolvedViceName =
          normalizedPlayers.find((p: CaptainPlayer) => p.id === normalizedViceCaptainId)?.name || null;
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
          gameweek: nextGw > 0 ? nextGw : undefined,
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
      setContext((prev) =>
        prev
          ? {
              ...prev,
              selected_captain_id: captainId,
              selected_captain_name: captainName,
              selected_vice_captain_id: viceCaptainId,
              selected_vice_captain_name: viceName,
            }
          : prev,
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
    raw_points: livePoints[p.id] ?? 0,
    effective_points: p.id === captainId
    ? (livePoints[p.id] ?? 0) * 2
    : (livePoints[p.id] ?? 0),
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

      const s = liveStats[player.player_id];
      const pos = player.position; // 1=GK, 2=DEF, 3=MID, 4=FWD
      const livePts = livePoints[player.player_id] ?? 0;

      const stats: PlayerStats = {
        player_id: player.player_id,
        player_name: player.player_name,
        player_image_url: player.player_image_url ?? null,
        position: player.position,
        raw_points: livePts,
        effective_points: player.is_captain ? livePts * 2 : livePts,
        is_captain: player.is_captain,
        is_vice_captain: player.is_vice_captain,
        is_cup_captain: player.is_cup_captain,
        multiplier: player.multiplier,
        goals_scored: s?.goals_scored ?? 0,
        assists: s?.assists ?? 0,
        minutes: s?.minutes ?? 0,
        bonus: s?.bonus ?? 0,
        // Position exclusions for modal Gameweek Statistics: GK hide DefCon; DEF/MID hide saves; FWD hide clean_sheets
        defensive_contributions: pos !== 1 ? (s?.defensive_contribution ?? 0) : undefined,
        clean_sheets: pos !== 4 ? (s?.clean_sheets ?? 0) : undefined,
        saves: pos === 1 ? (s?.saves ?? 0) : undefined,
        yellow_cards: s?.yellow_cards ?? 0,
        red_cards: s?.red_cards ?? 0,
        goals_conceded: s?.goals_conceded ?? 0,
        penalties_saved: s?.penalties_saved ?? 0,
        penalties_missed: s?.penalties_missed ?? 0,
        history: (payload.history || []).map((h: any) => ({
          gameweek: h.gameweek,
          points: h.points ?? 0,
          goals: h.goals ?? 0,
          own_goals: h.own_goals ?? 0,
          assists: h.assists ?? 0,
          minutes: h.minutes ?? 0,
          clean_sheets: h.clean_sheets ?? 0,
          goals_conceded: h.goals_conceded ?? 0,
          bonus: h.bonus ?? 0,
          saves: h.saves ?? 0,
          yellow_cards: h.yellow_cards ?? 0,
          red_cards: h.red_cards ?? 0,
          penalties_saved: h.penalties_saved ?? 0,
          penalties_missed: h.penalties_missed ?? 0,
          defensive_contributions: h.defensive_contribution ?? h.defensive_contributions ?? 0,
          expected_goals: h.expected_goals ?? 0,
          expected_assists: h.expected_assists ?? 0,
          expected_goal_involvements: h.expected_goal_involvements ?? 0,
          expected_goals_conceded: h.expected_goals_conceded ?? 0,
          opponent_team_name: h.opponent_team_name ?? null,
          was_home: h.was_home,
          fixture: h.fixture ?? null,
          result: h.result ?? null,
          kickoff_time: h.kickoff_time ?? null,
          fixture_difficulty: h.fixture_difficulty ?? null,
          is_upcoming: !!h.is_upcoming,
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
    if (playerId === viceCaptainId) {
      setError("Captain and vice-captain must be different players.");
      return;
    }
    setError(null);
    setCaptainId(playerId);
    setContext((prev) =>
      prev
        ? {
            ...prev,
            selected_captain_id: playerId,
            selected_captain_name:
              (prev.players || []).find((p) => p.id === playerId)?.name || prev.selected_captain_name || null,
          }
        : prev,
    );
    setSelectedPlayer(null);
  };

  const handleSelectViceCaptainFromModal = (playerId: number) => {
    if (playerId === captainId) {
      setError("Captain and vice-captain must be different players.");
      return;
    }
    setError(null);
    setViceCaptainId(playerId);
    setContext((prev) =>
      prev
        ? {
            ...prev,
            selected_vice_captain_id: playerId,
            selected_vice_captain_name:
              (prev.players || []).find((p) => p.id === playerId)?.name || prev.selected_vice_captain_name || null,
          }
        : prev,
    );
    setSelectedPlayer(null);
  };

  const selectedCaptainName =
    (context?.players || []).find((p) => p.id === captainId)?.name ||
    context?.selected_captain_name ||
    null;
  const selectedViceCaptainName =
    (context?.players || []).find((p) => p.id === viceCaptainId)?.name ||
    context?.selected_vice_captain_name ||
    null;

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
              {context.manager_name} {context.team_name ? `(${context.team_name})` : ""} | GW
              {nextGw > 0 ? nextGw : context.gameweek}
              {gwLocked && (
                <span className="ml-2 text-xs text-amber-600 font-medium">
                  (GW{currentGw} in progress — picks locked)
                </span>
              )}
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

        {(context?.players || []).length > 0 && (
          <PlayerStatsTable
            players={(context.players || []).map((p) => ({
              id: p.id,
              name: p.name,
              image_url: p.image_url,
              position: p.position,
            }))}
            livePoints={livePoints}
            liveStats={liveStats}
            captainId={captainId}
            viceCaptainId={viceCaptainId}
            gameweek={currentGw > 0 ? currentGw : context.gameweek}
          />
        )}

        <div className="mt-5 flex items-center gap-2">
          <Button 
            onClick={handleSave} 
            disabled={saving || !captainId || !viceCaptainId || captainId === viceCaptainId || gwLocked}
          >
            {saving
              ? "Saving..."
              : gwLocked
              ? `GW${currentGw} in progress — picks locked`
              : "Save Captains"}
          </Button>
          {(selectedCaptainName || selectedViceCaptainName) && (
            <p className="text-sm text-muted-foreground">
              Current selection:
              {selectedCaptainName ? ` C ${selectedCaptainName}` : " C -"}
              {selectedViceCaptainName ? ` / VC ${selectedViceCaptainName}` : " / VC -"}
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
