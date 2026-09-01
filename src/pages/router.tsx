/**
 * Public Read-Only Router
 * 
 * All routes are public and do not require authentication.
 * Auth-related routes (Login, Signup, AuthCallback) have been removed.
 */

import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation, useNavigate } from "react-router-dom";
import { BracketView } from "../components/BracketView";
import DashboardPage from "./Dashboard";
import LeagueStandings from "../components/LeagueStandings";
import GobletStandings from "../components/GobletStandings";
import ManagersPage from "./Managers";
import PlayerInsights from "../components/PlayerInsights";
import StandingsByGameweek from "../components/StandingsByGameweek";
import LegacyHome from "./LegacyHome";
import ManagerProfile from "./ManagerProfile";
import LegacyGameweekStandings from "./LegacyGameweekStandings";
import SignIn from "./SignIn";
import PickCaptain from "./PickCaptain";
import MyPage from "./MyPage";
import MessagesPage from "./Messages";
import ScoutingPage from "./Scouting";
import FixturesPage from "./Fixtures";
import TeamRostersPage from "./TeamRosters";
import NewsPage from "./News";
import MatchupDetailPage from "./MatchupDetail";
import LineupDetailPage from "./LineupDetail";
import {
  CAPTAIN_SESSION_CHANGE_EVENT,
  clearCaptainSessionToken,
  getCaptainSessionToken,
} from "../lib/captainSession";
import { EDGE_FUNCTIONS_BASE, CUP_START_GAMEWEEK } from "../lib/constants";
import { getSupabaseFunctionHeaders, supabaseUrl } from "../lib/supabaseClient";
import { contrastText, ensureReadableText, extractPaletteFromImage, mix, rgbCss } from "../lib/colorPalette";
import leagueTrophy from "../assets/trophies/League Cup Icon.png";
import cupTrophy from "../assets/trophies/FFA Cup Icon + Year.png";
import gobletTrophy from "../assets/trophies/Goblet Icon.png";
import championsBanner from "../assets/banners/ffa-hall-of-champions.png";
import { RequireCupTypeUnlocked, RequireCupUnlocked } from "../components/RequireCupUnlocked";
import { useCurrentGameweek } from "../lib/useCurrentGameweek";
import { MainNavigation } from "../components/navigation/MainNavigation";

function RequireCaptainSignIn({ children }: { children: React.ReactElement }) {
  const location = useLocation();
  const token = getCaptainSessionToken();
  if (!token) {
    const isPickCaptainPath = location.pathname === "/pick_captain" || location.pathname === "/pick-captain";
    const next = isPickCaptainPath ? "?next=pick_captain" : "";
    return <Navigate to={`/sign-in${next}`} replace />;
  }
  return children;
}

function Shell() {
  const navigate = useNavigate();
  const location = useLocation();
  const isFullBleedRoute = location.pathname === "/standings-by-gameweek";
  const [token, setToken] = useState<string | null>(() => getCaptainSessionToken());
  const { currentGameweek } = useCurrentGameweek();
  const showCupFeatures = currentGameweek >= CUP_START_GAMEWEEK;

  useEffect(() => {
    const syncSessionToken = () => {
      setToken(getCaptainSessionToken());
    };
    syncSessionToken();
    window.addEventListener(CAPTAIN_SESSION_CHANGE_EVENT, syncSessionToken);
    window.addEventListener("storage", syncSessionToken);
    return () => {
      window.removeEventListener(CAPTAIN_SESSION_CHANGE_EVENT, syncSessionToken);
      window.removeEventListener("storage", syncSessionToken);
    };
  }, []);

  const handleHeaderSignOut = async () => {
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
      setToken(null);
      navigate("/dashboard");
    }
  };

  useEffect(() => {
    const root = document.documentElement;
    const resetTheme = () => {
      root.style.removeProperty("--primary");
      root.style.removeProperty("--accent");
      root.style.removeProperty("--muted");
      root.style.removeProperty("--sidebar-primary");
      root.style.removeProperty("--ring");
      root.style.removeProperty("--background");
      root.style.removeProperty("--card");
      root.style.removeProperty("--secondary");
      root.style.removeProperty("--border");
      root.style.removeProperty("--input-background");
      root.style.removeProperty("--primary-foreground");
      root.style.removeProperty("--accent-foreground");
      root.style.removeProperty("--secondary-foreground");
      root.style.removeProperty("--sidebar");
      root.style.removeProperty("--sidebar-accent");
      root.style.removeProperty("--sidebar-accent-foreground");
      root.style.removeProperty("--foreground");
      root.style.removeProperty("--card-foreground");
      root.style.removeProperty("--muted-foreground");
      root.style.removeProperty("--sidebar-foreground");
    };

    async function applyLogoTheme(logoUrl: string | null) {
      if (!logoUrl) {
        resetTheme();
        return;
      }
      try {
        const palette = await extractPaletteFromImage(logoUrl);
        if (palette.length === 0) {
          resetTheme();
          return;
        }
        const base = palette[0];
        const accent = palette[1] || mix(base, { r: 255, g: 255, b: 255 }, 0.2);
        const mutedSeed = palette[2] || mix(base, { r: 255, g: 255, b: 255 }, 0.76);
        const muted = mix(mutedSeed, { r: 255, g: 255, b: 255 }, 0.58);
        const primary = mix(accent, muted, 0.34);
        const background = mix(primary, { r: 255, g: 255, b: 255 }, 0.9);
        const card = mix(muted, { r: 255, g: 255, b: 255 }, 0.2);
        const secondary = mix(muted, accent, 0.18);
        const border = mix(muted, accent, 0.48);
        const foreground = ensureReadableText(background) === "rgb(10 10 10)" ? "rgb(15 23 42)" : "rgb(248 250 252)";
        const cardForeground = ensureReadableText(card) === "rgb(10 10 10)" ? "rgb(17 24 39)" : "rgb(248 250 252)";
        const secondaryForeground = ensureReadableText(secondary) === "rgb(10 10 10)" ? "rgb(20 20 20)" : "rgb(248 250 252)";
        const mutedForeground = foreground === "rgb(15 23 42)" ? "rgb(71 85 105)" : "rgb(203 213 225)";

        root.style.setProperty("--primary", rgbCss(primary));
        root.style.setProperty("--primary-foreground", contrastText(primary));
        root.style.setProperty("--sidebar-primary", rgbCss(primary));
        root.style.setProperty("--accent", rgbCss(accent));
        root.style.setProperty("--accent-foreground", contrastText(accent));
        root.style.setProperty("--muted", rgbCss(muted));
        root.style.setProperty("--secondary", rgbCss(secondary));
        root.style.setProperty("--secondary-foreground", secondaryForeground);
        root.style.setProperty("--ring", rgbCss(accent));
        root.style.setProperty("--background", rgbCss(background));
        root.style.setProperty("--card", rgbCss(card));
        root.style.setProperty("--foreground", foreground);
        root.style.setProperty("--card-foreground", cardForeground);
        root.style.setProperty("--muted-foreground", mutedForeground);
        root.style.setProperty("--border", rgbCss(border, 0.38));
        root.style.setProperty("--input-background", rgbCss(mix(card, { r: 255, g: 255, b: 255 }, 0.28)));
        root.style.setProperty("--sidebar", rgbCss(card));
        root.style.setProperty("--sidebar-foreground", cardForeground);
        root.style.setProperty("--sidebar-accent", rgbCss(secondary));
        root.style.setProperty("--sidebar-accent-foreground", secondaryForeground);
      } catch {
        resetTheme();
      }
    }

    async function loadSessionMedia() {
      if (!token) {
        await applyLogoTheme(null);
        return;
      }
      try {
        const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/captain-auth/session?token=${encodeURIComponent(token)}`;
        const res = await fetch(url, { headers: getSupabaseFunctionHeaders() });
        const payload = await res.json();
        if (!res.ok || payload?.error) throw new Error("session media unavailable");
        const logo = payload?.media?.club_logo_url || null;
        await applyLogoTheme(logo);
      } catch {
        await applyLogoTheme(null);
      }
    }

    loadSessionMedia();
  }, [token]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col overflow-x-hidden">
      <header className="border-b">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center gap-3 px-4 py-2">
          {(() => {
            const path = location.pathname;
            const isGoblet = path.startsWith("/goblet");
            const isCup =
              path.startsWith("/bracket") ||
              path.startsWith("/lineup/cup") ||
              path.startsWith("/matchup/cup");
            const src = isGoblet ? gobletTrophy : isCup ? cupTrophy : leagueTrophy;
            const alt = isGoblet ? "Goblet trophy" : isCup ? "FFA Cup trophy" : "League trophy";
            const label = isCup ? "FFA Bench Boost Cup" : "League of Lads";
            return (
              <Link
                to="/dashboard"
                className="group relative block w-[210px] max-w-full shrink-0 overflow-visible bg-transparent font-heading text-lg font-semibold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.9)] sm:w-[250px]"
              >
                <img
                  src={championsBanner}
                  alt=""
                  aria-hidden="true"
                  className="pointer-events-none relative z-0 block h-auto w-full max-w-full bg-transparent object-contain object-center"
                />
                <span className="pointer-events-none absolute inset-x-0 bottom-1 z-10 flex items-end justify-center gap-2 px-1 pb-0">
                  <img
                    src={src}
                    alt={alt}
                    className="h-7 w-5 object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] transition-all duration-200 group-hover:scale-110 group-hover:brightness-110 group-hover:sepia group-hover:saturate-[8] group-hover:hue-rotate-[340deg]"
                  />
                  <span className="relative z-10 whitespace-nowrap leading-none">{label}</span>
                </span>
              </Link>
            );
          })()}
        </div>
        <MainNavigation token={token} showCupFeatures={showCupFeatures} onSignOut={handleHeaderSignOut} />
      </header>
      <main className="flex-1">
        <div className={isFullBleedRoute ? "w-full px-0 py-0" : "mx-auto max-w-6xl px-4 py-6"}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/home" element={<DashboardPage />} />
            <Route path="/legacy-home" element={<LegacyHome />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/league-standings" element={<LeagueStandings />} />
            <Route path="/goblet" element={<GobletStandings />} />
            <Route path="/managers" element={<ManagersPage />} />
            <Route path="/team-rosters" element={<TeamRostersPage />} />
            <Route path="/players" element={<PlayerInsights />} />
            <Route path="/fixtures" element={<FixturesPage />} />
            <Route path="/news" element={<NewsPage />} />
            <Route
              path="/matchup/:type/:gameweek/:team1/:team2"
              element={
                <RequireCupTypeUnlocked>
                  <MatchupDetailPage />
                </RequireCupTypeUnlocked>
              }
            />
            <Route
              path="/lineup/:type/:gameweek/:teamId"
              element={
                <RequireCupTypeUnlocked>
                  <LineupDetailPage />
                </RequireCupTypeUnlocked>
              }
            />
            <Route path="/legacy-gameweek-standings" element={<LegacyGameweekStandings />} />
            <Route path="/standings-by-gameweek" element={<StandingsByGameweek />} />
            <Route path="/bracket" element={<RequireCupUnlocked title="FFA Bench Boost Cup"><BracketView /></RequireCupUnlocked>} />
            <Route path="/set-entry" element={<Navigate to="/sign-in" replace />} />
            <Route path="/sign-in" element={<SignIn />} />
            <Route
              path="/pick_captain"
              element={
                <RequireCupUnlocked title="Pick Captain">
                  <RequireCaptainSignIn>
                    <PickCaptain />
                  </RequireCaptainSignIn>
                </RequireCupUnlocked>
              }
            />
            <Route
              path="/pick-captain"
              element={
                <RequireCupUnlocked title="Pick Captain">
                  <RequireCaptainSignIn>
                    <PickCaptain />
                  </RequireCaptainSignIn>
                </RequireCupUnlocked>
              }
            />
            <Route
              path="/my-page"
              element={
                <RequireCaptainSignIn>
                  <MyPage />
                </RequireCaptainSignIn>
              }
            />
            <Route
              path="/messages"
              element={
                <RequireCaptainSignIn>
                  <MessagesPage />
                </RequireCaptainSignIn>
              }
            />
            <Route
              path="/scouting"
              element={
                <RequireCaptainSignIn>
                  <ScoutingPage />
                </RequireCaptainSignIn>
              }
            />
            <Route path="/manager/:managerName" element={<ManagerProfile />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Shell />
    </BrowserRouter>
  );
}
