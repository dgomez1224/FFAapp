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

type CaptainPlayer = {
  id: number;
  name: string;
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
};

export default function PickCaptain() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [context, setContext] = useState<CaptainContext | null>(null);
  const [captainId, setCaptainId] = useState<number | null>(null);

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
    if (!token || !captainId) {
      setError("Please choose a captain.");
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
        }),
      });
      const payload = await res.json();
      if (!res.ok || payload?.error) {
        throw new Error(payload?.error?.message || "Failed to save captain");
      }
      setSuccess(`Captain saved for GW${payload.gameweek}: ${payload.captain_name}`);
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {context.players.map((player) => (
            <label
              key={player.id}
              className={`border rounded-md px-3 py-2 text-sm cursor-pointer ${
                captainId === player.id ? "border-primary bg-muted" : ""
              }`}
            >
              <input
                type="radio"
                name="captain"
                value={player.id}
                checked={captainId === player.id}
                onChange={() => setCaptainId(player.id)}
                className="mr-2"
              />
              {player.name}
            </label>
          ))}
        </div>

        <div className="mt-5 flex items-center gap-2">
          <Button onClick={handleSave} disabled={saving || !captainId}>
            {saving ? "Saving..." : "Save Captain"}
          </Button>
          {context.selected_captain_name && (
            <p className="text-sm text-muted-foreground">
              Current selection: {context.selected_captain_name}
            </p>
          )}
        </div>

        {error && <p className="text-sm text-destructive mt-3">{error}</p>}
        {success && <p className="text-sm text-emerald-600 mt-3">{success}</p>}
      </Card>
    </div>
  );
}
