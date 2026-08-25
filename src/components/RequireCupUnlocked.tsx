import React from "react";
import { useParams } from "react-router-dom";
import { CUP_START_GAMEWEEK } from "../lib/constants";
import { useCurrentGameweek } from "../lib/useCurrentGameweek";
import { FeatureLocked } from "./FeatureLocked";

type RequireCupUnlockedProps = {
  title: string;
  children: React.ReactElement;
};

export function RequireCupUnlocked({ title, children }: RequireCupUnlockedProps) {
  const { currentGameweek, loading } = useCurrentGameweek();
  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (currentGameweek < CUP_START_GAMEWEEK) {
    return (
      <FeatureLocked
        title={title}
        unlockGameweek={CUP_START_GAMEWEEK}
        currentGameweek={currentGameweek}
      />
    );
  }
  return children;
}

/** Blocks cup matchup/lineup URLs until Gameweek 27; league routes pass through. */
export function RequireCupTypeUnlocked({ children }: { children: React.ReactElement }) {
  const { type } = useParams();
  if (type !== "cup") return children;
  return <RequireCupUnlocked title="FFA Bench Boost Cup">{children}</RequireCupUnlocked>;
}
