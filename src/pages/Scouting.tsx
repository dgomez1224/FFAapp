import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { EDGE_FUNCTIONS_BASE } from "../lib/constants";
import { getSupabaseFunctionHeaders, supabaseUrl } from "../lib/supabaseClient";
import { getCaptainSessionToken } from "../lib/captainSession";
import { getProxiedImageUrl } from "../lib/playerImage";

const POSITIONS = ["GK", "DEF", "MID", "FWD"];
const STAT_GROUPS: Array<{ title: string; stats: string[] }> = [
  { title: "Core", stats: ["PPG", "Points", "Form", "Minutes", "Starts"] },
  { title: "Attacking", stats: ["Goals", "Assists", "xG", "xA", "xGI", "Threat", "Creativity"] },
  { title: "Defending", stats: ["Clean Sheets", "Goals Conceded", "xGC", "Saves", "Penalties Saved", "Tackles", "Recoveries", "CBI", "Defensive Contribution"] },
  { title: "Advanced", stats: ["Bonus", "BPS", "Influence", "ICT", "EP Next", "Play Chance"] },
];

type Scout = {
  id: string;
  scout_name: string;
  position_focus: string[];
  stat_focus: Record<string, boolean>;
  duration_gameweeks: number;
  start_gameweek: number;
  end_gameweek: number;
  active: boolean;
};

type Recommendation = {
  id: string;
  scout_id: string;
  player_name: string;
  player_position: string | null;
  player_image_url: string | null;
  recommendation_text: string;
  statistics: Record<string, number | string | null>;
  recommendation_score: number;
  status: "pending" | "accepted" | "rejected";
};

export default function ScoutingPage() {
  const navigate = useNavigate();
  const token = useMemo(() => getCaptainSessionToken(), []);
  const [loading, setLoading] = useState(true);
  const [hiring, setHiring] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scouts, setScouts] = useState<Scout[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [selectedScoutId, setSelectedScoutId] = useState<string | null>(null);
  const [positions, setPositions] = useState<string[]>(["MID", "FWD"]);
  const [statistics, setStatistics] = useState<Record<string, boolean>>({ PPG: true, Points: true, xG: true });
  const [duration, setDuration] = useState(3);
  const [fixtureDifficulty, setFixtureDifficulty] = useState<"Any" | "Easy" | "Medium" | "Hard">("Any");
  const [checkNextGw, setCheckNextGw] = useState(3);

  async function loadNetwork() {
    if (!token) {
      navigate("/sign-in", { replace: true });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/scouting?token=${encodeURIComponent(token)}`,
        { headers: getSupabaseFunctionHeaders() },
      );
      const payload = await res.json();
      if (!res.ok || payload?.error) throw new Error(payload?.error?.message || "Failed to load scouting");
      const nextScouts: Scout[] = payload.scouts || [];
      setScouts(nextScouts);
      setRecommendations(payload.recommendations || []);
      setSelectedScoutId((prev) => prev && nextScouts.some((s) => s.id === prev) ? prev : nextScouts[0]?.id || null);
    } catch (err: any) {
      setError(err.message || "Failed to load scouting");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNetwork();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, navigate]);

  async function hireScout() {
    if (!token) return;
    setHiring(true);
    setError(null);
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/scouting/hire?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { ...getSupabaseFunctionHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          positions,
          statistics,
          duration_gameweeks: duration,
          fixture_difficulty: fixtureDifficulty,
          check_next_gw: checkNextGw,
        }),
      });
      const payload = await res.json();
      if (!res.ok || payload?.error) throw new Error(payload?.error?.message || "Failed to hire scout");
      await loadNetwork();
      if (payload?.scout?.id) setSelectedScoutId(payload.scout.id);
    } catch (err: any) {
      setError(err.message || "Failed to hire scout");
    } finally {
      setHiring(false);
    }
  }

  async function deactivateScout(id: string) {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/scouting/deactivate?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { ...getSupabaseFunctionHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const payload = await res.json();
      if (!res.ok || payload?.error) throw new Error(payload?.error?.message || "Failed to end scout assignment");
      setScouts((prev) => prev.map((row) => (row.id === id ? { ...row, active: false } : row)));
    } catch (err: any) {
      setError(err.message || "Failed to end scout assignment");
    } finally {
      setSaving(false);
    }
  }

  async function deleteScout(id: string) {
    if (!token) return;
    if (!window.confirm("Delete this scout and their shortlist?")) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/scouting/delete?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { ...getSupabaseFunctionHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const payload = await res.json();
      if (!res.ok || payload?.error) throw new Error(payload?.error?.message || "Failed to delete scout");
      const next = scouts.filter((row) => row.id !== id);
      setScouts(next);
      setRecommendations((prev) => prev.filter((row) => row.scout_id !== id));
      if (selectedScoutId === id) setSelectedScoutId(next[0]?.id || null);
    } catch (err: any) {
      setError(err.message || "Failed to delete scout");
    } finally {
      setSaving(false);
    }
  }

  async function setRecStatus(id: string, status: "accepted" | "rejected") {
    if (!token) return;
    const res = await fetch(`${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/scouting/recommendation-status?token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { ...getSupabaseFunctionHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    const payload = await res.json();
    if (!res.ok || payload?.error) {
      setError(payload?.error?.message || "Failed to update recommendation");
      return;
    }
    setRecommendations((prev) => prev.map((row) => (row.id === id ? { ...row, status } : row)));
  }

  const selectedRecs = recommendations.filter((row) => row.scout_id === selectedScoutId);
  const selectedScout = scouts.find((s) => s.id === selectedScoutId);

  if (loading) {
    return <Card className="p-6"><p className="text-sm text-muted-foreground">Calling the scouting department…</p></Card>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Scouting Network</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Send a scout to watch positions and stats for 2–4 gameweeks. This is Draft, so there is no transfer fee — just a shortlist.
        </p>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Card className="p-5 space-y-4">
        <h2 className="text-lg font-semibold">Hire a scout</h2>
        <div>
          <p className="text-sm font-medium mb-2">Position focus</p>
          <div className="flex flex-wrap gap-2">
            {POSITIONS.map((pos) => (
              <label key={pos} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={positions.includes(pos)}
                  onChange={(e) => setPositions((prev) => e.target.checked ? [...prev, pos] : prev.filter((p) => p !== pos))}
                />
                {pos}
              </label>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-medium mb-2">Stat focus</p>
          <div className="space-y-3">
            {STAT_GROUPS.map((group) => (
              <div key={group.title}>
                <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{group.title}</p>
                <div className="flex flex-wrap gap-3">
                  {group.stats.map((stat) => (
                    <label key={stat} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={!!statistics[stat]}
                        onChange={(e) => setStatistics((prev) => ({ ...prev, [stat]: e.target.checked }))}
                      />
                      {stat}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            Upcoming fixtures
            <select
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={fixtureDifficulty}
              onChange={(e) => setFixtureDifficulty(e.target.value as typeof fixtureDifficulty)}
            >
              <option value="Any">Any difficulty</option>
              <option value="Easy">Easy run</option>
              <option value="Medium">Average run</option>
              <option value="Hard">Tough run</option>
            </select>
          </label>
          <label className="block text-sm">
            Gameweeks to check: {checkNextGw}
            <input
              type="range"
              min={1}
              max={5}
              value={checkNextGw}
              onChange={(e) => setCheckNextGw(Number(e.target.value))}
              className="mt-2 w-full"
            />
          </label>
        </div>
        <label className="block text-sm">
          Scouting window: {duration} gameweeks
          <input
            type="range"
            min={2}
            max={4}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="mt-2 w-full max-w-sm"
          />
        </label>
        <p className="text-xs text-muted-foreground">Up to 3 active scouts at a time. Recommendations use current FPL stats and prefer unowned players.</p>
        <Button onClick={hireScout} disabled={hiring}>{hiring ? "Briefing scout…" : "Hire scout"}</Button>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
        <Card className="p-3 space-y-2">
          <h3 className="px-1 text-sm font-semibold">Your scouts</h3>
          {scouts.length === 0 ? (
            <p className="px-1 text-sm text-muted-foreground">No scouts on the payroll yet.</p>
          ) : (
            scouts.map((scout) => (
              <div
                key={scout.id}
                className={`w-full rounded-md p-3 text-left hover:bg-muted ${selectedScoutId === scout.id ? "bg-muted" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedScoutId(scout.id)}
                  className="w-full text-left"
                >
                  <p className="font-medium">{scout.scout_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(scout.position_focus || []).join(", ") || "Any position"} · GW {scout.start_gameweek}–{scout.end_gameweek}
                  </p>
                </button>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant={scout.active ? "secondary" : "outline"}>{scout.active ? "Active" : "Done"}</Badge>
                  {scout.active ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      disabled={saving}
                      onClick={() => deactivateScout(scout.id)}
                    >
                      {saving ? "Ending…" : "End assignment"}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs text-destructive"
                      disabled={saving}
                      onClick={() => deleteScout(scout.id)}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </Card>

        <div className="space-y-3">
          {selectedScout ? (
            <h3 className="text-lg font-semibold">Recommendations from {selectedScout.scout_name}</h3>
          ) : (
            <h3 className="text-lg font-semibold">Recommendations</h3>
          )}
          {selectedRecs.length === 0 ? (
            <Card className="p-4"><p className="text-sm text-muted-foreground">Hire a scout to generate a shortlist.</p></Card>
          ) : (
            selectedRecs.map((rec) => (
              <Card key={rec.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {rec.player_image_url ? (
                      <img src={getProxiedImageUrl(rec.player_image_url) || rec.player_image_url} alt="" className="h-12 w-12 rounded-full object-cover border" />
                    ) : null}
                    <div>
                      <h4 className="font-semibold">{rec.player_name}</h4>
                      <p className="text-xs text-muted-foreground">{rec.player_position} · score {Number(rec.recommendation_score).toFixed(1)}</p>
                    </div>
                  </div>
                  <Badge variant={rec.status === "accepted" ? "default" : rec.status === "rejected" ? "outline" : "secondary"}>
                    {rec.status}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  {["PPG", "Points", "Form", "xG", "xA", "Bonus"].map((key) => (
                    <div key={key} className="rounded-md border p-2">
                      <p className="text-muted-foreground">{key}</p>
                      <p className="font-semibold">{rec.statistics?.[key] ?? "—"}</p>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">“{rec.recommendation_text}”</p>
                {rec.status === "pending" ? (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setRecStatus(rec.id, "accepted")}>Transfer target</Button>
                    <Button size="sm" variant="outline" onClick={() => setRecStatus(rec.id, "rejected")}>Not interested</Button>
                  </div>
                ) : null}
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
