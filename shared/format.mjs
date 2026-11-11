export const text = (value) =>
  typeof value === "string" ? value : (value?.default ?? value?.en ?? "");
export const number = (value) =>
  value === null ||
  value === undefined ||
  value === "" ||
  !Number.isFinite(Number(value))
    ? null
    : Number(value);
export const fullName = (p) =>
  [text(p?.firstName), text(p?.lastName)].filter(Boolean).join(" ") ||
  text(p?.name) ||
  "";
export const seasonLabel = (season) =>
  season
    ? `${String(season).slice(0, 4)}–${String(season).slice(6, 8)}`
    : "Season unavailable";
export const ageOn = (birthDate, now = new Date()) => {
  if (!birthDate) return null;
  const b = new Date(`${birthDate}T12:00:00Z`);
  if (Number.isNaN(b.getTime())) return null;
  return (
    now.getUTCFullYear() -
    b.getUTCFullYear() -
    (now.getUTCMonth() < b.getUTCMonth() ||
    (now.getUTCMonth() === b.getUTCMonth() && now.getUTCDate() < b.getUTCDate())
      ? 1
      : 0)
  );
};
export const clock = (seconds) =>
  seconds == null
    ? "—"
    : `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
export const format = (value, kind = "int") => {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    (typeof value === "number" && !Number.isFinite(value))
  )
    return "—";
  if (kind === "text") return String(value);
  if (kind === "pct") return `${(Number(value) * 100).toFixed(1)}%`;
  if (kind === "save") return Number(value).toFixed(3).replace(/^0/, "");
  if (kind === "decimal") return Number(value).toFixed(2);
  if (kind === "signed") return `${Number(value) > 0 ? "+" : ""}${value}`;
  if (kind === "time") return clock(Number(value));
  if (kind === "minutes") return (Number(value) / 60).toFixed(1);
  return Number(value).toLocaleString("en-CA", { maximumFractionDigits: 0 });
};
export function easternDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return ["year", "month", "day"]
    .map((k) => parts.find((p) => p.type === k).value)
    .join("-");
}
export function shiftDate(value, amount) {
  const d = new Date(`${value}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
}
export const dateLabel = (
  value,
  options = { month: "short", day: "numeric", year: "numeric" },
) =>
  value
    ? new Intl.DateTimeFormat("en-CA", options).format(
        new Date(value.length === 10 ? `${value}T12:00:00Z` : value),
      )
    : "Not supplied";
export const timestampLabel = (value) =>
  value
    ? `${new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(value))}`
    : "Unknown update time";
export const teamLogo = (abbrev) =>
  /^[A-Z]{2,3}$/.test(abbrev || "")
    ? `https://assets.nhle.com/logos/nhl/svg/${abbrev}_light.svg`
    : "";
export const headshot = (id) =>
  /^\d{7}$/.test(String(id))
    ? `https://assets.nhle.com/mugs/nhl/latest/${id}.png`
    : "";
export const positionLabel = (code) =>
  ({
    C: "CENTRE",
    L: "LEFT WING",
    LW: "LEFT WING",
    R: "RIGHT WING",
    RW: "RIGHT WING",
    D: "DEFENCE",
    G: "GOALTENDER",
    F: "FORWARD",
  })[code] ||
  code ||
  "PLAYER";
export const normalizeName = (name) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
