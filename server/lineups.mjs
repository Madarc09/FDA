import { load } from "cheerio";
import { readFile } from "node:fs/promises";
import { cached, fetchSource, envelope } from "./http.mjs";
import { normalizeName, easternDate } from "../shared/format.mjs";
const DFO =
  "https://www.dailyfaceoff.com/teams/toronto-maple-leafs/line-combinations";
const SLOTS = {
  f1: ["lw", "c", "rw"],
  f2: ["lw", "c", "rw"],
  f3: ["lw", "c", "rw"],
  f4: ["lw", "c", "rw"],
  d1: ["ld", "rd"],
  d2: ["ld", "rd"],
  d3: ["ld", "rd"],
  g: ["g1", "g2"],
  pp1: ["sk1", "sk2", "sk3", "sk4", "sk5"],
  pp2: ["sk1", "sk2", "sk3", "sk4", "sk5"],
  pk1: ["sk1", "sk2", "sk3", "sk4"],
  pk2: ["sk1", "sk2", "sk3", "sk4"],
};
const REQUIRED = ["f1", "f2", "f3", "f4", "d1", "d2", "d3", "g"];
export function robotsAllows(robots, path, agent = "theoriginalset") {
  const groups = [];
  let g = null,
    hasRules = false;
  for (const line of robots.split(/\r?\n/)) {
    const clean = line.split("#")[0].trim(),
      match = clean.match(/^([^:]+):\s*(.*)$/);
    if (!match) continue;
    const key = match[1].toLowerCase(),
      value = match[2].trim();
    if (key === "user-agent") {
      if (!g || hasRules) {
        g = { agents: [], rules: [] };
        groups.push(g);
        hasRules = false;
      }
      g.agents.push(value.toLowerCase());
    } else if (g && (key === "allow" || key === "disallow")) {
      hasRules = true;
      if (value) g.rules.push({ allow: key === "allow", path: value });
    }
  }
  const specific = groups.filter((g) =>
    g.agents.some((a) => a !== "*" && agent.includes(a)),
  );
  const rules = (
    specific.length ? specific : groups.filter((g) => g.agents.includes("*"))
  ).flatMap((g) => g.rules);
  if (!groups.length) return false;
  const matched = rules
    .filter((r) =>
      new RegExp(
        "^" + r.path.replace(/[.+?^{}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*"),
      ).test(path),
    )
    .sort(
      (a, b) =>
        b.path.length - a.path.length || Number(b.allow) - Number(a.allow),
    );
  return matched[0]?.allow ?? true;
}
async function permittedPage(url) {
  const u = new URL(url),
    robots = await cached(`robots:${u.origin}`, 86400000, () =>
      fetchSource(`${u.origin}/robots.txt`, {
        json: false,
        timeout: 6000,
        retries: 0,
      }),
    );
  if (!robotsAllows(robots, u.pathname))
    throw new Error("Source crawling policy does not permit this page");
  return fetchSource(url, { json: false, timeout: 7000, retries: 0 });
}
function lookup(roster) {
  const map = new Map();
  for (const p of roster) {
    const key = normalizeName(p.name);
    if (map.has(key)) throw new Error("Ambiguous roster name");
    map.set(key, p);
  }
  return (name) => {
    const p = map.get(normalizeName(name));
    if (!p) throw new Error(`Unresolved lineup player: ${name}`);
    return p;
  };
}
export function validateLineup(lineup, roster) {
  if (
    lineup.team !== "TOR" ||
    !Number.isFinite(Date.parse(lineup.sourceUpdatedAt))
  )
    throw new Error("Lineup source metadata missing");
  if (Date.parse(lineup.sourceUpdatedAt) > Date.now() + 300000)
    throw new Error("Invalid lineup timestamp");
  const active = new Set(roster.map((p) => p.id)),
    ids = [];
  for (const group of REQUIRED) {
    const players = lineup.groups[group];
    if (players?.length !== SLOTS[group].length)
      throw new Error(`Incomplete lineup group: ${group}`);
    for (const p of players) {
      if (!active.has(p.id))
        throw new Error("Lineup player no longer on official roster");
      ids.push(p.id);
    }
  }
  if (new Set(ids).size !== 20)
    throw new Error("Duplicate player in starting lineup");
  return lineup;
}
export function parseDailyFaceoff(html, roster) {
  const $ = load(html),
    raw = JSON.parse($("#__NEXT_DATA__").text()).props?.pageProps?.combinations;
  if (raw?.teamAbbreviation !== "TOR" || !Array.isArray(raw.players))
    throw new Error("Lineup source format changed");
  const resolve = lookup(roster),
    groups = {};
  for (const [group, slots] of Object.entries(SLOTS)) {
    const source = raw.players.filter((p) => p.groupIdentifier === group);
    if (!source.length && !REQUIRED.includes(group)) continue;
    groups[group] = slots.map((slot) => {
      const entries = source.filter((p) => p.positionIdentifier === slot);
      if (entries.length !== 1)
        throw new Error(`Lineup slot missing or ambiguous: ${group}/${slot}`);
      const p = resolve(entries[0].name);
      return { id: p.id, name: p.name, slot };
    });
  }
  return validateLineup(
    {
      team: "TOR",
      status: "projected",
      sourceName: "Daily Faceoff",
      sourceUrl: DFO,
      reporter: raw.sourceName || null,
      reporterUrl: raw.source || null,
      sourceUpdatedAt: raw.updatedAt,
      groups,
    },
    roster,
  );
}
export function parseNhlLineup(html, roster, url, now = new Date()) {
  const $ = load(html);
  let article;
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).text());
      const items = Array.isArray(data)
        ? data
        : [data, ...(data["@graph"] || [])];
      article =
        items.find(
          (x) => x.articleBody && /NewsArticle|Article/.test(x["@type"]),
        ) || article;
    } catch {}
  });
  if (!article) throw new Error("NHL projected article unavailable");
  const stamp = article.dateModified || article.datePublished;
  if (easternDate(new Date(stamp)) !== easternDate(now))
    throw new Error("NHL projection article is not from today");
  const body = article.articleBody
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_]/g, "");
  const start = body.match(/Maple Leafs projected lineup/i);
  if (!start) throw new Error("Toronto not in NHL projection article");
  const lines = body
    .slice(start.index + start[0].length)
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const resolve = lookup(roster),
    groups = {};
  let index = 0;
  for (const group of REQUIRED) {
    const slots = SLOTS[group];
    if (group === "g") {
      groups.g = slots.map((slot) => {
        const p = resolve(lines[index++]);
        return { id: p.id, name: p.name, slot };
      });
    } else {
      const names = lines[index++].split(/\s+--\s+|\s+—\s+/);
      if (names.length !== slots.length)
        throw new Error("NHL projection layout changed");
      groups[group] = names.map((name, i) => {
        const p = resolve(name);
        return { id: p.id, name: p.name, slot: slots[i] };
      });
    }
  }
  return validateLineup(
    {
      team: "TOR",
      status: "projected",
      sourceName: "NHL.com projected lineups",
      sourceUrl: url,
      sourceUpdatedAt: stamp,
      groups,
    },
    roster,
  );
}
export async function getLineup(roster, season) {
  return cached(`lineup:${season}`, 900000, async () => {
    const failures = [];
    let lineup,
      mode = "automatic";
    if (process.env.LINEUP_SOURCE !== "manual") {
      try {
        lineup = parseDailyFaceoff(await permittedPage(DFO), roster);
      } catch (e) {
        failures.push("Daily Faceoff unavailable or could not be validated");
      }
      if (!lineup) {
        const label = `${String(season).slice(0, 4)}-${String(season).slice(6)}`,
          url = `https://www.nhl.com/news/nhl-lineup-projections-${label}-season`;
        try {
          lineup = parseNhlLineup(await permittedPage(url), roster, url);
        } catch {
          failures.push("A current NHL.com projection was not available");
        }
      }
    }
    if (!lineup) {
      mode = process.env.LINEUP_SOURCE === "manual" ? "manual" : "saved";
      try {
        lineup = validateLineup(
          JSON.parse(
            await readFile(
              new URL("../data/toronto-lineup.json", import.meta.url),
              "utf8",
            ),
          ),
          roster,
        );
      } catch {
        return envelope(
          {
            team: "TOR",
            status: "unavailable",
            groups: {},
            sourceName: "Official roster only",
            sourceUpdatedAt: null,
            mode: "roster",
          },
          "NHL roster",
          {
            warning:
              "Projected lines are unavailable. The official roster is shown without invented combinations.",
            stale: true,
          },
        );
      }
    }
    const stale =
      Date.now() - Date.parse(lineup.sourceUpdatedAt) > 36 * 3600000 ||
      (lineup.validUntil && Date.now() > Date.parse(lineup.validUntil));
    return envelope({ ...lineup, mode }, lineup.sourceName, {
      sourceUpdatedAt: lineup.sourceUpdatedAt,
      stale: !!stale,
      warning: stale
        ? "This projection is more than 36 hours old or has expired. It is not a current confirmed lineup."
        : mode === "saved"
          ? "Automatic lineup sources are unavailable. Showing the dated, last verified projection."
          : mode === "manual"
            ? "Manually maintained projection."
            : null,
      fallbackReasons: failures,
    });
  });
}
