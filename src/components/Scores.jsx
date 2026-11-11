import React from "react";
import { Icon, SafeImage, SourceNote, Loading, ErrorPanel } from "./UI";
import { isLive } from "../../shared/normalize.mjs";
import { dateLabel } from "../../shared/format.mjs";
export function gameStatus(g) {
  if (g.scheduleState === "PPD") return "POSTPONED";
  if (g.scheduleState === "CNCL") return "CANCELLED";
  if (["FINAL", "OFF"].includes(g.state))
    return `FINAL${g.outcome && g.outcome !== "REG" ? ` / ${g.outcome}` : ""}`;
  if (isLive(g.state))
    return g.intermission
      ? `INTERMISSION · ${g.period}`
      : `${g.periodType === "OT" ? "OT" : g.periodType === "SO" ? "SO" : `P${g.period}`} · ${g.clock || "LIVE"}`;
  return g.startTime
    ? new Intl.DateTimeFormat("en-CA", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/Toronto",
        timeZoneName: "short",
      }).format(new Date(g.startTime))
    : "TIME TBA";
}
export function ScoreTile({ game: g, compact = false }) {
  return (
    <a
      className={`score-tile ${isLive(g.state) ? "live" : ""} ${compact ? "compact" : ""}`}
      href={`/scores/${g.id}`}
      aria-label={`${g.away.abbrev} ${g.away.score ?? ""} at ${g.home.abbrev} ${g.home.score ?? ""}, ${gameStatus(g)}`}
    >
      <div className="score-status">
        <span>
          {isLive(g.state) && <i />}
          {gameStatus(g)}
        </span>
        <Icon name="arrow" size={14} />
      </div>
      {["away", "home"].map((side) => (
        <div className="score-team" key={side}>
          <SafeImage src={g[side].logo} alt="" loading="lazy" />
          <span>
            {g[side].abbrev}
            {g[side].situations.includes("PP") && (
              <small className="pp-badge">PP</small>
            )}
          </span>
          <b key={g[side].score}>{g[side].score ?? "—"}</b>
          {!compact && (
            <small>{g[side].shots == null ? "" : `${g[side].shots} SOG`}</small>
          )}
        </div>
      ))}
    </a>
  );
}
export function ScoreStrip({ resource }) {
  const { data, loading, error, refresh, meta } = resource;
  return (
    <section className="score-strip">
      <div className="score-strip-label">
        <span className="eyebrow">AROUND THE RINK</span>
        <b>
          {data?.date && data.date !== "now"
            ? dateLabel(data.date, { month: "short", day: "numeric" })
            : "NHL scores"}
        </b>
        <a href="/scores">
          All games <Icon name="arrow" size={14} />
        </a>
      </div>
      <div className="score-strip-games">
        {data?.games.length ? (
          data.games
            .slice(0, 4)
            .map((g) => <ScoreTile game={g} compact key={g.id} />)
        ) : loading ? (
          <Loading label="Checking the scoreboards…" />
        ) : error ? (
          <button onClick={refresh} className="text-button">
            Scores unavailable · retry
          </button>
        ) : (
          <p>No games scheduled for this date.</p>
        )}
      </div>
      {error && data && (
        <span className="strip-warning">Scores may be out of date</span>
      )}
    </section>
  );
}
export const scorePoll = (data) =>
  data?.games?.some((g) => isLive(g.state)) ? 30000 : 120000;
