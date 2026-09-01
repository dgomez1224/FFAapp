import { Hono } from "npm:hono";

export const newsFeed = new Hono();

type NewsCategory = "draft" | "epl";

type NewsItem = {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  category: NewsCategory;
  publishedAt: string | null;
};

const FEEDS: Array<{ url: string; source: string; category: NewsCategory }> = [
  { url: "https://feeds.bbci.co.uk/sport/football/premier-league/rss.xml", source: "BBC Sport", category: "epl" },
  { url: "https://www.theguardian.com/football/premierleague/rss", source: "The Guardian", category: "epl" },
  { url: "https://www.skysports.com/rss/12040", source: "Sky Sports", category: "epl" },
  { url: "https://www.premierleague.com/rss/news", source: "Premier League", category: "epl" },
  { url: "https://www.fantasyfootballscout.co.uk/feed/", source: "Fantasy Football Scout", category: "draft" },
  { url: "https://www.fantasyfootballfix.com/blog/feed/", source: "Fantasy Football Fix", category: "draft" },
];

function decode(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block: string, name: string): string {
  const match = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return match ? decode(match[1]) : "";
}

function attr(block: string, name: string, attribute: string): string {
  const match = block.match(new RegExp(`<${name}[^>]*${attribute}="([^"]+)"`, "i"));
  return match ? decode(match[1]) : "";
}

async function fetchFeed(feed: (typeof FEEDS)[number]): Promise<NewsItem[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(feed.url, {
      signal: controller.signal,
      headers: { Accept: "application/rss+xml, application/xml, text/xml", "User-Agent": "FFA-Cup-News/1.0" },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const blocks = Array.from(xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)).slice(0, 8);
    return blocks
      .map((match, index) => {
        const block = match[0];
        const title = tag(block, "title");
        const url = tag(block, "link") || attr(block, "link", "href");
        if (!title) return null;
        const publishedAt = tag(block, "pubDate") || tag(block, "published") || tag(block, "updated") || null;
        return {
          id: `${feed.source}-${index}-${url || title}`,
          title,
          summary: tag(block, "description") || tag(block, "summary"),
          url: url || feed.url,
          source: feed.source,
          category: feed.category,
          publishedAt,
        } satisfies NewsItem;
      })
      .filter((item): item is NewsItem => !!item);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

newsFeed.get("/", async (c) => {
  const settled = await Promise.allSettled(FEEDS.map(fetchFeed));
  const items = settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
  items.sort((a, b) => Date.parse(b.publishedAt || "") - Date.parse(a.publishedAt || ""));
  return c.json({
    items: items.slice(0, 40),
    generated_at: new Date().toISOString(),
    sources: FEEDS.map((feed) => feed.source),
  });
});
