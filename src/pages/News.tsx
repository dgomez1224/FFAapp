/**
 * News — league headlines plus draft / EPL coverage in a top carousel.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "../components/ui/carousel";
import { EDGE_FUNCTIONS_BASE } from "../lib/constants";
import { getSupabaseFunctionHeaders, supabaseUrl } from "../lib/supabaseClient";
import { getDivisionLabel, type Division } from "../lib/divisions";

export type NewsCategory = "league" | "draft" | "epl";

export type NewsItem = {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  category: NewsCategory;
  publishedAt: string | null;
};

type ViewFilter = "all" | NewsCategory;

const FILTERS: Array<{ id: ViewFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "league", label: "League" },
  { id: "draft", label: "Draft" },
  { id: "epl", label: "Premier League" },
];

function categoryChip(category: NewsCategory) {
  if (category === "league") return "bg-violet-500/15 text-violet-800";
  if (category === "draft") return "bg-amber-500/15 text-amber-800";
  return "bg-sky-500/15 text-sky-800";
}

function formatWhen(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function NewsCard({ item, featured = false }: { item: NewsItem; featured?: boolean }) {
  const inner = (
    <>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${categoryChip(item.category)}`}>
          {item.category === "epl" ? "EPL" : item.category}
        </span>
        <span className="text-[11px] text-muted-foreground">{item.source}</span>
        {item.publishedAt ? (
          <span className="text-[11px] text-muted-foreground">{formatWhen(item.publishedAt)}</span>
        ) : null}
      </div>
      <h3 className={`font-semibold leading-snug ${featured ? "text-lg" : "text-base"}`}>{item.title}</h3>
      {item.summary ? (
        <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{item.summary}</p>
      ) : null}
    </>
  );

  const className = `block h-full rounded-xl border bg-card p-4 text-left transition-colors hover:bg-accent/40 ${
    featured ? "min-h-[180px]" : ""
  }`;

  if (item.url.startsWith("/")) {
    return (
      <Link to={item.url} className={className}>
        {inner}
      </Link>
    );
  }

  return (
    <a href={item.url} target="_blank" rel="noopener noreferrer" className={className}>
      {inner}
    </a>
  );
}

const PUBLIC_FEEDS: Array<{ url: string; source: string; category: NewsCategory }> = [
  { url: "https://feeds.bbci.co.uk/sport/football/premier-league/rss.xml", source: "BBC Sport", category: "epl" },
  { url: "https://www.theguardian.com/football/premierleague/rss", source: "The Guardian", category: "epl" },
  { url: "https://www.skysports.com/rss/12040", source: "Sky Sports", category: "epl" },
  { url: "https://www.fantasyfootballscout.co.uk/feed/", source: "Fantasy Football Scout", category: "draft" },
];

async function loadExternalNewsFallback(): Promise<NewsItem[]> {
  const settled = await Promise.allSettled(
    PUBLIC_FEEDS.map(async (feed) => {
      const proxy = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}`;
      const res = await fetch(proxy);
      const payload = await res.json();
      const entries = Array.isArray(payload?.items) ? payload.items : [];
      return entries.slice(0, 6).map((entry: any, index: number) => ({
        id: `${feed.source}-${index}-${entry?.link || entry?.title || index}`,
        title: String(entry?.title || "").trim(),
        summary: String(entry?.description || "")
          .replace(/<[^>]+>/g, " ")
          .replace(/The post[\s\S]*$/i, "")
          .replace(/\s+/g, " ")
          .trim(),
        url: String(entry?.link || feed.url),
        source: feed.source,
        category: feed.category,
        publishedAt: entry?.pubDate || null,
      })) as NewsItem[];
    }),
  );
  return settled.flatMap((result) => (result.status === "fulfilled" ? result.value : [])).filter((item) => item.title);
}

async function loadExternalNews(): Promise<NewsItem[]> {
  try {
    const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/news`;
    const res = await fetch(url, { headers: getSupabaseFunctionHeaders() });
    const payload = await res.json();
    if (res.ok && Array.isArray(payload?.items) && payload.items.length) {
      return payload.items;
    }
  } catch {
    // fall through to public RSS proxy
  }
  return loadExternalNewsFallback();
}

async function loadLeagueNews(): Promise<NewsItem[]> {
  const items: NewsItem[] = [];
  const now = new Date().toISOString();

  try {
    const [d1, d2] = await Promise.all(
      (["division_one", "division_two"] as Division[]).map(async (division) => {
        const res = await fetch(
          `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/h2h-standings?division=${division}`,
          { headers: getSupabaseFunctionHeaders() },
        );
        const payload = await res.json();
        return { division, standings: Array.isArray(payload?.standings) ? payload.standings : [] };
      }),
    );
    [d1, d2].forEach(({ division, standings }) => {
      const leader = standings[0];
      if (!leader?.manager_name) return;
      items.push({
        id: `league-leader-${division}`,
        title: `${leader.manager_name} leads ${getDivisionLabel(division)}`,
        summary: `${leader.manager_name} sits top on ${leader.points ?? 0} league points (${leader.points_for ?? 0} points scored).`,
        url: "/league-standings",
        source: "League of Lads",
        category: "league",
        publishedAt: now,
      });
    });
  } catch {
    // keep other league items
  }

  try {
    const res = await fetch(
      `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/league-activity/waivers`,
      { headers: getSupabaseFunctionHeaders() },
    );
    const payload = await res.json();
    const moves = Array.isArray(payload?.moves) ? payload.moves : [];
    const gw = payload?.gameweek;
    if (moves.length) {
      const sample = moves
        .slice(0, 3)
        .map((m: any) => `${m.manager_name} ${m.transaction_type === "Waiver" ? "waived in" : "picked up"} ${m.player_in_name || "a player"}`)
        .join("; ");
      items.push({
        id: `league-waivers-${gw || "current"}`,
        title: `This week's waivers${gw ? ` · GW ${gw}` : ""}`,
        summary: `${moves.length} moves posted. ${sample}.`,
        url: "/dashboard",
        source: "League of Lads",
        category: "league",
        publishedAt: now,
      });
    }
  } catch {
    // optional
  }

  try {
    const res = await fetch(
      `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/league-activity/previous-week-results`,
      { headers: getSupabaseFunctionHeaders() },
    );
    const payload = await res.json();
    const results = Array.isArray(payload?.results) ? payload.results : Array.isArray(payload?.matchups) ? payload.matchups : [];
    if (results.length) {
      const first = results[0];
      const home = first?.team_1?.manager_name || first?.manager_1 || "Home";
      const away = first?.team_2?.manager_name || first?.manager_2 || "Away";
      items.push({
        id: `league-results-${payload?.gameweek || "prev"}`,
        title: `Last week: ${results.length} fixtures in the books`,
        summary: `Including ${home} vs ${away}. Full results are on the dashboard.`,
        url: "/dashboard",
        source: "League of Lads",
        category: "league",
        publishedAt: now,
      });
    }
  } catch {
    // optional
  }

  return items;
}

export default function NewsPage() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ViewFilter>("all");
  const [api, setApi] = useState<CarouselApi>();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [league, external] = await Promise.all([
          loadLeagueNews(),
          loadExternalNews().catch(() => [] as NewsItem[]),
        ]);
        const merged = [...league, ...external];
        const seen = new Set<string>();
        const unique = merged.filter((item) => {
          const key = item.url || item.id;
          if (seen.has(key)) return false;
          seen.add(key);
          return Boolean(item.title);
        });
        if (!cancelled) {
          setItems(unique);
          if (!unique.length) setError("No news stories are available right now.");
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Failed to load news");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!api) return;
    const id = window.setInterval(() => {
      api.scrollNext();
    }, 6500);
    return () => window.clearInterval(id);
  }, [api]);

  const visible = useMemo(
    () => (filter === "all" ? items : items.filter((item) => item.category === filter)),
    [filter, items],
  );
  const carouselItems = visible.slice(0, 12);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-bold">News</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          League headlines plus Premier League and FPL Draft coverage from BBC, Sky, the Guardian, and Fantasy Football Scout.
        </p>
      </div>

      <div className="flex flex-wrap gap-1">
        {FILTERS.map((option) => (
          <Button
            key={option.id}
            type="button"
            size="sm"
            variant={filter === option.id ? "default" : "outline"}
            onClick={() => setFilter(option.id)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Loading headlines…</p>
        </Card>
      ) : error && !visible.length ? (
        <Card className="p-6">
          <p className="text-sm text-destructive">{error}</p>
        </Card>
      ) : (
        <>
          {carouselItems.length ? (
            <div className="relative px-8 sm:px-10">
              <Carousel
                opts={{ loop: true, align: "start", dragFree: true }}
                setApi={setApi}
                className="w-full"
              >
                <CarouselContent>
                  {carouselItems.map((item) => (
                    <CarouselItem key={item.id} className="basis-[85%] sm:basis-1/2 lg:basis-1/3">
                      <NewsCard item={item} featured />
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="left-0" />
                <CarouselNext className="right-0" />
              </Carousel>
            </div>
          ) : null}

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Latest stories</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {visible.map((item) => (
                <NewsCard key={`list-${item.id}`} item={item} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
