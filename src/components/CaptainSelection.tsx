import React, { useEffect, useMemo, useState } from "react";
import { fplApi } from "../lib/fpl-api-client";
import { EDGE_FUNCTIONS_BASE } from "../lib/constants";
import { getSupabaseFunctionHeaders, supabaseUrl } from "../lib/supabaseClient";
import { supabase, supabaseUrl } from "../lib/supabaseClient";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Label } from "./ui/label";

interface Player {
  id: number;
  web_name: string;
  team: number;
  element_type: number;
}

interface SquadPick {
  element: number;
  position: number;
}

interface SquadResponse {
  picks: SquadPick[];
}

interface BootstrapResponse {
  elements: Player[];
}

function useTournamentContext() {
  const entryId = Number(localStorage.getItem("ffa_entry_id") ?? "0");
  const teamId = localStorage.getItem("ffa_team_id") ?? "";
  const tournamentId = localStorage.getItem("ffa_tournament_id") ?? "";
  const currentGameweek = Number(
    localStorage.getItem("ffa_current_gw") ?? "0",
  );

  return { entryId, teamId, tournamentId, currentGameweek };
}

export function CaptainSelection() {
  const { entryId, teamId, currentGameweek } = useTournamentContext();

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [captainId, setCaptainId] = useState<number | null>(null);
  const [viceCaptainId, setViceCaptainId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const missingConfig = useMemo(() => {
    const issues: string[] = [];
    if (!entryId) issues.push("Entry ID");
    if (!teamId) issues.push("Team ID");
    if (!currentGameweek) issues.push("Current gameweek");
    return issues;
  }, [entryId, teamId, currentGameweek]);

  useEffect(() => {
    async function loadSquad() {
      if (missingConfig.length) return;
      setLoading(true);
      setError(null);

      const [squadRes, bootstrapRes] = await Promise.all([
        fplApi.getSquad<SquadResponse>(entryId, currentGameweek),
        fplApi.getBootstrapStatic<BootstrapResponse>(),
      ]);

      if (!squadRes.ok || !bootstrapRes.ok || !squadRes.data || !bootstrapRes.data) {
        setError(
          "Unable to load your squad from the FPL API. Please check your configuration and try again.",
        );
        setLoading(false);
        return;
      }

      const pickIds = new Set(squadRes.data.picks.map((p) => p.element));
      const squadPlayers = bootstrapRes.data.elements.filter((p) =>
        pickIds.has(p.id),
      );
      setPlayers(squadPlayers);
      setLoading(false);
    }

    loadSquad();
  }, [entryId, currentGameweek, missingConfig]);

  async function handleSubmit() {
    if (!captainId || !viceCaptainId) {
      setError("Please choose both a captain and a vice-captain.");
      return;
    }
    if (captainId === viceCaptainId) {
      setError("Captain and vice-captain must be different players.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const functionsBase = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}`;
      const validateRes = await fetch(
        `${functionsBase}/validate-captain`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getSupabaseFunctionHeaders(),
          },
          body: JSON.stringify({
            entryId,
            gameweek: currentGameweek,
            captainId,
            viceCaptainId,
          }),
        },
      );

      const payload = await validateRes.json();
      if (!validateRes.ok || payload?.error) {
        setError(
          payload?.error?.message ??
            "Captain validation failed. Please try again.",
        );
        setSubmitting(false);
        return;
      }

      const { error: upsertError } = await supabase
        .from("captain_selections")
        .upsert({
          team_id: teamId,
          gameweek: currentGameweek,
          captain_element_id: captainId,
          vice_captain_element_id: viceCaptainId,
          validated_at: new Date().toISOString(),
        });

      if (upsertError) {
        setError(`Failed to save captain selection: ${upsertError.message}`);
        setSubmitting(false);
        return;
      }

      setSuccess("Captain selection saved and validated.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unexpected error while saving captain selection.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (missingConfig.length) {
    return (
      <Card className="p-6">
        <h1 className="mb-4 text-xl font-semibold">Captain selection</h1>
        <p className="text-sm text-muted-foreground">
          Missing required tournament context: {missingConfig.join(", ")}. Set
          these values in localStorage keys{" "}
          <code>ffa_entry_id</code>, <code>ffa_team_id</code>,{" "}
          <code>ffa_current_gw</code> before using this screen.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Captain selection</h1>
          <p className="text-sm text-muted-foreground">
            Choose your captain and vice-captain for gameweek {currentGameweek}.
          </p>
        </div>
      </div>

      <Card className="p-4">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[2fr,1fr]">
        <div className="space-y-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Squad
          </h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">
              Loading squad from FPL Draft API…
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {players.map((player) => (
                <div
                  key={player.id}
                  className="rounded-md border bg-card p-3 text-sm"
                >
                  <div className="font-medium">{player.web_name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    ID: {player.id}
                  </div>
                  <div className="mt-2 space-y-1">
                    <Label className="flex items-center gap-2 text-xs">
                      <RadioGroupItem
                        value={String(player.id)}
                        checked={captainId === player.id}
                        onClick={() => setCaptainId(player.id)}
                      />
                      Captain
                    </Label>
                    <Label className="flex items-center gap-2 text-xs">
                      <RadioGroupItem
                        value={String(player.id)}
                        checked={viceCaptainId === player.id}
                        onClick={() => setViceCaptainId(player.id)}
                      />
                      Vice-captain
                    </Label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Selection
          </h2>
          <div className="space-y-2 text-sm">
            <div>
              <span className="font-medium">Captain: </span>
              {captainId
                ? players.find((p) => p.id === captainId)?.web_name ??
                  `#${captainId}`
                : "Not selected"}
            </div>
            <div>
              <span className="font-medium">Vice-captain: </span>
              {viceCaptainId
                ? players.find((p) => p.id === viceCaptainId)?.web_name ??
                  `#${viceCaptainId}`
                : "Not selected"}
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          {success && (
            <p className="text-sm text-emerald-600" role="status">
              {success}
            </p>
          )}

          <Button
            className="w-full"
            disabled={submitting || loading}
            onClick={handleSubmit}
          >
            {submitting ? "Saving…" : "Confirm selection"}
          </Button>
        </div>
      </div>
      </Card>
    </div>
  );
}
