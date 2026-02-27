#!/usr/bin/env node

const LEAGUE_ID = 28469;
const BASE = "https://draft.premierleague.com/api";

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} for ${url}`);
  }
  return res.json();
}

async function main() {
  const [bootstrap, details, elementStatus] = await Promise.all([
    fetchJson(`${BASE}/bootstrap-dynamic`),
    fetchJson(`${BASE}/league/${LEAGUE_ID}/details`),
    fetchJson(`${BASE}/league/${LEAGUE_ID}/element-status`),
  ]);

  const elements = bootstrap?.elements?.data || bootstrap?.elements || [];
  const woltemade = elements.find((p) => {
    const name = normalize(`${p?.first_name || ""} ${p?.second_name || ""}`);
    const web = normalize(p?.web_name);
    return name.includes("woltemade") || web.includes("woltemade");
  });
  if (!woltemade?.id) fail("Could not find Woltemade in bootstrap-dynamic.");

  const entries = details?.league_entries || [];
  const chris = entries.find((e) => {
    const first = normalize(e?.player_first_name);
    const last = normalize(e?.player_last_name);
    return first === "chris" && last === "quinones";
  });
  if (!chris) fail("Could not find Chris Quinones league entry.");

  const validOwnerIds = new Set(
    [Number(chris.entry_id), Number(chris.id)].filter((v) => Number.isInteger(v) && v > 0),
  );
  if (validOwnerIds.size === 0) fail("Chris entry IDs are invalid.");

  const statusRows = elementStatus?.element_status || elementStatus?.elements || [];
  const woltemadeStatus = statusRows.find((row) => Number(row?.element) === Number(woltemade.id));
  if (!woltemadeStatus) fail(`No element-status row found for Woltemade (element ${woltemade.id}).`);

  const ownerId = Number(woltemadeStatus.owner);
  if (!validOwnerIds.has(ownerId)) {
    fail(
      `Expected Woltemade owner to be Chris (${Array.from(validOwnerIds).join(", ")}), got ${String(
        woltemadeStatus.owner,
      )}.`,
    );
  }

  console.log(
    `PASS: Woltemade (element ${woltemade.id}) owner ${ownerId} matches Chris Quinones (${Array.from(validOwnerIds).join(
      ", ",
    )}).`,
  );
}

main().catch((err) => fail(err?.message || "Unexpected error"));
