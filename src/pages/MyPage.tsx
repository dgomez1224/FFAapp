import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { EDGE_FUNCTIONS_BASE } from "../lib/constants";
import { getSupabaseFunctionHeaders, supabaseUrl } from "../lib/supabaseClient";
import { PlayerAvatar } from "../components/PlayerAvatar";
import {
  clearCaptainSessionToken,
  getCaptainSessionToken,
} from "../lib/captainSession";

export default function MyPage() {
  const navigate = useNavigate();
  const token = useMemo(() => getCaptainSessionToken(), []);

  const [loading, setLoading] = useState(true);
  const [managerName, setManagerName] = useState<string | null>(null);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [media, setMedia] = useState<{
    club_crest_url: string | null;
    club_logo_url: string | null;
    manager_profile_picture_url: string | null;
  }>({
    club_crest_url: null,
    club_logo_url: null,
    manager_profile_picture_url: null,
  });
  const [managerInsights, setManagerInsights] = useState<any | null>(null);
  const [targets, setTargets] = useState<Array<{
    id: string;
    player_id: number;
    player_name: string;
    player_position: string | null;
    player_team: string | null;
    player_image_url: string | null;
    price: number | null;
    points_per_game: number | null;
    form: string | null;
  }>>([]);
  const [targetQuery, setTargetQuery] = useState("");
  const [targetResults, setTargetResults] = useState<Array<{
    player_id: number;
    player_name: string;
    player_position: string | null;
    player_image_url: string | null;
    team_name: string | null;
    now_cost: number | null;
    points_per_game: number | null;
    form: number | null;
  }>>([]);
  const [targetsLoading, setTargetsLoading] = useState(false);

  useEffect(() => {
    async function loadSession() {
      if (!token) {
        navigate("/sign-in", { replace: true });
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/captain-auth/session?token=${encodeURIComponent(token)}`;
        const res = await fetch(url, { headers: getSupabaseFunctionHeaders() });
        const payload = await res.json();
        if (!res.ok || payload?.error) {
          throw new Error(payload?.error?.message || "Failed to validate session");
        }
        setManagerName(payload.manager_name || null);
        setTeamName(payload.team_name || null);
        setMedia({
          club_crest_url: payload?.media?.club_crest_url || null,
          club_logo_url: payload?.media?.club_logo_url || null,
          manager_profile_picture_url: payload?.media?.manager_profile_picture_url || null,
        });
      } catch (err: any) {
        setError(err?.message || "Failed to validate session");
      } finally {
        setLoading(false);
      }
    }
    loadSession();
  }, [navigate, token]);

  useEffect(() => {
    async function loadManagerInsights() {
      if (!managerName) return;
      try {
        const normalized = managerName.toUpperCase();
        const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/legacy-stats/manager/${encodeURIComponent(normalized)}`;
        const res = await fetch(url, { headers: getSupabaseFunctionHeaders() });
        const payload = await res.json();
        if (!res.ok || payload?.error) return;
        setManagerInsights(payload);
      } catch {
        setManagerInsights(null);
      }
    }
    loadManagerInsights();
  }, [managerName]);

  useEffect(() => {
    async function loadTargets() {
      if (!token) return;
      try {
        const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/transfer-targets?token=${encodeURIComponent(token)}`;
        const res = await fetch(url, { headers: getSupabaseFunctionHeaders() });
        const payload = await res.json();
        if (!res.ok || payload?.error) return;
        setTargets(payload.targets || []);
      } catch {
        setTargets([]);
      }
    }
    loadTargets();
  }, [token]);

  useEffect(() => {
    if (!token || targetQuery.trim().length < 2) {
      setTargetResults([]);
      return;
    }
    const handle = window.setTimeout(async () => {
      try {
        const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/transfer-targets/search?token=${encodeURIComponent(token)}&q=${encodeURIComponent(targetQuery.trim())}`;
        const res = await fetch(url, { headers: getSupabaseFunctionHeaders() });
        const payload = await res.json();
        if (!res.ok || payload?.error) return;
        setTargetResults(payload.players || []);
      } catch {
        setTargetResults([]);
      }
    }, 250);
    return () => window.clearTimeout(handle);
  }, [targetQuery, token]);

  const addTarget = async (playerId: number) => {
    if (!token) return;
    setTargetsLoading(true);
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/transfer-targets?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { ...getSupabaseFunctionHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ player_id: playerId }),
      });
      const payload = await res.json();
      if (!res.ok || payload?.error) throw new Error(payload?.error?.message || "Failed to add target");
      if (payload.target) {
        setTargets((prev) => [payload.target, ...prev.filter((row) => row.player_id !== playerId)]);
      }
      setTargetQuery("");
      setTargetResults([]);
    } catch (err: any) {
      setError(err.message || "Failed to add target");
    } finally {
      setTargetsLoading(false);
    }
  };

  const removeTarget = async (id: string) => {
    if (!token) return;
    setTargetsLoading(true);
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/transfer-targets/delete?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { ...getSupabaseFunctionHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const payload = await res.json();
      if (!res.ok || payload?.error) throw new Error(payload?.error?.message || "Failed to remove target");
      setTargets((prev) => prev.filter((row) => row.id !== id));
    } catch (err: any) {
      setError(err.message || "Failed to remove target");
    } finally {
      setTargetsLoading(false);
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

  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Failed to read image"));
      reader.readAsDataURL(file);
    });

  const compressImageToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 720;
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const width = Math.max(1, Math.round(img.width * scale));
          const height = Math.max(1, Math.round(img.height * scale));

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Failed to process image");
          ctx.drawImage(img, 0, 0, width, height);

          const asJpeg = canvas.toDataURL("image/jpeg", 0.82);
          URL.revokeObjectURL(objectUrl);
          resolve(asJpeg);
        } catch (err) {
          URL.revokeObjectURL(objectUrl);
          reject(err);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Failed to decode image"));
      };
      img.src = objectUrl;
    });

  const handleUploadMedia = async (
    e: React.ChangeEvent<HTMLInputElement>,
    mediaType: "club_crest" | "club_logo" | "manager_profile_picture",
  ) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setError(null);
    setSuccess(null);
    setUploading(mediaType);
    try {
      let dataUrl = await fileToDataUrl(file);
      // Keep payload size under common edge-function request limits.
      if (dataUrl.length > 900_000) {
        dataUrl = await compressImageToDataUrl(file);
      }
      const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/captain-auth/media`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getSupabaseFunctionHeaders(),
        },
        body: JSON.stringify({
          token,
          media_type: mediaType,
          data_url: dataUrl,
        }),
      });
      const payload = await res.json();
      if (!res.ok || payload?.error) {
        throw new Error(payload?.error?.message || "Failed to upload media");
      }
      setMedia({
        club_crest_url: payload?.media?.club_crest_url || null,
        club_logo_url: payload?.media?.club_logo_url || null,
        manager_profile_picture_url: payload?.media?.manager_profile_picture_url || null,
      });
      setSuccess("Media updated.");
    } catch (err: any) {
      setError(err?.message || "Failed to upload media");
    } finally {
      setUploading(null);
      e.target.value = "";
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!token) {
      navigate("/sign-in", { replace: true });
      return;
    }
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("All password fields are required.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }

    setSaving(true);
    try {
      const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/captain-auth/change-password`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getSupabaseFunctionHeaders(),
        },
        body: JSON.stringify({
          token,
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      const payload = await res.json();
      if (!res.ok || payload?.error) {
        throw new Error(payload?.error?.message || "Failed to change password");
      }
      setSuccess("Password updated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setError(err?.message || "Failed to change password");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">Loading account...</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">My Page</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {managerName || "Manager"} {teamName ? `(${teamName})` : ""}
            </p>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            Sign Out
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link to="/messages">Player messages</Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link to="/scouting">Scouting network</Link>
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-lg font-semibold">Manager Insights</h2>
          {managerName && (
            <Link to={`/manager/${managerName.toLowerCase()}`} className="text-sm hover:underline">
              Open full insights
            </Link>
          )}
        </div>
        {managerInsights?.all_time_stats ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 text-sm">
            <div className="rounded-md border p-3">
              <p className="text-muted-foreground">All-Time Points</p>
              <p className="text-xl font-semibold">{managerInsights.all_time_stats.total_points || 0}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-muted-foreground">Points Per Game</p>
              <p className="text-xl font-semibold">{Number(managerInsights.all_time_stats.points_per_game || 0).toFixed(2)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-muted-foreground">Record (W-D-L)</p>
              <p className="text-xl font-semibold">
                {managerInsights.all_time_stats.wins || 0}-{managerInsights.all_time_stats.draws || 0}-{managerInsights.all_time_stats.losses || 0}
              </p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-muted-foreground">Trophies</p>
              <p className="text-xl font-semibold">
                {(managerInsights.all_time_stats.league_titles || 0) + (managerInsights.all_time_stats.cup_wins || 0) + (managerInsights.all_time_stats.goblet_wins || 0)}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Insights unavailable.</p>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-1">Transfer Targets</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Players you want to bring in. Accepting a scout recommendation also adds them here.
        </p>
        <div className="relative max-w-md mb-4">
          <Input
            value={targetQuery}
            onChange={(e) => setTargetQuery(e.target.value)}
            placeholder="Search players to add…"
          />
          {targetResults.length > 0 ? (
            <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover shadow-md">
              {targetResults.map((player) => (
                <button
                  key={player.player_id}
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                  onClick={() => addTarget(player.player_id)}
                  disabled={targetsLoading}
                >
                  <PlayerAvatar name={player.player_name} imageUrl={player.player_image_url} size="sm" />
                  <span className="flex-1">
                    {player.player_name}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {player.player_position || ""} {player.team_name ? `· ${player.team_name}` : ""}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {targets.length === 0 ? (
          <p className="text-sm text-muted-foreground">No targets yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="px-2 py-2">Player</th>
                  <th className="px-2 py-2">Pos</th>
                  <th className="px-2 py-2">Team</th>
                  <th className="px-2 py-2">Price</th>
                  <th className="px-2 py-2">PPG</th>
                  <th className="px-2 py-2">Form</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {targets.map((target) => (
                  <tr key={target.id} className="border-b last:border-b-0">
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        <PlayerAvatar name={target.player_name} imageUrl={target.player_image_url} size="sm" />
                        <span>{target.player_name}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2">{target.player_position || "—"}</td>
                    <td className="px-2 py-2">{target.player_team || "—"}</td>
                    <td className="px-2 py-2">{target.price != null ? `£${Number(target.price).toFixed(1)}m` : "—"}</td>
                    <td className="px-2 py-2">{target.points_per_game != null ? Number(target.points_per_game).toFixed(1) : "—"}</td>
                    <td className="px-2 py-2">{target.form || "—"}</td>
                    <td className="px-2 py-2 text-right">
                      <Button type="button" size="sm" variant="ghost" disabled={targetsLoading} onClick={() => removeTarget(target.id)}>
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Profile Media</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <p className="text-sm font-medium">Club Crest</p>
            {media.club_crest_url ? (
              <img src={media.club_crest_url} alt="Club crest" className="h-20 w-20 rounded-md object-cover border" />
            ) : (
              <div className="h-20 w-20 rounded-md border bg-muted" />
            )}
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => handleUploadMedia(e, "club_crest")}
              disabled={uploading === "club_crest"}
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Club Logo</p>
            {media.club_logo_url ? (
              <img src={media.club_logo_url} alt="Club logo" className="h-20 w-20 rounded-md object-cover border" />
            ) : (
              <div className="h-20 w-20 rounded-md border bg-muted" />
            )}
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => handleUploadMedia(e, "club_logo")}
              disabled={uploading === "club_logo"}
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Manager Photo</p>
            {media.manager_profile_picture_url ? (
              <img src={media.manager_profile_picture_url} alt="Manager profile" className="h-20 w-20 rounded-md object-cover border" />
            ) : (
              <div className="h-20 w-20 rounded-md border bg-muted" />
            )}
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => handleUploadMedia(e, "manager_profile_picture")}
              disabled={uploading === "manager_profile_picture"}
            />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Change Password</h2>
        <form className="space-y-4 max-w-md" onSubmit={handleChangePassword}>
          <div>
            <Label htmlFor="current-password">Current Password</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1"
              required
            />
          </div>
          <div>
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1"
              required
            />
          </div>
          <div>
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1"
              required
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && <p className="text-sm text-emerald-600">{success}</p>}

          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Update Password"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
