import React, { useEffect, useState } from "react";
import { EDGE_FUNCTIONS_BASE } from "../lib/constants";
import { getSupabaseFunctionHeaders, supabaseUrl } from "../lib/supabaseClient";
import { type Division } from "../lib/divisions";
import { DivisionBadge } from "./DivisionBadge";
import { Card } from "./ui/card";
import { PlayerAvatar } from "./PlayerAvatar";

type WaiverMove = {
  gameweek: number;
  manager_name: string;
  team_name: string;
  team_id: number;
  division?: Division | null;
  transaction_type: string;
  player_in_id: number | null;
  player_in_name: string | null;
  player_in_image_url?: string | null;
  player_out_id: number | null;
  player_out_name: string | null;
  player_out_image_url?: string | null;
};

type WaiverResponse = {
  gameweek: number;
  completed_since_gameweek: number | null;
  moves: WaiverMove[];
};

const DIVISION_SECTIONS: Division[] = ["division_one", "division_two"];

function WaiverMovesTable({ moves }: { moves: WaiverMove[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="px-2 py-2 font-medium">Manager</th>
            <th className="px-2 py-2 font-medium">Type</th>
            <th className="px-2 py-2 font-medium">Player In</th>
            <th className="px-2 py-2 font-medium">Player Out</th>
          </tr>
        </thead>
        <tbody>
          {moves.map((move, idx) => (
            <tr
              key={`${move.team_id}-${move.player_in_id || "none"}-${move.player_out_id || "none"}-${idx}`}
              className="border-b last:border-b-0"
            >
              <td className="px-2 py-2">{move.manager_name}</td>
              <td className="px-2 py-2">{move.transaction_type}</td>
              <td className="px-2 py-2">
                <div className="flex items-center gap-2">
                  {move.player_in_name ? (
                    <PlayerAvatar name={move.player_in_name} imageUrl={move.player_in_image_url} size="sm" />
                  ) : null}
                  <span>{move.player_in_name || "—"}</span>
                </div>
              </td>
              <td className="px-2 py-2">
                <div className="flex items-center gap-2">
                  {move.player_out_name ? (
                    <PlayerAvatar name={move.player_out_name} imageUrl={move.player_out_image_url} size="sm" />
                  ) : null}
                  <span>{move.player_out_name || "—"}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ThisWeeksWaivers() {
  const [data, setData] = useState<WaiverResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadWaivers() {
      try {
        setLoading(true);
        setError(null);
        const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/league-activity/waivers`;
        const res = await fetch(url, { headers: getSupabaseFunctionHeaders() });
        const payload = await res.json();
        if (!res.ok || payload?.error) {
          throw new Error(payload?.error?.message || "Failed to fetch waiver activity");
        }
        setData(payload);
      } catch (err: any) {
        setError(err?.message || "Failed to fetch waiver activity");
      } finally {
        setLoading(false);
      }
    }
    loadWaivers();
  }, []);

  if (loading) {
    return (
      <Card className="p-6">
        <h2 className="text-lg font-semibold">This Week&apos;s Waivers</h2>
        <p className="text-sm text-muted-foreground mt-2">Loading waiver and free-agent moves…</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <h2 className="text-lg font-semibold">This Week&apos;s Waivers</h2>
        <p className="text-sm text-destructive mt-2">{error}</p>
      </Card>
    );
  }

  if (!data || data.moves.length === 0) {
    return (
      <Card className="p-6">
        <h2 className="text-lg font-semibold">This Week&apos;s Waivers</h2>
        <p className="text-sm text-muted-foreground mt-2">No waiver or free-agent moves detected for GW {data?.gameweek ?? "—"}.</p>
      </Card>
    );
  }

  const grouped = DIVISION_SECTIONS.map((division) => ({
    division,
    moves: data.moves.filter((move) => move.division === division),
  })).filter((group) => group.moves.length > 0);
  const ungrouped = data.moves.filter(
    (move) => move.division !== "division_one" && move.division !== "division_two",
  );

  return (
    <Card className="p-4">
      <h2 className="text-lg font-semibold">This Week&apos;s Waivers</h2>
      <p className="text-sm text-muted-foreground mt-1">GW {data.gameweek} roster changes</p>
      <div className="mt-4 space-y-5">
        {grouped.map((group) => (
          <section key={group.division}>
            <div className="mb-2">
              <DivisionBadge division={group.division} />
            </div>
            <WaiverMovesTable moves={group.moves} />
          </section>
        ))}
        {ungrouped.length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-semibold">Other</h3>
            <WaiverMovesTable moves={ungrouped} />
          </section>
        )}
      </div>
    </Card>
  );
}
