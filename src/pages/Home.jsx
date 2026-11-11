import React from "react";
import { useResource } from "../services/api";
import { allCards, PlayerCard, getCard } from "../components/Card";
import { Icon, SafeImage, SourceNote, Loading } from "../components/UI";
import { ScoreStrip, scorePoll } from "../components/Scores";
import { sortRows } from "../../shared/stat-columns.mjs";
import { format, seasonLabel, teamLogo } from "../../shared/format.mjs";
function Leaders({ title, metric, rows, kind, loading, onPlayer }) {
  return (
    <section className="leader-column">
      <div className="leader-heading">
        <h3>{title}</h3>
        <span>
          {metric === "savePct"
            ? "SV% · MIN 5 GP"
            : metric === "goals"
              ? "GOALS"
              : "POINTS"}
        </span>
      </div>
      {loading && !rows.length ? (
        <Loading label="Reading the leaders…" />
      ) : (
        rows.map((p, i) => (
          <button
            className="leader-row"
            onClick={() => onPlayer(p.id)}
            key={p.id}
          >
            <span className="leader-rank">
              {String(i + 1).padStart(2, "0")}
            </span>
            <SafeImage src={p.headshot} alt="" loading="lazy" />
            <span className="leader-name">
              <b>{p.name}</b>
              <small>
                {p.team} · {p.gamesPlayed} GP
              </small>
            </span>
            <strong>{format(p[metric], kind)}</strong>
          </button>
        ))
      )}
      {!loading && !rows.length && (
        <p className="muted">Leaders unavailable from the source.</p>
      )}
    </section>
  );
}
export default function Home({ onPlayer }) {
  const scores = useResource(
    { resource: "scores", date: "now" },
    { poll: scorePoll },
  );
  const skaters = useResource({ resource: "stats", kind: "skater" }),
    goalies = useResource({ resource: "stats", kind: "goalie" });
  const featured = getCard(8479318),
    player = {
      id: featured.playerId,
      name: featured.displayName,
      firstName: featured.firstName,
      lastName: featured.lastName,
      position: featured.position,
      number: featured.sweaterNumber,
      team: "TOR",
    };
  const points = sortRows(skaters.data?.rows || [], "points").slice(0, 3),
    goals = sortRows(skaters.data?.rows || [], "goals").slice(0, 3),
    saves = sortRows(
      (goalies.data?.rows || []).filter((p) => p.gamesPlayed >= 5),
      "savePct",
    ).slice(0, 3);
  return (
    <>
      <section className="home-hero">
        <div className="arena-lights" />
        <div className="hero-inner page-width">
          <div className="hero-copy">
            <p className="eyebrow light">
              <span className="tiny-rule" /> THE ORIGINAL SET / FIRST EDITION
            </p>
            <h1>
              The game.
              <br />
              <em>In your hands.</em>
            </h1>
            <p className="hero-description">
              The players you know. The cards you’ll remember.
              <br className="desktop-break" /> A new home for an old love of
              hockey.
            </p>
            <div className="hero-actions">
              <a className="button red" href="/teams/toronto">
                Explore the Toronto set <Icon name="arrow" />
              </a>
              <a className="quiet-link" href="/scores">
                <span className="live-dot" /> Follow the games
              </a>
            </div>
            <div className="hero-edition">
              <span>
                <b>{allCards.length}</b> PLAYER CARDS
              </span>
              <i />
              <span>
                <b>01</b> ORIGINAL COLLECTION
              </span>
              <span className="edition-stamp">
                TORONTO
                <br />
                <strong>FIRST EDITION</strong>
              </span>
            </div>
          </div>
          <div className="hero-collection">
            <div className="ghost-card ghost-one" />
            <div className="ghost-card ghost-two" />
            <div className="featured-card">
              <PlayerCard
                player={player}
                card={featured}
                featured
                onEnlarge={onPlayer}
              />
            </div>
            <span className="hero-annotation">
              <Icon name="flip" /> Go on. Turn it over.
            </span>
            <span className="hero-index">No. 034 / AUSTON MATTHEWS</span>
          </div>
        </div>
        <div className="hero-bottomline">
          <span>REAL PLAYERS. REAL RECORDS. ORIGINAL CHARACTER.</span>
          <span>HOCKEY, WORTH HOLDING ON TO.</span>
        </div>
      </section>
      <div className="page-width">
        <ScoreStrip resource={scores} />
      </div>
      <section className="collection-intro page-width">
        <div className="intro-art">
          <SafeImage src={teamLogo("TOR")} alt="Toronto Maple Leafs" />
          <span className="vertical-caption">TORONTO • ONTARIO • CANADA</span>
          <span className="intro-number">01</span>
        </div>
        <div className="intro-copy">
          <p className="eyebrow">THE FIRST CHAPTER</p>
          <h2>
            Forever
            <br />
            <em>blue & white.</em>
          </h2>
          <p>
            Four forward lines. Three defensive pairings. Two goaltenders.
            Discover Toronto’s projected lineup, one beautifully worn card at a
            time.
          </p>
          <a href="/teams/toronto" className="ink-link">
            Open the collection <Icon name="arrow" />
          </a>
        </div>
        <div className="ticket-note">
          <span className="ticket-kicker">YOUR ADMISSION TO</span>
          <strong>
            THE
            <br />
            ORIGINAL
            <br />
            SET.
          </strong>
          <div className="ticket-perforation" />
          <span>
            BUILT FOR THE LOVE
            <br />
            OF THE GAME.
          </span>
          <span className="ticket-star">✦</span>
        </div>
      </section>
      <section className="leaders-section">
        <div className="page-width">
          <div className="section-title">
            <div>
              <p className="eyebrow">THE NAMES MAKING NOISE</p>
              <h2>
                Leading <em>the league.</em>
              </h2>
            </div>
            <a className="ink-link" href="/stats/players">
              The complete ledger <Icon name="arrow" />
            </a>
          </div>
          <p className="season-label">
            {seasonLabel(skaters.meta?.season)} · NHL regular season
          </p>
          <div className="leaders-grid">
            <Leaders
              title="Point producers"
              metric="points"
              rows={points}
              loading={skaters.loading}
              onPlayer={onPlayer}
            />
            <Leaders
              title="Goal scorers"
              metric="goals"
              rows={goals}
              loading={skaters.loading}
              onPlayer={onPlayer}
            />
            <Leaders
              title="Last line of defence"
              metric="savePct"
              kind="save"
              rows={saves}
              loading={goalies.loading}
              onPlayer={onPlayer}
            />
          </div>
          <SourceNote meta={skaters.meta} error={skaters.error} />
          <SourceNote meta={goalies.meta} error={goalies.error} />
        </div>
      </section>
      <section className="closing-banner page-width">
        <p className="eyebrow light">EVERY GAME HAS A STORY.</p>
        <h2>
          Keep the <em>good ones.</em>
        </h2>
        <a href="/teams/toronto" className="button cream">
          Meet the Original Set <Icon name="arrow" />
        </a>
      </section>
    </>
  );
}
