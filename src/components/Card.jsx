import React, { useState } from "react";
import collection from "../../data/collection.json";
import { useResource } from "../services/api";
import {
  ageOn,
  dateLabel,
  format,
  positionLabel,
  seasonLabel,
  teamLogo,
} from "../../shared/format.mjs";
import { Icon, SafeImage, Modal, Loading, ErrorPanel, SourceNote } from "./UI";
import "../styles/card.css";
const cardMap = new Map(collection.cards.map((c) => [c.playerId, c]));
export const getCard = (id) => cardMap.get(Number(id));
export const allCards = collection.cards;
export function HistoryTable({ player, limit = 5 }) {
  const goalie = player.position === "G",
    rows = player.history || [],
    shown = limit ? rows.slice(0, limit) : rows;
  const cols = goalie
    ? [
        ["gamesPlayed", "GP"],
        ["wins", "W"],
        ["savePctg", "SV%", "save"],
        ["goalsAgainstAvg", "GAA", "decimal"],
        ["shutouts", "SO"],
      ]
    : [
        ["gamesPlayed", "GP"],
        ["goals", "G"],
        ["assists", "A"],
        ["points", "PTS"],
        ["plusMinus", "+/−", "signed"],
      ];
  return (
    <table className="card-history">
      <thead>
        <tr>
          <th>SEASON / TEAM</th>
          {cols.map(([key, label]) => (
            <th key={key}>{label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {shown.map((s, i) => (
          <tr key={`${s.season}-${i}`}>
            <td>
              <b>{seasonLabel(s.season)}</b>
              <span>{s.teamName}</span>
            </td>
            {cols.map(([key, , kind]) => (
              <td key={key}>{format(s[key], kind)}</td>
            ))}
          </tr>
        ))}
        {!rows.length && (
          <tr>
            <td colSpan={cols.length + 1}>
              No NHL regular-season history returned.
            </td>
          </tr>
        )}
      </tbody>
      <tfoot>
        <tr>
          <th>NHL CAREER</th>
          {cols.map(([key, , kind]) => (
            <td key={key}>{format(player.career?.[key], kind)}</td>
          ))}
        </tr>
      </tfoot>
    </table>
  );
}
function CardBack({ player, meta, loading, error, dataMeta }) {
  const height = player.height
    ? `${Math.floor(player.height / 12)}′ ${player.height % 12}″`
    : null;
  return (
    <>
      <div className="back-top">
        <SafeImage
          src={meta?.backAsset || player.headshot}
          alt={`${player.name}, official portrait`}
          className="back-portrait"
          loading="lazy"
          fallback={player.lastName?.[0]}
        />
        <div>
          <span className="micro-label">
            PLAYER FILE / {meta?.printEdition || "LEAGUE ARCHIVE"}
          </span>
          <h3>{player.name}</h3>
          <span className="back-team">
            {meta?.teamName || player.teamName || player.team} · #
            {meta?.sweaterNumber ?? player.number ?? "—"}
          </span>
          <b>{positionLabel(player.position)}</b>
        </div>
      </div>
      <dl className="card-bio">
        {[
          ["HEIGHT", height],
          ["WEIGHT", player.weight ? `${player.weight} lb` : null],
          [
            player.position === "G" ? "CATCHES" : "SHOOTS",
            { L: "Left", R: "Right" }[player.hand],
          ],
          ["AGE", ageOn(player.birthDate)],
          ["BORN", player.birthDate ? dateLabel(player.birthDate) : null],
          ["BIRTHPLACE", player.birthplace],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value ?? "—"}</dd>
          </div>
        ))}
      </dl>
      <div className="back-rule">
        THE RECORD BOOK <span>NHL · REGULAR SEASON</span>
      </div>
      {loading && !player.history ? (
        <div className="card-data-status">Reading official player history…</div>
      ) : error && !player.history ? (
        <div className="card-data-status">
          Player history is temporarily unavailable. Open the player file to
          retry.
        </div>
      ) : (
        <HistoryTable player={player} />
      )}
      <div className="back-footer">
        <span>
          {meta?.id || `NHL-${player.id}`}
          <br />
          {dataMeta?.stale
            ? `Saved NHL data · ${dateLabel(dataMeta.fetchedAt)}`
            : meta?.distinctPhotos === false
              ? "Portrait edition · one verified photograph"
              : "Official NHL player photography"}
        </span>
        <span>↶ TAP TO RETURN</span>
      </div>
    </>
  );
}
export function PlayerCard({
  player,
  card = getCard(player?.id),
  onEnlarge,
  featured = false,
  initialBack = false,
  className = "",
}) {
  const [flipped, setFlipped] = useState(initialBack),
    [activated, setActivated] = useState(initialBack);
  const detail = useResource(
    activated ? { resource: "player", id: player.id } : null,
  );
  const p = detail.data || player,
    art = card,
    front = art?.frontAsset || p.headshot,
    mode = art?.photoMode || "portrait";
  const flip = () => {
    setActivated(true);
    setFlipped((v) => !v);
  };
  const name = art?.displayName || p.name;
  const first =
      art?.firstName || p.firstName || name?.split(" ").slice(0, -1).join(" "),
    last = art?.lastName || p.lastName || name?.split(" ").at(-1);
  return (
    <div
      className={`card-unit ${className}`}
      style={
        art?.frameAsset
          ? { "--card-frame": `url("${art.frameAsset}")` }
          : undefined
      }
    >
      <div
        className={`trading-card ${flipped ? "is-flipped" : ""}`}
        role="button"
        tabIndex={0}
        aria-label={`Flip ${name} card to ${flipped ? "front" : "back"}`}
        aria-pressed={flipped}
        onClick={flip}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            flip();
          }
        }}
        data-player-id={player.id}
        data-face={flipped ? "back" : "front"}
      >
        <div className="card-rotator">
          <div className="card-face card-front" aria-hidden={flipped}>
            <div className="card-edition">
              {art?.setTitle || "NHL PLAYER FILE"}
              <span>{art?.printEdition || "OFFICIAL PORTRAIT"}</span>
            </div>
            <div className={`card-photo-window ${mode}`}>
              <SafeImage
                className="card-player-photo"
                src={front}
                alt={`${name} ${mode === "action" ? "in action" : "portrait"}`}
                loading={featured ? "eager" : "lazy"}
                fetchPriority={featured ? "high" : "auto"}
                fallback={last?.[0]}
              />
              <span className="photo-ink" />
            </div>
            <span className="card-number">
              {art?.sweaterNumber ?? p.number ?? "—"}
            </span>
            <SafeImage
              className="card-team-mark"
              src={art?.teamLogoAsset || teamLogo(p.team)}
              alt={art?.teamName || p.team}
              loading="lazy"
            />
            <div
              className={`card-nameplate ${last?.length > 11 ? "long-name" : ""}`}
            >
              <span>{first}</span>
              <strong>{last}</strong>
            </div>
            <div className="card-position">
              {positionLabel(art?.position || p.position)}
              <span>{art?.issuedForTeam || p.team}</span>
            </div>
            <div className="card-bottom">
              <b>
                {art?.teamName ||
                  p.teamName ||
                  p.team ||
                  "NATIONAL HOCKEY LEAGUE"}
              </b>
              <span>
                {art
                  ? `COLLECTION No. ${art.collectionNumber}`
                  : "LEAGUE ARCHIVE"}{" "}
                <i>✦</i> TAP TO FLIP
              </span>
            </div>
            <span className="card-shine" />
          </div>
          <div className="card-face card-back" aria-hidden={!flipped}>
            <CardBack
              player={p}
              meta={art}
              loading={activated && !detail.data && !detail.error}
              error={detail.error}
              dataMeta={detail.meta}
            />
            <span className="card-shine" />
          </div>
        </div>
      </div>
      {onEnlarge && (
        <button
          className="card-expand"
          onClick={() => onEnlarge(player.id)}
          aria-label={`Enlarge ${name} card`}
        >
          <span>OPEN PLAYER FILE</span>
          <Icon name="expand" size={14} />
        </button>
      )}
    </div>
  );
}
export function PlayerModal({ id, onClose }) {
  const detail = useResource({ resource: "player", id });
  const card = getCard(id),
    p = detail.data;
  return (
    <Modal
      onClose={onClose}
      label={`${p?.name || "Player"} card and career history`}
      wide
    >
      {p ? (
        <div className="player-file">
          <div className="player-file-card">
            <PlayerCard player={p} card={card} />
            <p className="card-instruction">
              <Icon name="flip" /> Select the card to turn it over.
            </p>
          </div>
          <div className="player-file-copy">
            <p className="eyebrow">
              {card
                ? "The Original Set · Toronto edition"
                : "The league archive · Official NHL portrait"}
            </p>
            <h2>{p.name}</h2>
            <p className="player-file-sub">
              {p.teamName || p.team} · {positionLabel(p.position)} · #
              {p.number ?? "—"}
            </p>
            <div className="file-bio">
              <span>
                <small>Born</small>
                {p.birthDate ? dateLabel(p.birthDate) : "—"}
                {ageOn(p.birthDate) != null && ` · ${ageOn(p.birthDate)} years`}
              </span>
              <span>
                <small>Hometown</small>
                {p.birthplace || "Not supplied"}
              </span>
              <span>
                <small>Measures</small>
                {p.height
                  ? `${Math.floor(p.height / 12)}′ ${p.height % 12}″`
                  : "—"}{" "}
                · {p.weight ? `${p.weight} lb` : "—"} ·{" "}
                {p.hand === "L" ? "Left" : p.hand === "R" ? "Right" : "—"}{" "}
                {p.position === "G" ? "catch" : "shot"}
              </span>
              {p.draft && (
                <span>
                  <small>NHL draft</small>
                  {p.draft.year} · Round {p.draft.round} · Pick{" "}
                  {p.draft.overallPick}
                </span>
              )}
            </div>
            <h3 className="ledger-title">
              The career ledger <span>REGULAR SEASON</span>
            </h3>
            <div
              className="full-history-scroll"
              tabIndex={0}
              role="region"
              aria-label="Complete NHL career history"
            >
              <HistoryTable player={p} limit={null} />
            </div>
            <SourceNote meta={detail.meta} error={detail.error} />
            {card && (
              <p className="edition-note">
                The {card.edition} card retains its original Toronto identity
                and artwork. Biography and statistical history update
                separately.
                {!card.distinctPhotos &&
                  " A second verified player photograph was unavailable; both sides use the same official portrait."}
              </p>
            )}
            {!card && (
              <p className="edition-note">
                League player file. This player has not been issued a curated
                Original Set card.
              </p>
            )}
          </div>
        </div>
      ) : detail.error ? (
        <ErrorPanel error={detail.error} retry={detail.refresh} />
      ) : (
        <Loading label="Opening the player file…" />
      )}
    </Modal>
  );
}
