const FPL_BASE_URL = "https://fantasy.premierleague.com/api";

export interface APIResponse<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
}

async function fetchJson<T>(endpoint: string): Promise<APIResponse<T>> {
  try {
    const res = await fetch(`${FPL_BASE_URL}${endpoint}`);
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        data: null,
        error: `Request failed with status ${res.status}`,
      };
    }
    const data = (await res.json()) as T;
    return { ok: true, status: res.status, data };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export const fplApi = {
  getBootstrapStatic: <T>() => fetchJson<T>("/bootstrap-static"),
  getSquad: <T>(entryId: number, gameweek: number) =>
    fetchJson<T>(`/entry/${entryId}/event/${gameweek}`),
};

