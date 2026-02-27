/**
 * Player Image Fetching Utility
 * Fetches player images from the web using Bing Image Search
 */

interface ImageSearchResult {
  image?: {
    contentUrl: string;
  };
  contentUrl?: string;
}

interface ImageCache {
  [playerName: string]: string | null;
}

const imageCache: ImageCache = {};
let officialPhotoByPlayerId: Record<number, string> | null = null;

async function loadOfficialPhotoMap() {
  if (officialPhotoByPlayerId) return officialPhotoByPlayerId;
  try {
    const res = await fetch("https://fantasy.premierleague.com/api/bootstrap-static/");
    if (!res.ok) throw new Error("Failed bootstrap");
    const payload = await res.json();
    const map: Record<number, string> = {};
    (payload?.elements || []).forEach((p: any) => {
      const id = Number(p?.id);
      const photo = String(p?.photo || "");
      const code = photo.replace(".jpg", "").trim();
      if (!id || !code) return;
      map[id] = `https://resources.premierleague.com/premierleague/photos/players/250x250/p${code}.png`;
    });
    officialPhotoByPlayerId = map;
    return map;
  } catch {
    officialPhotoByPlayerId = {};
    return officialPhotoByPlayerId;
  }
}

/**
 * Fetch a player image by searching the web
 * Returns a suitable image URL or null if not found
 */
export async function fetchPlayerImage(playerName: string): Promise<string | null> {
  // Check cache first
  if (playerName in imageCache) {
    return imageCache[playerName];
  }

  try {
    // Use Bing Image Search API (free tier available)
    const searchQuery = `${playerName} football player headshot`;
    const response = await fetch(
      `https://api.bing.microsoft.com/v7.0/images/search?q=${encodeURIComponent(searchQuery)}&count=1&mkt=en-US`,
      {
        headers: {
          "Ocp-Apim-Subscription-Key": process.env.REACT_APP_BING_IMAGE_SEARCH_KEY || "",
        },
      }
    );

    if (!response.ok) {
      // Fallback: Try a simpler approach with DuckDuckGo (no API key needed)
      return await fetchPlayerImageFromDuckDuckGo(playerName);
    }

    const data = await response.json();
    const imageUrl = data?.value?.[0]?.contentUrl;

    if (imageUrl) {
      imageCache[playerName] = imageUrl;
      return imageUrl;
    }

    // If Bing fails, try DuckDuckGo
    return await fetchPlayerImageFromDuckDuckGo(playerName);
  } catch (error) {
    console.error(`Failed to fetch image for ${playerName}:`, error);
    imageCache[playerName] = null;
    return null;
  }
}

/**
 * Fallback image search using DuckDuckGo's image proxy
 * More reliable and doesn't require API key
 */
async function fetchPlayerImageFromDuckDuckGo(playerName: string): Promise<string | null> {
  try {
    const searchQuery = `${playerName} football player`;
    // Using a public image search endpoint that works without authentication
    const proxyUrl = `https://duckduckgo.com/i.js?q=${encodeURIComponent(searchQuery)}&v=7`;

    const response = await fetch(proxyUrl);
    if (!response.ok) {
      imageCache[playerName] = null;
      return null;
    }

    const data = await response.json();
    const imageUrl = data?.results?.[0]?.image;

    if (imageUrl) {
      imageCache[playerName] = imageUrl;
      return imageUrl;
    }

    // Last resort: construct a generic image URL
    // This won't work but prevents errors
    imageCache[playerName] = null;
    return null;
  } catch (error) {
    console.error(`DuckDuckGo search failed for ${playerName}:`, error);
    imageCache[playerName] = null;
    return null;
  }
}

/**
 * Get cached player image or fetch if not cached
 */
export async function getPlayerImage(playerName: string): Promise<string | null> {
  if (playerName in imageCache) {
    return imageCache[playerName];
  }
  return fetchPlayerImage(playerName);
}

export async function getPlayerImageByIdOrName(playerId: number, playerName: string): Promise<string | null> {
  try {
    const map = await loadOfficialPhotoMap();
    const official = map[playerId] || null;
    if (official) return official;
  } catch {
    // Fall through to name-based lookup.
  }
  return getPlayerImage(playerName);
}

/**
 * Preload multiple player images
 */
export async function preloadPlayerImages(playerNames: string[]): Promise<void> {
  const uncachedNames = playerNames.filter((name) => !(name in imageCache));
  await Promise.all(uncachedNames.map((name) => fetchPlayerImage(name)));
}

/**
 * Clear image cache
 */
export function clearImageCache(): void {
  Object.keys(imageCache).forEach((key) => delete imageCache[key]);
}
