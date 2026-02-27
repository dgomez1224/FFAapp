/**
 * Player image lookup utility.
 * Uses official Premier League bootstrap data and avoids third-party scraping.
 */

import { EDGE_FUNCTIONS_BASE } from "./constants";
import { getSupabaseFunctionHeaders, supabaseUrl } from "./supabaseClient";

interface ImageCache {
  [playerName: string]: string | null;
}

const imageCache: ImageCache = {};
let officialPhotoByPlayerId: Record<number, string> | null = null;
let officialPhotoByName: Record<string, string> | null = null;
let fullInsightsPhotoByName: Record<string, string> | null = null;
let fullInsightsLoaded = false;

function normalizeName(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildOfficialPhotoUrl(photoValue: unknown, codeValue?: unknown) {
  const raw = String(photoValue || "").trim();
  if (/^https?:\/\//i.test(raw)) {
    const httpsUrl = raw.replace(/^http:\/\//i, "https://");
    if (/resources\.premierleague\.com/i.test(httpsUrl)) {
      const fromUrlCode = (() => {
        try {
          const parsed = new URL(httpsUrl);
          const file = (parsed.pathname.split("/").pop() || "").trim();
          const match = file.match(/^p?([a-zA-Z0-9]+)\.(jpg|jpeg|png|webp)$/i);
          return match?.[1] || "";
        } catch {
          return "";
        }
      })();
      if (fromUrlCode) {
        return `https://fantasy.premierleague.com/dist/img/photos/110x140/p${fromUrlCode}.png`;
      }
    }
    return httpsUrl;
  }
  const fallbackCode = String(codeValue || "").trim();
  const code = (raw || fallbackCode)
    .replace(/^https?:\/\/[^/]+\/.*\/p?/i, "")
    .replace(/\.(jpg|jpeg|png|webp)$/i, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .replace(/^p/i, "")
    .trim();
  if (!code) return null;
  return `https://fantasy.premierleague.com/dist/img/photos/110x140/p${code}.png`;
}

function normalizeList<T = any>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") return Object.values(value as Record<string, T>);
  return [];
}

function applyBootstrapMap(payload: any, byId: Record<number, string>, byName: Record<string, string>) {
  const players = normalizeList<any>(payload?.elements?.data ?? payload?.elements ?? payload?.players);
  if (players.length === 0) return;

  players.forEach((player: any) => {
    const id = Number(player?.id);
    const imageUrl = buildOfficialPhotoUrl(player?.photo || player?.image_url || player?.photo_url, player?.code);
    if (!id || !imageUrl) return;

    byId[id] = imageUrl;

    const names = [
      player?.web_name,
      `${player?.first_name || ""} ${player?.second_name || ""}`.trim(),
      player?.second_name,
    ]
      .map((name) => normalizeName(String(name || "")))
      .filter(Boolean);

    names.forEach((name) => {
      if (!byName[name]) byName[name] = imageUrl;
    });
  });
}

async function loadFullInsightsPhotoMap() {
  if (fullInsightsLoaded) return fullInsightsPhotoByName || {};
  fullInsightsLoaded = true;
  const byName: Record<string, string> = {};

  try {
    if (!supabaseUrl) {
      fullInsightsPhotoByName = byName;
      return byName;
    }
    const res = await fetch(`${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/player-insights`, {
      headers: getSupabaseFunctionHeaders(),
    });
    if (!res.ok) {
      fullInsightsPhotoByName = byName;
      return byName;
    }
    const payload = await res.json();
    const insights = Array.isArray(payload?.insights) ? payload.insights : [];
    insights.forEach((row: any) => {
      const key = normalizeName(row?.player_name);
      const image = buildOfficialPhotoUrl(row?.image_url || row?.photo || row?.photo_url, row?.code);
      if (key && image && !byName[key]) byName[key] = image;
    });
  } catch {
    // Non-fatal fallback path.
  }

  fullInsightsPhotoByName = byName;
  return byName;
}

async function loadOfficialPhotoMap() {
  if (officialPhotoByPlayerId && officialPhotoByName) return officialPhotoByPlayerId;

  const byId: Record<number, string> = {};
  const byName: Record<string, string> = {};

  try {
    const draftRes = await fetch("https://draft.premierleague.com/api/bootstrap-static");
    if (draftRes.ok) {
      const draftPayload = await draftRes.json();
      applyBootstrapMap(draftPayload, byId, byName);
    }
  } catch {
    // Continue with classic source.
  }

  try {
    const classicRes = await fetch("https://fantasy.premierleague.com/api/bootstrap-static/");
    if (classicRes.ok) {
      const classicPayload = await classicRes.json();
      applyBootstrapMap(classicPayload, byId, byName);
    }
  } catch {
    // Use any map entries already loaded.
  }

  officialPhotoByPlayerId = byId;
  officialPhotoByName = byName;
  return officialPhotoByPlayerId;
}

export async function fetchPlayerImage(playerName: string): Promise<string | null> {
  if (playerName in imageCache) {
    return imageCache[playerName];
  }

  try {
    await loadOfficialPhotoMap();
    const lookupKey = normalizeName(playerName);
    let official = officialPhotoByName?.[lookupKey] || null;
    if (!official) {
      const surname = lookupKey.split(" ").filter(Boolean).pop() || "";
      if (surname) {
        const fuzzyMatch = Object.entries(officialPhotoByName || {}).find(([name]) => {
          const parts = name.split(" ").filter(Boolean);
          return parts[parts.length - 1] === surname;
        });
        official = fuzzyMatch?.[1] || null;
      }
    }

    if (!official) {
      const insightsMap = await loadFullInsightsPhotoMap();
      official = insightsMap[lookupKey] || null;
      if (!official) {
        const surname = lookupKey.split(" ").filter(Boolean).pop() || "";
        if (surname) {
          const fuzzyMatch = Object.entries(insightsMap).find(([name]) => {
            const parts = name.split(" ").filter(Boolean);
            return parts[parts.length - 1] === surname;
          });
          official = fuzzyMatch?.[1] || null;
        }
      }
    }

    imageCache[playerName] = official;
    return official;
  } catch {
    imageCache[playerName] = null;
    return null;
  }
}

export async function getPlayerImage(playerName: string): Promise<string | null> {
  if (playerName in imageCache) {
    return imageCache[playerName];
  }
  return fetchPlayerImage(playerName);
}

export async function getPlayerImageByIdOrName(playerId: number, playerName: string): Promise<string | null> {
  try {
    const map = await loadOfficialPhotoMap();
    const officialById = map[playerId] || null;
    if (officialById) return officialById;
  } catch {
    // Fall through to name lookup.
  }
  return getPlayerImage(playerName);
}

export async function preloadPlayerImages(playerNames: string[]): Promise<void> {
  const uncachedNames = playerNames.filter((name) => !(name in imageCache));
  await Promise.all(uncachedNames.map((name) => fetchPlayerImage(name)));
}

export function clearImageCache(): void {
  Object.keys(imageCache).forEach((key) => delete imageCache[key]);
}
