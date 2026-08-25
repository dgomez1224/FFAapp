/**
 * Managers Page - Cards overview
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getSupabaseFunctionHeaders, supabaseUrl } from "../lib/supabaseClient";
import { Card } from "../components/ui/card";
import { EDGE_FUNCTIONS_BASE } from "../lib/constants";
import { contrastText, extractPaletteFromImage, mix, rgbCss } from "../lib/colorPalette";
import leagueTrophy from "../assets/trophies/League Cup Icon.png";
import cupTrophy from "../assets/trophies/FFA Cup Icon + Year.png";
import gobletTrophy from "../assets/trophies/Goblet Icon.png";
import { CANONICAL_MANAGERS, getManagerDivision } from "../lib/canonicalManagers";
import { DivisionBadge } from "../components/DivisionBadge";
import { getDivisionLabel, type Division } from "../lib/divisions";

interface ManagerCardData {
  manager_name: string;
  total_points: number;
  points_per_game: number | null;
  league_titles: number;
  cup_wins: number;
  goblet_wins: number;
  best_gameweek_details: string | null;
}

type ManagerMediaRow = {
  manager_name?: string | null;
  canonical_manager_name?: string | null;
  club_logo_url?: string | null;
  manager_photo_url?: string | null;
  manager_profile_picture_url?: string | null;
};

type ManagerCardTheme = {
  bg: string;
  border: string;
  chip: string;
  text: string;
  mutedText: string;
  chipText: string;
};

function normalizeManagerName(value: string | null | undefined) {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "MATTHEW") return "MATT";
  if (normalized === "SEB") return "SEBASTIAN";
  return normalized;
}

export default function ManagersPage() {
  const [managers, setManagers] = useState<ManagerCardData[]>([]);
  const [mediaByManager, setMediaByManager] = useState<Record<string, { logo: string | null; photo: string | null }>>({});
  const [themeByManager, setThemeByManager] = useState<Record<string, ManagerCardTheme>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin] = useState(() => typeof localStorage !== "undefined" && localStorage.getItem("ffa_is_admin") === "true");
  const [adminToken, setAdminToken] = useState(() => (typeof sessionStorage !== "undefined" ? sessionStorage.getItem("ffa_admin_token") || "" : ""));
  const [promotedNames, setPromotedNames] = useState("");
  const [relegatedNames, setRelegatedNames] = useState("");
  const [incrementTenure, setIncrementTenure] = useState(false);
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminMessage, setAdminMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadManagers() {
      try {
        setLoading(true);
        setError(null);

        const statsUrl = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/legacy-stats/all-time`;
        const mediaUrl = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/manager-media`;
        const [statsRes, mediaRes] = await Promise.all([
          fetch(statsUrl, { headers: getSupabaseFunctionHeaders() }),
          fetch(mediaUrl, { headers: getSupabaseFunctionHeaders() }),
        ]);
        const payload = await statsRes.json();
        const mediaPayload = await mediaRes.json();
        if (!statsRes.ok || payload?.error) {
          throw new Error(payload?.error?.message || "Failed to load all-time manager stats");
        }
        if (!mediaRes.ok || mediaPayload?.error) {
          throw new Error(mediaPayload?.error?.message || "Failed to load manager media");
        }

        const byName: Record<string, ManagerCardData> = {};
        (payload?.stats || []).forEach((row: any) => {
          const name = normalizeManagerName(row.manager_name);
          if (!name) return;
          byName[name] = {
            manager_name: name,
            total_points: row.total_points || 0,
            points_per_game: row.points_per_game ?? null,
            league_titles: row.league_titles ?? 0,
            cup_wins: row.cup_wins ?? 0,
            goblet_wins: row.goblet_wins ?? 0,
            best_gameweek_details: row.best_gameweek_details ?? null,
          };
        });
        CANONICAL_MANAGERS.forEach((name) => {
          if (!byName[name]) {
            byName[name] = {
              manager_name: name,
              total_points: 0,
              points_per_game: null,
              league_titles: 0,
              cup_wins: 0,
              goblet_wins: 0,
              best_gameweek_details: null,
            };
          }
        });

        setManagers(Object.values(byName));

        const mediaRows: ManagerMediaRow[] = Array.isArray(mediaPayload?.media) ? mediaPayload.media : [];
        const nextMediaMap: Record<string, { logo: string | null; photo: string | null }> = {};
        mediaRows.forEach((row) => {
          const manager = normalizeManagerName(row.manager_name);
          const canonical = normalizeManagerName(row.canonical_manager_name);
          const key = canonical || manager;
          if (!key) return;
          nextMediaMap[key] = {
            logo: row.club_logo_url || null,
            photo: row.manager_photo_url || row.manager_profile_picture_url || null,
          };
        });
        setMediaByManager(nextMediaMap);
      } catch (err: any) {
        setError(err.message || "Failed to load managers");
      } finally {
        setLoading(false);
      }
    }

    loadManagers();
  }, []);

  useEffect(() => {
    async function buildThemes() {
      const entries = Object.entries(mediaByManager).filter(([, media]) => !!media.logo);
      if (entries.length === 0) {
        setThemeByManager({});
        return;
      }
      const results = await Promise.all(
        entries.map(async ([manager, media]) => {
          try {
            const palette = await extractPaletteFromImage(media.logo as string);
            const primary = palette[0];
            if (!primary) return [manager, null] as const;
            const accent = palette[1] || mix(primary, { r: 255, g: 255, b: 255 }, 0.2);
            const bgColor = mix(primary, { r: 255, g: 255, b: 255 }, 0.93);
            const chipColor = mix(accent, { r: 255, g: 255, b: 255 }, 0.78);
            const borderColor = mix(primary, { r: 40, g: 40, b: 40 }, 0.58);
            const text = contrastText(bgColor);
            const mutedText = text === "rgb(10 10 10)" ? "rgb(71 85 105)" : "rgb(203 213 225)";
            const theme: ManagerCardTheme = {
              bg: rgbCss(bgColor),
              border: rgbCss(borderColor, 0.42),
              chip: rgbCss(chipColor),
              text,
              mutedText,
              chipText: contrastText(chipColor),
            };
            return [manager, theme] as const;
          } catch {
            return [manager, null] as const;
          }
        }),
      );
      const nextThemes: Record<string, ManagerCardTheme> = {};
      results.forEach(([manager, theme]) => {
        if (theme) nextThemes[manager] = theme;
      });
      setThemeByManager(nextThemes);
    }
    buildThemes();
  }, [mediaByManager]);

  const managersByDivision = useMemo(() => {
    const groups: Record<Division, ManagerCardData[]> = {
      division_one: [],
      division_two: [],
    };
    [...managers]
      .sort((a, b) => b.total_points - a.total_points)
      .forEach((manager) => {
        const division = getManagerDivision(manager.manager_name) ?? "division_one";
        groups[division].push(manager);
      });
    return groups;
  }, [managers]);

  if (loading) {
    return (
      <Card className="p-6">
        <h1 className="mb-4 text-xl font-semibold">Managers</h1>
        <p className="text-sm text-muted-foreground">Loading managers…</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <h1 className="mb-4 text-xl font-semibold">Managers</h1>
        <p className="text-sm text-destructive">{error}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Managers</h1>
        <p className="text-sm text-muted-foreground mt-2">
          League leaders and all-time highlights.
        </p>
      </div>

      {isAdmin ? (
        <Card className="space-y-3 p-4">
          <h2 className="text-lg font-semibold">Admin: season-end division stats</h2>
          <p className="text-xs text-muted-foreground">
            Tenure already includes 2026/27. At season end, enter the two promoted and two relegated managers. Check increment tenure only at the start of the next season.
          </p>
          <label className="block text-sm">
            Admin token
            <input
              type="password"
              className="mt-1 w-full rounded border px-2 py-1"
              value={adminToken}
              onChange={(e) => setAdminToken(e.target.value)}
            />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              Promoted (comma-separated)
              <input className="mt-1 w-full rounded border px-2 py-1" value={promotedNames} onChange={(e) => setPromotedNames(e.target.value)} placeholder="SEBASTIAN, KARIM" />
            </label>
            <label className="text-sm">
              Relegated (comma-separated)
              <input className="mt-1 w-full rounded border px-2 py-1" value={relegatedNames} onChange={(e) => setRelegatedNames(e.target.value)} placeholder="IAN, HENRI" />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={incrementTenure} onChange={(e) => setIncrementTenure(e.target.checked)} />
            Increment seasons in current division
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={adminSaving}
              className="rounded border px-3 py-1 text-sm disabled:opacity-50"
              onClick={async () => {
                setAdminSaving(true);
                setAdminMessage(null);
                try {
                  if (adminToken) sessionStorage.setItem("ffa_admin_token", adminToken);
                  const parseNames = (value: string) => value.split(",").map((name) => name.trim()).filter(Boolean);
                  const res = await fetch(`${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/admin/apply-season-end-division-stats`, {
                    method: "POST",
                    headers: {
                      ...getSupabaseFunctionHeaders(),
                      "Content-Type": "application/json",
                      "x-admin-token": adminToken,
                    },
                    body: JSON.stringify({
                      increment_tenure: incrementTenure,
                      promoted: parseNames(promotedNames),
                      relegated: parseNames(relegatedNames),
                      dry_run: true,
                    }),
                  });
                  const payload = await res.json();
                  if (!res.ok || payload?.error) throw new Error(payload?.error?.message || "Dry run failed");
                  setAdminMessage(`Dry run: ${payload.changes?.length || 0} manager(s) would change.`);
                } catch (err: any) {
                  setAdminMessage(err.message || "Dry run failed");
                } finally {
                  setAdminSaving(false);
                }
              }}
            >
              Preview
            </button>
            <button
              type="button"
              disabled={adminSaving}
              className="rounded bg-zinc-800 px-3 py-1 text-sm text-white disabled:opacity-50"
              onClick={async () => {
                setAdminSaving(true);
                setAdminMessage(null);
                try {
                  if (adminToken) sessionStorage.setItem("ffa_admin_token", adminToken);
                  const parseNames = (value: string) => value.split(",").map((name) => name.trim()).filter(Boolean);
                  const res = await fetch(`${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/admin/apply-season-end-division-stats`, {
                    method: "POST",
                    headers: {
                      ...getSupabaseFunctionHeaders(),
                      "Content-Type": "application/json",
                      "x-admin-token": adminToken,
                    },
                    body: JSON.stringify({
                      increment_tenure: incrementTenure,
                      promoted: parseNames(promotedNames),
                      relegated: parseNames(relegatedNames),
                      dry_run: false,
                    }),
                  });
                  const payload = await res.json();
                  if (!res.ok || payload?.error) throw new Error(payload?.error?.message || "Apply failed");
                  setAdminMessage(`Applied ${payload.changes?.length || 0} manager update(s).`);
                } catch (err: any) {
                  setAdminMessage(err.message || "Apply failed");
                } finally {
                  setAdminSaving(false);
                }
              }}
            >
              Apply
            </button>
          </div>
          {adminMessage ? <p className="text-sm text-muted-foreground">{adminMessage}</p> : null}
        </Card>
      ) : null}

      {(["division_one", "division_two"] as Division[]).map((division) => (
      <div key={division} className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">{getDivisionLabel(division)}</h2>
          <DivisionBadge division={division} />
        </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {managersByDivision[division].map((manager) => {
          const managerKey = normalizeManagerName(manager.manager_name);
          const media = mediaByManager[managerKey];
          const cardTheme = themeByManager[managerKey];
          const blurb = "Building their legacy season by season.";

          return (
            <Card
              key={manager.manager_name}
              className="p-5 flex flex-col gap-4"
              style={cardTheme ? { background: cardTheme.bg, borderColor: cardTheme.border, color: cardTheme.text } : undefined}
            >
              <div className="flex items-center gap-4">
                {media?.photo ? (
                  <img
                    src={media.photo}
                    alt={`${manager.manager_name} profile`}
                    className="h-14 w-14 rounded-full object-cover border"
                    style={cardTheme ? { borderColor: cardTheme.border } : undefined}
                  />
                ) : (
                  <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center text-sm font-semibold">
                    {manager.manager_name.slice(0, 2)}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-semibold">{manager.manager_name}</h2>
                    {getManagerDivision(manager.manager_name) ? (
                      <DivisionBadge division={getManagerDivision(manager.manager_name)!} />
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground" style={cardTheme ? { color: cardTheme.mutedText } : undefined}>
                    All-time points: {manager.total_points}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1 text-sm text-muted-foreground" style={cardTheme ? { color: cardTheme.mutedText } : undefined}>
                {manager.league_titles > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted/70 px-2 py-0.5 text-[11px]">
                    <img
                      src={leagueTrophy}
                      alt="League trophy"
                      className="h-4 w-3 object-contain"
                    />
                    <span>{manager.league_titles}x</span>
                  </span>
                )}
                {manager.cup_wins > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted/70 px-2 py-0.5 text-[11px]">
                    <img
                      src={cupTrophy}
                      alt="FFA Cup trophy"
                      className="h-4 w-3 object-contain"
                    />
                    <span>{manager.cup_wins}x</span>
                  </span>
                )}
                {manager.goblet_wins > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted/70 px-2 py-0.5 text-[11px]">
                    <img
                      src={gobletTrophy}
                      alt="Goblet trophy"
                      className="h-4 w-3 object-contain"
                    />
                    <span>{manager.goblet_wins}x</span>
                  </span>
                )}
                {manager.league_titles + manager.cup_wins + manager.goblet_wins === 0 && (
                  <span>{blurb}</span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-md bg-muted/60 p-2 text-center" style={cardTheme ? { backgroundColor: cardTheme.chip } : undefined}>
                  <div className="text-xs text-muted-foreground" style={cardTheme ? { color: cardTheme.mutedText } : undefined}>PPG</div>
                  <div className="font-semibold" style={cardTheme ? { color: cardTheme.chipText } : undefined}>
                    {manager.points_per_game ? manager.points_per_game.toFixed(2) : "—"}
                  </div>
                </div>
                <div className="rounded-md bg-muted/60 p-2 text-center" style={cardTheme ? { backgroundColor: cardTheme.chip } : undefined}>
                  <div className="text-xs text-muted-foreground" style={cardTheme ? { color: cardTheme.mutedText } : undefined}>Best GW</div>
                  <div className="font-semibold text-[11px] leading-tight" style={cardTheme ? { color: cardTheme.chipText } : undefined}>
                    {manager.best_gameweek_details ?? "—"}
                  </div>
                </div>
                <div className="rounded-md bg-muted/60 p-2 text-center" style={cardTheme ? { backgroundColor: cardTheme.chip } : undefined}>
                  <div className="text-xs text-muted-foreground" style={cardTheme ? { color: cardTheme.mutedText } : undefined}>Trophies</div>
                  <div className="font-semibold" style={cardTheme ? { color: cardTheme.chipText } : undefined}>
                    {manager.league_titles + manager.cup_wins + manager.goblet_wins}
                  </div>
                </div>
              </div>

              <Link
                to={`/manager/${manager.manager_name.toLowerCase()}`}
                className="text-sm font-medium hover:underline"
                style={cardTheme ? { color: cardTheme.text } : undefined}
              >
                View profile →
              </Link>
            </Card>
          );
        })}
      </div>
      </div>
      ))}
    </div>
  );
}
