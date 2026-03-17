/**
 * Player image resolver.
 *
 * Strategy:
 * 1) Build a unified player index from Draft + Classic bootstrap APIs.
 * 2) Resolve by player id first, then exact normalized name, then surname fallback.
 * 3) Try multiple known image URL patterns and return the first loadable one.
 * 4) Cache successful and failed lookups to avoid repeated network work.
 */
import { supabaseUrl, getSupabaseFunctionHeaders } from "./supabaseClient";
import { EDGE_FUNCTIONS_BASE } from "./constants";
interface ImageCache {
  [playerName: string]: string | null;
}

interface IndexedPlayer {
  id: number;
  names: string[];
  codes: string[];
  directUrls: string[];
}

const imageCache: ImageCache = {};
const idCache: Record<number, string | null> = {};
const existsCache = new Map<string, boolean>();

let indexReady = false;
let indexById: Record<number, IndexedPlayer> = {};
let idsByName: Record<string, number[]> = {};

function normalizeName(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCode(value: unknown) {
  return String(value || "")
    .trim()
    .replace(/^p/i, "")
    .replace(/\.(jpg|jpeg|png|webp)$/i, "")
    .replace(/[^a-zA-Z0-9]/g, "");
}

function normalizeList<T = any>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") return Object.values(value as Record<string, T>);
  return [];
}

function extractCodeFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    const filename = parsed.pathname.split("/").pop() || "";
    const match = filename.match(/^p?([a-zA-Z0-9]+)\.(jpg|jpeg|png|webp)$/i);
    return match?.[1] ? normalizeCode(match[1]) : "";
  } catch {
    return "";
  }
}

function buildUrlCandidates(code: string, directUrls: string[]) {
  const out = new Set<string>();

  if (code) {
    // Primary canonical source – Premier League player photos
    out.add(`https://resources.premierleague.com/premierleague/photos/players/110x140/p${code}.png`);
    out.add(`https://resources.premierleague.com/premierleague/photos/players/250x250/p${code}.png`);

    // Legacy FPL CDN variants as additional fallbacks
    out.add(`https://fantasy.premierleague.com/dist/img/photos/110x140/p${code}.png`);
    out.add(`https://fantasy.premierleague.com/dist/img/photos/250x250/p${code}.png`);
  }

  // Any explicit URLs from upstream data come after our canonical patterns
  directUrls
    .map((u) => String(u || "").trim().replace(/^http:\/\//i, "https://"))
    .filter(Boolean)
    .forEach((u) => out.add(u));

  return Array.from(out);
}

function indexPlayer(raw: any) {
  const id = Number(raw?.id ?? raw?.element ?? raw?.element_id);
  if (!Number.isInteger(id) || id <= 0) return;

  const existing: IndexedPlayer = indexById[id] || {
    id,
    names: [],
    codes: [],
    directUrls: [],
  };

  const firstName = String(raw?.first_name || "").trim();
  const secondName = String(raw?.second_name || "").trim();
  const fullName = `${firstName} ${secondName}`.trim();

  const names = [
    raw?.web_name,
    raw?.name,
    fullName,
    secondName,
  ]
    .map((v) => normalizeName(String(v || "")))
    .filter(Boolean);

  const directUrlCandidates = [
    raw?.image_url,
    raw?.photo_url,
    raw?.headshot,
    raw?.photo,
  ]
    .map((v) => String(v || "").trim())
    .filter((v) => /^https?:\/\//i.test(v));

  const codeCandidates = [
    raw?.code,
    raw?.photo,
    ...directUrlCandidates.map(extractCodeFromUrl),
  ]
    .map((v) => normalizeCode(v))
    .filter(Boolean);

  const next: IndexedPlayer = {
    id,
    names: Array.from(new Set([...existing.names, ...names])),
    codes: Array.from(new Set([...existing.codes, ...codeCandidates])),
    directUrls: Array.from(new Set([...existing.directUrls, ...directUrlCandidates])),
  };

  indexById[id] = next;
}

async function loadIndex() {
  if (indexReady) return;
  indexById = {};
  idsByName = {};
  try {
    const res = await fetch(
      `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/bootstrap-static`,
      { headers: getSupabaseFunctionHeaders() }
    );
    if (res.ok) {
      const payload = await res.json();
      const players = normalizeList<any>(
        payload?.elements?.data ?? payload?.elements ?? payload?.players
      );
      players.forEach(indexPlayer);
    }
  } catch {
    // Non-fatal
  }
  Object.values(indexById).forEach((player) => {
    player.names.forEach((name) => {
      if (!idsByName[name]) idsByName[name] = [];
      if (!idsByName[name].includes(player.id)) idsByName[name].push(player.id);
    });
  });
  indexReady = true;
}

function imageLoads(url: string, timeoutMs = 4500) {
  return new Promise<boolean>((resolve) => {
    const img = new Image();
    const timeout = window.setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeoutMs);

    const cleanup = () => {
      window.clearTimeout(timeout);
      img.onload = null;
      img.onerror = null;
    };

    img.onload = () => {
      cleanup();
      resolve(true);
    };
    img.onerror = () => {
      cleanup();
      resolve(false);
    };

    img.src = url;
  });
}

async function resolveById(playerId: number): Promise<string | null> {
  if (!Number.isInteger(playerId) || playerId <= 0) return null;
  if (Object.prototype.hasOwnProperty.call(idCache, playerId)) return idCache[playerId];

  await loadIndex();

  const player = indexById[playerId];
  if (!player) {
    idCache[playerId] = null;
    return null;
  }

  const code = player.codes[0] || "";
  const candidates = buildUrlCandidates(code, player.directUrls);
  for (const url of candidates) {
    if (await imageLoads(url)) {
      idCache[playerId] = url;
      return url;
    }
  }

  idCache[playerId] = null;
  return null;
}

async function resolveByName(playerName: string): Promise<string | null> {
  const normalized = normalizeName(playerName);
  if (!normalized) return null;

  await loadIndex();

  const candidateIds: number[] = [];

  const exact = idsByName[normalized] || [];
  exact.forEach((id) => {
    if (!candidateIds.includes(id)) candidateIds.push(id);
  });

  if (candidateIds.length === 0) {
    const surname = normalized.split(" ").filter(Boolean).pop() || "";
    if (surname) {
      Object.entries(idsByName).forEach(([name, ids]) => {
        const parts = name.split(" ").filter(Boolean);
        if (parts[parts.length - 1] !== surname) return;
        ids.forEach((id) => {
          if (!candidateIds.includes(id)) candidateIds.push(id);
        });
      });
    }
  }

  for (const id of candidateIds) {
    const resolved = await resolveById(id);
    if (resolved) return resolved;
  }

  return null;
}

export async function fetchPlayerImage(playerName: string): Promise<string | null> {
  if (playerName in imageCache) {
    return imageCache[playerName];
  }

  try {
    // Try to resolve via FPL/PL bootstrap index first (Premier League images)
    const resolved = await resolveByName(playerName);
    if (resolved) {
      imageCache[playerName] = resolved;
      return resolved;
    }

    // Fallback to Wikipedia thumbnail only if no Premier League-style image is available
    const wiki = await getWikipediaImage(playerName);
    imageCache[playerName] = wiki;
    return wiki;
  } catch {
    imageCache[playerName] = null;
    return null;
  }
}

async function getWikipediaImage(playerName: string): Promise<string | null> {
  const cacheKey = `wiki:${playerName}`;
  if (cacheKey in imageCache) {
    return imageCache[cacheKey];
  }

  // Build name variants to try: full name, first+last only, last name only
  const parts = playerName.trim().split(/\s+/);
  const variants = [
    playerName,                                    // "Marcos Senesi Barón"
    parts.length > 2 ? `${parts[0]} ${parts[1]}` : null,  // "Marcos Senesi"
    parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : null, // "Marcos Barón"
    parts.length > 1 ? parts[parts.length - 1] : null,  // last name only as last resort
  ].filter((v): v is string => !!v && v !== playerName || v === playerName);

  // Deduplicate
  const uniqueVariants = [...new Set(variants)];

  for (const name of uniqueVariants) {
    try {
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      const image = data?.thumbnail?.source ?? null;
      if (image) {
        imageCache[cacheKey] = image;
        return image;
      }
    } catch {
      continue;
    }
  }

  imageCache[cacheKey] = null;
  return null;
}

async function imageExists(url: string): Promise<boolean> {
  if (existsCache.has(url)) return existsCache.get(url)!;
  try {
    const res = await fetch(url, { method: "HEAD" });
    existsCache.set(url, res.ok);
    return res.ok;
  } catch {
    existsCache.set(url, false);
    return false;
  }
}

export async function getPlayerImage(playerName: string): Promise<string | null> {
  return getWikipediaImage(playerName);
}

export async function getPlayerImageByIdOrName(
  playerId: number,
  playerName: string,
  knownUrl?: string | null,
): Promise<string | null> {
  // Return cached result immediately
  if (Object.prototype.hasOwnProperty.call(idCache, playerId)) {
    return idCache[playerId];
  }

  // Step 1: Prefer canonical Premier League image built from bootstrap `elements.code`
  await loadIndex();
  const indexed = indexById[playerId];
  const primaryCode = indexed?.codes?.[0] || "";

  if (primaryCode) {
    const premierLeagueUrl = `https://resources.premierleague.com/premierleague/photos/players/110x140/p${primaryCode}.png`;
    // Use Premier League image URL directly; let <img> onError handle any failures.
    idCache[playerId] = premierLeagueUrl;
    return premierLeagueUrl;
  }

  // Step 2: Fall back to any known CDN URL we already have for the player
  if (knownUrl) {
    const proxied = getProxiedImageUrl(knownUrl);
    if (proxied) {
      idCache[playerId] = proxied;
      return proxied;
    }
  }

  // Step 3: Last resort – Wikipedia thumbnail
  const wikiImage = await getWikipediaImage(playerName);
  if (wikiImage) {
    idCache[playerId] = wikiImage;
    return wikiImage;
  }

  // Step 4: Nothing found — caller shows initials
  idCache[playerId] = null;
  return null;
}

export function getProxiedImageUrl(originalUrl: string | null | undefined): string | null {
  if (!originalUrl) return null;
  const cleaned = String(originalUrl).replace(/^http:\/\//i, "https://");
  // Avoid proxying to prevent CORB/CORS issues; return direct URL.
  return cleaned;
}

export async function preloadPlayerImages(playerNames: string[]): Promise<void> {
  const uncachedNames = playerNames.filter((name) => !(name in imageCache));
  await Promise.all(uncachedNames.map((name) => fetchPlayerImage(name)));
}

export function clearImageCache(): void {
  Object.keys(imageCache).forEach((key) => delete imageCache[key]);
  Object.keys(idCache).forEach((key) => delete idCache[Number(key)]);
  indexReady = false;
  indexById = {};
  idsByName = {};
}
