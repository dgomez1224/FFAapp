import React from "react";
import { Card } from "./ui/card";

type FeatureLockedProps = {
  title: string;
  unlockGameweek: number;
  currentGameweek: number;
};

export function FeatureLocked({ title, unlockGameweek, currentGameweek }: FeatureLockedProps) {
  const remaining = Math.max(0, unlockGameweek - currentGameweek);
  return (
    <Card className="p-6 space-y-2">
      <h1 className="font-heading text-2xl font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">Coming soon.</p>
      <p className="text-sm">
        This feature will be available from Gameweek {unlockGameweek}.
      </p>
      {remaining > 0 ? (
        <p className="text-sm text-muted-foreground">
          {remaining} gameweek{remaining === 1 ? "" : "s"} remaining.
        </p>
      ) : null}
    </Card>
  );
}
