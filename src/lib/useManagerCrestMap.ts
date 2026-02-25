import { useEffect, useMemo, useState } from "react";
import { EDGE_FUNCTIONS_BASE } from "./constants";
import { getSupabaseFunctionHeaders, supabaseUrl } from "./supabaseClient";

type MediaRow = {
  manager_name?: string | null;
  canonical_manager_name?: string | null;
  club_crest_url?: string | null;
};

function norm(value: string | null | undefined) {
  return String(value || "").trim().toUpperCase();
}

export function useManagerCrestMap() {
  const [map, setMap] = useState<Record<string, string>>({});

  useEffect(() => {
    async function load() {
      try {
        const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/manager-media`;
        const res = await fetch(url, { headers: getSupabaseFunctionHeaders() });
        const payload = await res.json();
        if (!res.ok || payload?.error) return;
        const rows: MediaRow[] = Array.isArray(payload?.media) ? payload.media : [];
        const next: Record<string, string> = {};
        rows.forEach((row) => {
          const crest = row.club_crest_url || null;
          if (!crest) return;
          const manager = norm(row.manager_name);
          const canonical = norm(row.canonical_manager_name);
          if (manager) next[manager] = crest;
          if (canonical) next[canonical] = crest;
          const first = (manager || canonical).split(/\s+/)[0] || "";
          if (first) next[first] = crest;
        });
        setMap(next);
      } catch {
        setMap({});
      }
    }
    load();
  }, []);

  const getCrest = useMemo(
    () => (managerName?: string | null) => {
      const key = norm(managerName);
      if (!key) return null;
      return map[key] || map[key.split(/\s+/)[0] || ""] || null;
    },
    [map],
  );

  return { getCrest };
}

