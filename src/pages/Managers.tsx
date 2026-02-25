/**
 * Managers Page - Cards overview
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getSupabaseFunctionHeaders, supabaseUrl } from "../lib/supabaseClient";
import { Card } from "../components/ui/card";
import { EDGE_FUNCTIONS_BASE } from "../lib/constants";
import { contrastText, extractPaletteFromImage, mix, rgbCss } from "../lib/colorPalette";

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
  return normalized;
}

export default function ManagersPage() {
  const [managers, setManagers] = useState<ManagerCardData[]>([]);
  const [mediaByManager, setMediaByManager] = useState<Record<string, { logo: string | null; photo: string | null }>>({});
  const [themeByManager, setThemeByManager] = useState<Record<string, ManagerCardTheme>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

        const merged = (payload?.stats || []).map((row: any) => ({
          manager_name: row.manager_name,
          total_points: row.total_points || 0,
          points_per_game: row.points_per_game ?? null,
          league_titles: row.league_titles ?? 0,
          cup_wins: row.cup_wins ?? 0,
          goblet_wins: row.goblet_wins ?? 0,
          best_gameweek_details: row.best_gameweek_details ?? null,
        }));

        setManagers(merged);

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

  const sortedManagers = useMemo(
    () => [...managers].sort((a, b) => b.total_points - a.total_points),
    [managers]
  );

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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sortedManagers.map((manager) => {
          const managerKey = normalizeManagerName(manager.manager_name);
          const media = mediaByManager[managerKey];
          const cardTheme = themeByManager[managerKey];
          const blurb = [
            manager.league_titles ? `${manager.league_titles}x league titles` : null,
            manager.cup_wins ? `${manager.cup_wins}x cup wins` : null,
            manager.goblet_wins ? `${manager.goblet_wins}x goblet wins` : null,
          ]
            .filter(Boolean)
            .join(" • ") || "Building their legacy season by season.";

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
                  <h2 className="text-lg font-semibold">{manager.manager_name}</h2>
                  <p className="text-xs text-muted-foreground" style={cardTheme ? { color: cardTheme.mutedText } : undefined}>
                    All-time points: {manager.total_points}
                  </p>
                </div>
              </div>

              <div className="text-sm text-muted-foreground" style={cardTheme ? { color: cardTheme.mutedText } : undefined}>
                {blurb}
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
  );
}
