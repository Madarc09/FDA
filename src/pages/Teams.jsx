import React, { useState } from "react";
import { useResource } from "../services/api";
import { allCards, getCard, PlayerCard } from "../components/Card";
import {
  Icon,
  SafeImage,
  PageHeading,
  SourceNote,
  Loading,
  ErrorPanel,
} from "../components/UI";
import { teamLogo, timestampLabel } from "../../shared/format.mjs";
export function TeamDirectory() {
  const ctx = useResource({ resource: "context" });
  return (
    <main className="page-width page-main">
      <PageHeading
        eyebrow="THE COLLECTION ROOM"
        title="A league of"
        accent="their own."
        description="32 teams. Countless stories. The first Original Set collection begins in Toronto."
      />
      <a className="toronto-feature" href="/teams/toronto">
        <SafeImage src={teamLogo("TOR")} alt="Toronto Maple Leafs" />
        <div>
          <p className="eyebrow light">COLLECTION 01 · NOW OPEN</p>
          <h2>
            Toronto
            <br />
            <em>Maple Leafs.</em>
          </h2>
          <span className="button cream">
            Open the card lineup <Icon name="arrow" />
          </span>
        </div>
        <span className="feature-watermark">
          20
          <br />
          <small>PLAYER CARDS</small>
        </span>
      </a>
      <div className="section-title">
        <h2>
          The <em>league directory.</em>
        </h2>
        <span className="muted">Every team in the statistical ledger</span>
      </div>
      {ctx.error && !ctx.data ? (
        <ErrorPanel error={ctx.error} retry={ctx.refresh} />
      ) : !ctx.data ? (
        <Loading />
      ) : (
        <div className="team-directory">
          {ctx.data.teams.map((t) => (
            <a
              key={t.abbrev}
              href={
                t.abbrev === "TOR"
                  ? "/teams/toronto"
                  : `/stats/players?team=${t.abbrev}`
              }
            >
              <SafeImage src={t.logo} alt="" loading="lazy" />
              <div>
                <b>{t.name}</b>
                <small>
                  {t.abbrev === "TOR"
                    ? "ORIGINAL SET COLLECTION"
                    : "PLAYER STATISTICS"}
                </small>
              </div>
              <Icon name="arrow" />
            </a>
          ))}
        </div>
      )}
      <SourceNote meta={ctx.meta} error={ctx.error} />
    </main>
  );
}
const GROUPS = {
  forwards: ["f1", "f2", "f3", "f4"],
  defence: ["d1", "d2", "d3"],
  goalies: ["g"],
  powerplay: ["pp1", "pp2"],
  penaltykill: ["pk1", "pk2"],
};
const tabNames = {
  forwards: "FORWARDS",
  defence: "DEFENCE",
  goalies: "GOALTENDERS",
  powerplay: "POWER PLAY",
  penaltykill: "PENALTY KILL",
};
const groupLabel = {
  f1: "FIRST LINE",
  f2: "SECOND LINE",
  f3: "THIRD LINE",
  f4: "FOURTH LINE",
  d1: "FIRST PAIRING",
  d2: "SECOND PAIRING",
  d3: "THIRD PAIRING",
  g: "BETWEEN THE PIPES",
  pp1: "FIRST UNIT",
  pp2: "SECOND UNIT",
  pk1: "FIRST UNIT",
  pk2: "SECOND UNIT",
};
export function Toronto({ onPlayer }) {
  const lineup = useResource({ resource: "lineup" }, { poll: 900000 }),
    roster = useResource({ resource: "roster" }),
    [tab, setTab] = useState("forwards");
  const players = new Map((roster.data || []).map((p) => [p.id, p])),
    line = lineup.data;
  const valid = line && Object.keys(line.groups || {}).length > 0;
  const have = valid ? GROUPS[tab].filter((k) => line.groups[k]?.length) : [];
  const stale = lineup.meta?.stale || line?.mode === "saved";
  return (
    <main className="team-page">
      <header className="toronto-hero">
        <div className="page-width toronto-heading">
          <div>
            <a href="/teams" className="breadcrumb">
              THE COLLECTION ROOM <Icon name="right" size={12} /> TORONTO
            </a>
            <p className="eyebrow light">THE ORIGINAL SET · COLLECTION 01</p>
            <h1>
              Toronto
              <br />
              <em>Maple Leafs.</em>
            </h1>
            <p>
              Blue & white. Red, navy & cream.
              <br />
              The lineup, reimagined as a collection.
            </p>
          </div>
          <SafeImage
            src={teamLogo("TOR")}
            alt="Toronto Maple Leafs"
            className="toronto-crest"
          />
          <div className="collection-seal">
            <b>20</b>
            <span>
              PLAYER CARDS
              <br />
              FIRST EDITION
            </span>
          </div>
        </div>
      </header>
      <div className="page-width">
        <div className={`lineup-source ${stale ? "outdated" : ""}`}>
          <div>
            <span className="source-dot" />
            <b>
              {!line
                ? "CHECKING LINEUP"
                : line.status === "unavailable"
                  ? "OFFICIAL ROSTER"
                  : stale
                    ? "DATED PROJECTION"
                    : "PROJECTED LINEUP"}
            </b>
            <span>
              {" "}
              · {line?.sourceName || "Checking lineup sources"}
              {line?.sourceUpdatedAt &&
                ` · Updated ${timestampLabel(line.sourceUpdatedAt)}`}
            </span>
            {line?.reporter && <span> · {line.reporter}</span>}
          </div>
          <div className="source-actions">
            {line?.sourceUrl && (
              <a href={line.sourceUrl} target="_blank" rel="noreferrer">
                View source <Icon name="external" size={13} />
              </a>
            )}
            <button
              onClick={() => {
                lineup.refresh();
                roster.refresh();
              }}
              disabled={lineup.loading}
              className="icon-button"
              aria-label="Refresh projected lineup"
            >
              <Icon name="refresh" />
            </button>
          </div>
        </div>
        {(lineup.meta?.warning || lineup.error || roster.meta?.warning) && (
          <div className="lineup-warning" role="status">
            {lineup.error
              ? "Automatic lineup refresh failed. Any displayed projection retains its original update time."
              : lineup.meta?.warning}
            {roster.meta?.warning && ` ${roster.meta.warning}`}
          </div>
        )}
        <div className="lineup-toolbar">
          <nav aria-label="Lineup units" className="unit-tabs">
            {Object.keys(GROUPS).map((t) => (
              <button
                onClick={() => setTab(t)}
                className={tab === t ? "active" : ""}
                key={t}
                aria-pressed={tab === t}
              >
                {tabNames[t]}
              </button>
            ))}
          </nav>
          <span className="flip-hint">
            <Icon name="flip" /> TAP A CARD TO FLIP
          </span>
        </div>
        {!roster.data ? (
          roster.error ? (
            <ErrorPanel error={roster.error} retry={roster.refresh} />
          ) : (
            <Loading label="Opening the Toronto collection…" />
          )
        ) : !line && lineup.loading ? (
          <Loading label="Checking the projected line combinations…" />
        ) : valid ? (
          <div className="lineup-collection">
            {have.length ? (
              have.map((key, index) => (
                <section className={`line-unit unit-${key[0]}`} key={key}>
                  <div className="line-unit-heading">
                    <span className="line-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h2>{groupLabel[key]}</h2>
                    <span>
                      {key === "g"
                        ? "PROJECTED ORDER · STARTER NOT CONFIRMED"
                        : tab === "powerplay"
                          ? "5 SKATERS"
                          : tab === "penaltykill"
                            ? "4 SKATERS"
                            : key.startsWith("d")
                              ? "LD / RD"
                              : "LW / C / RW"}
                    </span>
                  </div>
                  <div
                    className={`line-cards count-${line.groups[key].length}`}
                  >
                    {line.groups[key].map((slot, i) => {
                      const p = players.get(slot.id);
                      return p ? (
                        <div
                          className="line-card-slot"
                          key={`${key}-${slot.id}`}
                        >
                          <div className="slot-label">
                            <span>
                              {key === "g"
                                ? i === 0
                                  ? "PROJECTED STARTER"
                                  : "BACKUP"
                                : slot.slot
                                    .toUpperCase()
                                    .replace("SK", "SKATER ")}
                            </span>
                            <span>
                              #{getCard(p.id)?.sweaterNumber ?? p.number ?? "—"}
                            </span>
                          </div>
                          <PlayerCard player={p} onEnlarge={onPlayer} />
                        </div>
                      ) : (
                        <div className="missing-player" key={slot.id}>
                          Player identity unavailable. Refresh the lineup.
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))
            ) : (
              <div className="empty-state">
                <h3>No {tabNames[tab].toLowerCase()} units in this source.</h3>
                <p>Only reported combinations are displayed.</p>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="lineup-warning">
              Current projected combinations could not be verified. These are
              roster cards, without assigned line positions.
            </div>
            <div className="roster-card-grid">
              {roster.data
                .filter((p) =>
                  tab === "goalies"
                    ? p.position === "G"
                    : tab === "defence"
                      ? p.position === "D"
                      : !["D", "G"].includes(p.position),
                )
                .map((p) => (
                  <PlayerCard key={p.id} player={p} onEnlarge={onPlayer} />
                ))}
            </div>
          </>
        )}
        <div className="collection-colophon">
          <span>THE ORIGINAL SET</span>
          <p>
            Projected combinations can change before puck drop. Player identity
            and biography come from the NHL. Select any card to flip it; open
            the player file for the full career ledger.
          </p>
          <span>
            TORONTO
            <br />
            FIRST EDITION
          </span>
        </div>
        <SourceNote meta={roster.meta} error={roster.error} />
      </div>
    </main>
  );
}
