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
import { rivalryChipLabel, leagueMatchupPath, findRivalry, type RivalryType } from "../lib/rivalries";
import { loadRivalryNews } from "../lib/rivalryNews";
import { getDivisionLabel, getManagerEntryId, type Division } from "../lib/divisions";
import { buildLeagueFixtureSummary, type FixtureNewsPlayer } from "../lib/fixtureNews";

export type NewsCategory = "league" | "draft" | "epl";

export type NewsItem = {
  id: string;
  title: string;
  summary: string;
  detail?: string;
  url: string;
  source: string;
  category: NewsCategory;
  kind?: string;
  rivalryType?: RivalryType;
  publishedAt: string | null;
};

type ViewFilter = "all" | NewsCategory | "waiver";

const FILTERS: Array<{ id: ViewFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "league", label: "League" },
  { id: "waiver", label: "Waivers" },
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

function splitStory(summary: string, detail?: string) {
  const full = String(detail || "").trim();
  const blurb = String(summary || "").trim();
  if (full && full !== blurb) return { blurb, detail: full };
  const match = blurb.match(/^(.+?[.!?])\s+([\s\S]+)$/);
  if (match && match[1].length <= 180 && match[2].trim()) {
    return { blurb: match[1], detail: match[2].trim() };
  }
  return { blurb, detail: "" };
}

function NewsCard({ item, featured = false }: { item: NewsItem; featured?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const { blurb, detail } = splitStory(item.summary, item.detail);
  const canExpand = Boolean(detail);

  return (
    <article
      className={`h-full rounded-xl border bg-card text-left transition-all duration-300 ${
        featured ? "min-h-[180px]" : ""
      } ${expanded ? "p-5 shadow-md ring-1 ring-primary/15" : "p-4"} ${
        canExpand ? "hover:bg-accent/30" : "hover:bg-accent/40"
      }`}
    >
      <button
        type="button"
        className="w-full text-left"
        onClick={() => (canExpand ? setExpanded((open) => !open) : undefined)}
        aria-expanded={canExpand ? expanded : undefined}
      >
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${categoryChip(item.category)}`}>
            {item.category === "epl" ? "EPL" : item.category}
          </span>
          {item.kind ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {item.rivalryType ? rivalryChipLabel(item.rivalryType) : item.kind}
            </span>
          ) : null}
          <span className="text-[11px] text-muted-foreground">{item.source}</span>
          {item.publishedAt ? (
            <span className="text-[11px] text-muted-foreground">{formatWhen(item.publishedAt)}</span>
          ) : null}
          {canExpand ? (
            <span className="ml-auto text-[11px] text-muted-foreground">{expanded ? "▲" : "▼"}</span>
          ) : null}
        </div>
        <h3 className={`font-semibold leading-snug ${featured ? "text-lg" : "text-base"}`}>{item.title}</h3>
        {blurb ? (
          <p className={`mt-2 text-sm text-muted-foreground ${expanded || !canExpand ? "" : "line-clamp-3"}`}>
            {blurb}
          </p>
        ) : null}
      </button>
      {canExpand ? (
        <div
          className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
            expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">
            <div className="mt-3 rounded-lg border bg-muted/40 p-3 text-sm leading-relaxed text-foreground/80">
              {detail}
            </div>
          </div>
        </div>
      ) : null}
      <div className="mt-3 flex items-center justify-between gap-2">
        {canExpand ? (
          <button
            type="button"
            className="text-xs font-medium text-primary hover:underline"
            onClick={() => setExpanded((open) => !open)}
          >
            {expanded ? "Show less" : "Read full story"}
          </button>
        ) : (
          <span />
        )}
        {item.url.startsWith("/") ? (
          <Link to={item.url} className="text-xs text-primary hover:underline">
            Open →
          </Link>
        ) : (
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
            Open →
          </a>
        )}
      </div>
    </article>
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

function mapFixturePlayers(rows: any[]): FixtureNewsPlayer[] {
  return rows
    .map((p: any) => ({
      manager: String(p.manager_name || p.manager || ""),
      playerName: String(p.web_name || p.player_name || p.playerName || ""),
      points: Number(p.total_points ?? p.effective_points ?? p.raw_points ?? p.points ?? 0),
      minutes: Number(p.minutes || 0),
      goals: Number(p.goals_scored ?? p.goals ?? 0),
      assists: Number(p.assists || 0),
    }))
    .filter((p) => p.playerName);
}

async function fetchLineupPlayers(teamKey: string, manager: string, gw: number): Promise<FixtureNewsPlayer[]> {
  if (!teamKey || !gw) return [];
  try {
    const params = new URLSearchParams({
      team: String(teamKey),
      gameweek: String(gw),
      type: "league",
    });
    const res = await fetch(
      `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/fixtures/lineup?${params}`,
      { headers: getSupabaseFunctionHeaders() },
    );
    const payload = await res.json();
    return mapFixturePlayers(
      (Array.isArray(payload?.lineup) ? payload.lineup : []).filter(
        (p: any) => !p.is_bench && !p.is_auto_subbed_off,
      ),
    ).map((p) => ({ ...p, manager: p.manager || manager }));
  } catch {
    return [];
  }
}

async function fixtureNewsItemsFromPayload(payload: any, now: string): Promise<NewsItem[]> {
  const fixtures = Array.isArray(payload?.fixtures) ? payload.fixtures : [];
  const gw = Number(payload?.gameweek || 0);
  const items = await Promise.all(
    fixtures.map(async (f: any, index: number) => {
      const t1 = f?.team_1?.manager_name;
      const t2 = f?.team_2?.manager_name;
      if (!t1 || !t2) return null;
      if (findRivalry(t1, t2)) return null;
      const scoreA = Math.round(f.team_1?.points || 0);
      const scoreB = Math.round(f.team_2?.points || 0);
      const starterRows = Array.isArray(f?.starters) ? f.starters : Array.isArray(f?.potm) ? f.potm : [];
      let players = mapFixturePlayers(starterRows);
      if (players.length < 8) {
        const [sideA, sideB] = await Promise.all([
          fetchLineupPlayers(String(f?.team_1?.entry_id || getManagerEntryId(t1) || ""), t1, gw),
          fetchLineupPlayers(String(f?.team_2?.entry_id || getManagerEntryId(t2) || ""), t2, gw),
        ]);
        if (sideA.length + sideB.length > players.length) {
          players = [...sideA, ...sideB];
        }
      }
      return {
        id: `result-${gw}-${index}`,
        title: `GW ${gw}: ${t1} ${scoreA}–${scoreB} ${t2}`,
        summary: buildLeagueFixtureSummary({
          managerA: t1,
          managerB: t2,
          scoreA,
          scoreB,
          players,
        }),
        url: leagueMatchupPath(
          gw,
          f?.team_1?.entry_id || getManagerEntryId(t1),
          f?.team_2?.entry_id || getManagerEntryId(t2),
        ),
        source: "League of Lads",
        category: "league" as const,
        kind: "result",
        publishedAt: now,
      } as NewsItem;
    }),
  );
  return items.filter((item): item is NewsItem => Boolean(item));
}

async function loadLeagueNews(): Promise<NewsItem[]> {
  try {
    const res = await fetch(
      `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/league-activity/league-news`,
      { headers: getSupabaseFunctionHeaders() },
    );
    const payload = await res.json();
    if (res.ok && Array.isArray(payload?.items) && payload.items.length) {
      const mapped = payload.items.map((item: any) => {
        const title = String(item.title || "").trim();
        let url = String(item.url || "/dashboard");
        if (!url.startsWith("/matchup/")) {
          const result = title.match(/GW\s+(\d+):\s+([A-Za-z]+)\s+\d+[–\-]\d+\s+([A-Za-z]+)/i);
          if (result) {
            url = leagueMatchupPath(
              Number(result[1]),
              getManagerEntryId(result[2]),
              getManagerEntryId(result[3]),
            );
          }
        }
        return {
          id: String(item.id),
          title,
          summary: String(item.summary || "").trim(),
          url,
          source: String(item.source || "League of Lads"),
          category: "league" as const,
          kind: String(item.kind || "general"),
          rivalryType: item.rivalryType as RivalryType | undefined,
          publishedAt: item.publishedAt || null,
        };
      });
      try {
        const prevRes = await fetch(
          `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/league-activity/previous-week-results`,
          { headers: getSupabaseFunctionHeaders() },
        );
        const prevPayload = await prevRes.json();
        const rich = await fixtureNewsItemsFromPayload(prevPayload, new Date().toISOString());
        if (rich.length) {
          return [...mapped.filter((item) => item.kind !== "result"), ...rich];
        }
      } catch {
        // keep mapped results
      }
      return mapped;
    }
  } catch {
    // fall through to lightweight local headlines
  }

  const items: NewsItem[] = [];
  const now = new Date().toISOString();
  const headers = getSupabaseFunctionHeaders();

  try {
    const [d1, d2] = await Promise.all(
      (["division_one", "division_two"] as Division[]).map(async (division) => {
        const res = await fetch(
          `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/h2h-standings?division=${division}`,
          { headers },
        );
        const payload = await res.json();
        return { division, standings: Array.isArray(payload?.standings) ? payload.standings : [] };
      }),
    );
    [d1, d2].forEach(({ division, standings }) => {
      const leader = standings[0];
      const second = standings[1];
      if (!leader?.manager_name) return;
      const gap = Number(leader.points || 0) - Number(second?.points || 0);
      items.push({
        id: `league-leader-${division}`,
        title: `${leader.manager_name} leads ${getDivisionLabel(division)}`,
        summary: second
          ? `${leader.manager_name} sits on ${leader.points ?? 0} league points, ${gap} ahead of ${second.manager_name}.`
          : `${leader.manager_name} sits top of ${getDivisionLabel(division)}.`,
        url: "/league-standings",
        source: "League of Lads",
        category: "league",
        kind: "race",
        publishedAt: now,
      });
    });
    const d1Rows = d1.standings;
    if (d1Rows.length >= 2) {
      const bottom = d1Rows.slice(-2);
      items.push({
        id: "relegation-d1",
        title: "Relegation watch in Division One",
        summary: `${bottom.map((r: any) => r.manager_name).filter(Boolean).join(" and ")} occupy the bottom two places.`,
        url: "/league-standings",
        source: "League of Lads",
        category: "league",
        kind: "relegation",
        publishedAt: now,
      });
    }
    const d2Rows = d2.standings;
    if (d2Rows.length >= 2) {
      items.push({
        id: "promotion-d2",
        title: "Promotion race in Division Two",
        summary: `${d2Rows[0].manager_name} and ${d2Rows[1].manager_name} hold the top two places.`,
        url: "/league-standings",
        source: "League of Lads",
        category: "league",
        kind: "promotion",
        publishedAt: now,
      });
    }
  } catch {
    // keep other league items
  }

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/goblet-standings`, { headers });
    const payload = await res.json();
    const standings = Array.isArray(payload?.standings) ? payload.standings : [];
    const sorted = [...standings].sort(
      (a: any, b: any) => Number(b.points_for ?? b.total_points ?? 0) - Number(a.points_for ?? a.total_points ?? 0),
    );
    if (sorted[0]?.manager_name) {
      const lead = sorted[0];
      const chase = sorted[1];
      items.push({
        id: "goblet-race",
        title: `${lead.manager_name} tops the Goblet`,
        summary: chase
          ? `${lead.manager_name} leads the Goblet, with ${chase.manager_name} next.`
          : `${lead.manager_name} leads the Goblet standings.`,
        url: "/goblet",
        source: "League of Lads",
        category: "league",
        kind: "goblet",
        publishedAt: now,
      });
    }
  } catch {
    // goblet optional
  }

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/league-activity/waivers`, { headers });
    const payload = await res.json();
    const moves = Array.isArray(payload?.moves) ? payload.moves : [];
    moves.slice(0, 6).forEach((move: any, index: number) => {
      const manager = String(move.manager_name || "A manager");
      const playerIn = String(move.player_in_name || "a player");
      const playerOut = move.player_out_name ? `, dropping ${move.player_out_name}` : "";
      const isFa = String(move.transaction_type || "").toLowerCase().includes("free");
      items.push({
        id: `waiver-${move.team_id || index}-${move.player_in_id || index}`,
        title: isFa ? `${manager} signs ${playerIn}` : `Waiver claim: ${playerIn}`,
        summary: `${manager} has picked up ${playerIn}${playerOut}.`,
        url: "/dashboard",
        source: "League of Lads",
        category: "league",
        kind: "waiver",
        publishedAt: now,
      });
    });
  } catch {
    // waivers optional
  }

  try {
    const res = await fetch(
      `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/league-activity/previous-week-results`,
      { headers },
    );
    const payload = await res.json();
    items.push(...(await fixtureNewsItemsFromPayload(payload, now)));
    const fixtures = Array.isArray(payload?.fixtures) ? payload.fixtures : [];
    const gw = Number(payload?.gameweek || 0);
    const potm = fixtures
      .flatMap((f: any) => (Array.isArray(f?.potm) ? f.potm : []))
      .sort((a: any, b: any) => Number(b.total_points || 0) - Number(a.total_points || 0))[0];
    if (potm?.player_name) {
      items.push({
        id: `player-${gw}-${potm.player_id || potm.player_name}`,
        title: `${potm.player_name} tops GW ${gw}`,
        summary: `${potm.player_name} scored ${potm.total_points} points for ${potm.manager_name || "their manager"}.`,
        url: "/team-of-the-week",
        source: "League of Lads",
        category: "league",
        kind: "player",
        publishedAt: now,
      });
    }
  } catch {
    // results optional
  }

  return items;
}

export default function NewsPage() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ViewFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
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
          const key = item.id || `${item.title}|${item.url}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return Boolean(item.title);
        });
        if (!cancelled) {
          setItems(unique);
          if (!unique.length) setError("No news stories are available right now.");
          setLoading(false);
        }
        const rivalries = await loadRivalryNews().catch(() => []);
        if (!cancelled && rivalries.length) {
          setItems((prev) => {
            const mapped = new Map(prev.map((item) => [item.id, item]));
            const extras: NewsItem[] = [];
            rivalries.forEach((row) => {
              const next: NewsItem = {
                id: row.id,
                title: row.title,
                summary: row.summary,
                url: row.url,
                source: row.source,
                category: "league",
                kind: row.kind,
                rivalryType: row.rivalryType,
                publishedAt: row.publishedAt,
              };
              if (mapped.has(row.id)) mapped.set(row.id, next);
              else extras.push(next);
            });
            return [...extras, ...mapped.values()];
          });
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

  const visible = useMemo(() => {
    return items.filter((item) => {
      if (filter === "all") {
        // keep
      } else if (filter === "league") {
        if (item.category !== "league") return false;
      } else if (filter === "draft" || filter === "epl") {
        if (item.category !== filter) return false;
      } else if (filter === "waiver") {
        if (item.kind !== "waiver") return false;
      }
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return item.title.toLowerCase().includes(q) || item.summary.toLowerCase().includes(q);
    });
  }, [filter, items, searchTerm]);
  const carouselItems = visible.slice(0, 12);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-bold">News</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          League headlines — including rivalries, streaks, races, and cup — plus Premier League and FPL Draft coverage.
        </p>
      </div>

      <div className="space-y-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
        <input
          type="search"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search news…"
          className="h-9 w-full max-w-xs rounded-md border bg-background px-3 text-sm"
        />
      </div>
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
