/**
 * Player image lookup utility.
 * Uses official Premier League bootstrap data and avoids third-party scraping.
 */

interface ImageCache {
  [playerName: string]: string | null;
}

const imageCache: ImageCache = {};
let officialPhotoByPlayerId: Record<number, string> | null = null;
let officialPhotoByName: Record<string, string> | null = null;

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
  if (/^https?:\/\//i.test(raw)) return raw.replace(/^http:\/\//i, "https://");
  const fallbackCode = String(codeValue || "").trim();
  const code = (raw || fallbackCode)
    .replace(/^https?:\/\/[^/]+\/.*\/p/i, "")
    .replace(/\.(jpg|jpeg|png|webp)$/i, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .trim();
  if (!code) return null;
  return `https://resources.premierleague.com/premierleague/photos/players/250x250/p${code}.png`;
}

function applyBootstrapMap(payload: any, byId: Record<number, string>, byName: Record<string, string>) {
  if (!Array.isArray(payload?.elements)) return;

  payload.elements.forEach((player: any) => {
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
