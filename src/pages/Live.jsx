import React, { useEffect, useRef, useState } from "react";
import { useResource } from "../services/api";
import {
  Icon,
  SafeImage,
  PageHeading,
  SourceNote,
  Loading,
  ErrorPanel,
} from "../components/UI";
import { ScoreTile, gameStatus, scorePoll } from "../components/Scores";
import { isLive } from "../../shared/normalize.mjs";
import {
  dateLabel,
  easternDate,
  shiftDate,
  format,
  teamLogo,
} from "../../shared/format.mjs";
export function LiveScores() {
  const [date, setDate] = useState(
      () => new URLSearchParams(location.search).get("date") || easternDate(),
    ),
    scores = useResource({ resource: "scores", date }, { poll: scorePoll });
  const games = scores.data?.games || [],
    live = games.filter((g) => isLive(g.state)),
    final = games.filter((g) => ["OFF", "FINAL"].includes(g.state));
  return (
    <main className="page-width page-main live-page">
      <PageHeading
        eyebrow="FROM EVERY NHL RINK"
        title="The live"
        accent="scoreboard."
        description="Every goal. Every period. Every game on the night."
      >
        <div className="on-air">
          <i />
          {live.length
            ? `${live.length} GAME${live.length === 1 ? "" : "S"} LIVE`
            : "NHL GAME CENTRE"}
        </div>
      </PageHeading>
      <div className="scoreboard-controls">
        <div className="date-switch">
          <button
            onClick={() => setDate(shiftDate(date, -1))}
            aria-label="Previous game date"
          >
            <Icon name="left" />
          </button>
          <label>
            <Icon name="calendar" />
            <input
              type="date"
              value={date}
              onChange={(e) => {
                if (e.target.value) setDate(e.target.value);
              }}
              aria-label="Choose game date"
            />
          </label>
          <button
            onClick={() => setDate(shiftDate(date, 1))}
            aria-label="Next game date"
          >
            <Icon name="right" />
          </button>
        </div>
        <button className="text-button" onClick={() => setDate(easternDate())}>
          Today
        </button>
        <button
          className="button small outline"
          onClick={scores.refresh}
          disabled={scores.loading}
        >
          <Icon name="refresh" />
          Refresh scores
        </button>
      </div>
      <div className="scoreboard-date">
        <h2>
          {dateLabel(date, { weekday: "long", month: "long", day: "numeric" })}
        </h2>
        <span>
          {games.length} GAMES <b>·</b> {final.length} FINAL
        </span>
      </div>
      {!scores.data ? (
        scores.error ? (
          <ErrorPanel error={scores.error} retry={scores.refresh} />
        ) : (
          <Loading label="Checking in with every rink…" />
        )
      ) : games.length ? (
        <div className="scoreboard-grid">
          {games.map((g) => (
            <ScoreTile key={g.id} game={g} />
          ))}
        </div>
      ) : (
        <div className="empty-state off-night">
          <span className="empty-puck" />
          <p className="eyebrow">A QUIET NIGHT AT THE RINK</p>
          <h2>No games scheduled.</h2>
          <p>Choose another date to explore the NHL schedule.</p>
          <button
            className="button small"
            onClick={() => setDate(shiftDate(date, 1))}
          >
            Next day <Icon name="right" />
          </button>
        </div>
      )}
      <SourceNote meta={scores.meta} error={scores.error} />
      <p className="table-footnote">
        Live games refresh about every 30 seconds while this tab is visible.
        Start times are shown in Toronto time. The clock reflects the latest
        official update.
      </p>
    </main>
  );
}
function AnimatedScore({ value }) {
  const ref = useRef(),
    old = useRef(value);
  useEffect(() => {
    if (
      old.current !== value &&
      old.current != null &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      ref.current?.animate(
        [
          { color: "#d69e65", transform: "scale(1.12)" },
          { color: "#f4e7ce", transform: "scale(1)" },
        ],
        { duration: 650 },
      );
    old.current = value;
  }, [value]);
  return (
    <strong ref={ref} className="big-score">
      {value ?? "—"}
    </strong>
  );
}
function GoalieSide({ players, team, onPlayer }) {
  return (
    <div className="goalie-side">
      <p className="eyebrow">{team} GOALTENDING</p>
      {players?.length ? (
        players.map((g) => (
          <button
            className="goalie-player"
            key={g.id}
            onClick={() => onPlayer(g.id)}
          >
            <SafeImage src={g.headshot} alt="" loading="lazy" />
            <div>
              <h3>{g.name}</h3>
              <span className={`goalie-status ${g.starter ? "confirmed" : ""}`}>
                {g.status}
              </span>
              <div className="goalie-numbers">
                {g.pregame ? (
                  <span>
                    Pregame availability · starting assignment unconfirmed
                  </span>
                ) : (
                  <>
                    <span>
                      <b>
                        {g.saves ?? "—"}/{g.shotsAgainst ?? "—"}
                      </b>{" "}
                      SV / SA
                    </span>
                    <span>
                      <b>{format(g.savePct, "save")}</b> SV%
                    </span>
                    <span>
                      <b>{g.goalsAgainst ?? "—"}</b> GA
                    </span>
                    <span>
                      <b>{g.toi || "—"}</b> TOI
                    </span>
                  </>
                )}
              </div>
            </div>
            <Icon name="arrow" size={16} />
          </button>
        ))
      ) : (
        <p className="muted">Goalie assignments have not been supplied.</p>
      )}
    </div>
  );
}
const comparisonNames = {
  sog: "SHOTS ON GOAL",
  faceoffWinningPctg: "FACEOFF %",
  faceoffWins: "FACEOFFS WON",
  powerPlay: "POWER PLAY",
  powerPlayPctg: "POWER PLAY %",
  pim: "PENALTY MINUTES",
  hits: "HITS",
  blockedShots: "BLOCKED SHOTS",
  giveaways: "GIVEAWAYS",
  takeaways: "TAKEAWAYS",
};
export function GameDetails({ id, onPlayer }) {
  const game = useResource(
      { resource: "game", id },
      { poll: (d) => (isLive(d?.state) ? 30000 : 120000) },
    ),
    g = game.data;
  if (!g)
    return (
      <main className="page-width page-main">
        <a href="/scores" className="breadcrumb">
          <Icon name="left" /> ALL SCORES
        </a>
        {game.error ? (
          <ErrorPanel error={game.error} retry={game.refresh} />
        ) : (
          <Loading label="Tuning in to the game…" />
        )}
      </main>
    );
  const live = isLive(g.state),
    pregame = !["LIVE", "CRIT", "FINAL", "OFF"].includes(g.state);
  return (
    <main className="game-page">
      <div className="page-width">
        <div className="game-topline">
          <a href={`/scores?date=${g.date}`} className="breadcrumb">
            <Icon name="left" size={15} /> BACK TO SCORES
          </a>
          <span>
            {dateLabel(g.date)} · {g.venue}
          </span>
          <button
            className="text-button"
            disabled={game.loading}
            onClick={game.refresh}
          >
            <Icon name="refresh" size={15} /> Refresh
          </button>
        </div>
        <section className="broadcast-board">
          <div className="broadcast-status">
            <span className={live ? "live-indicator" : ""}>
              {live && <i />}
              {gameStatus(g)}
            </span>
            <span>THE ORIGINAL SET / GAME CENTRE</span>
          </div>
          <div className="broadcast-matchup">
            <div className="broadcast-team">
              <SafeImage src={g.away.logo} alt={g.away.name} />
              <h1>{g.away.abbrev}</h1>
              <p>{g.away.name}</p>
              <span>
                AWAY{g.away.shots != null ? ` · ${g.away.shots} SHOTS` : ""}
              </span>
            </div>
            <div className="broadcast-score">
              <div>
                <AnimatedScore value={g.away.score} />
                <span>:</span>
                <AnimatedScore value={g.home.score} />
              </div>
              <p>
                {pregame
                  ? "PUCK DROP"
                  : g.intermission
                    ? "INTERMISSION"
                    : g.periodType === "OT"
                      ? "OVERTIME"
                      : g.periodType === "SO"
                        ? "SHOOTOUT"
                        : `PERIOD ${g.period || "—"}`}
              </p>
              <b>
                {pregame
                  ? gameStatus(g)
                  : g.clock ||
                    (["OFF", "FINAL"].includes(g.state) ? "FINAL" : "—")}
              </b>
            </div>
            <div className="broadcast-team">
              <SafeImage src={g.home.logo} alt={g.home.name} />
              <h1>{g.home.abbrev}</h1>
              <p>{g.home.name}</p>
              <span>
                HOME{g.home.shots != null ? ` · ${g.home.shots} SHOTS` : ""}
              </span>
            </div>
          </div>
          <div className="broadcast-bottom">
            {live && g.situationKnown ? (
              <>
                <span>
                  {g.away.abbrev}:{" "}
                  {g.away.situations.length
                    ? g.away.situations.join(" · ")
                    : "No advantage reported"}
                </span>
                <b>{g.situationClock || "LIVE SITUATION"}</b>
                <span>
                  {g.home.abbrev}:{" "}
                  {g.home.situations.length
                    ? g.home.situations.join(" · ")
                    : "No advantage reported"}
                </span>
              </>
            ) : (
              <span>
                {live
                  ? "Live penalty / manpower status is not supplied by this update."
                  : pregame
                    ? "Starting assignments remain unconfirmed unless explicitly reported by the NHL."
                    : "OFFICIAL NHL GAME SUMMARY"}
              </span>
            )}
          </div>
        </section>
        <SourceNote meta={game.meta} error={game.error} />
        <section className="game-section">
          <div className="section-title">
            <div>
              <p className="eyebrow">BETWEEN THE PIPES</p>
              <h2>
                The goaltending <em>matchup.</em>
              </h2>
            </div>
          </div>
          <div className="goalie-matchup">
            <GoalieSide
              team={g.away.abbrev}
              players={g.goalies.awayTeam}
              onPlayer={onPlayer}
            />
            <GoalieSide
              team={g.home.abbrev}
              players={g.goalies.homeTeam}
              onPlayer={onPlayer}
            />
          </div>
        </section>
        <div className="game-ledgers">
          <section className="game-section scoring-ledger">
            <div className="section-title">
              <div>
                <p className="eyebrow">HOW IT HAPPENED</p>
                <h2>
                  The scoring <em>summary.</em>
                </h2>
              </div>
            </div>
            <div className="event-list">
              {g.goals.length ? (
                g.goals.map((goal) => (
                  <article className="goal-event" key={goal.id}>
                    <div className="event-clock">
                      <b>
                        {goal.periodType === "OT"
                          ? "OT"
                          : goal.periodType === "SO"
                            ? "SO"
                            : `P${goal.period}`}
                      </b>
                      <span>{goal.time}</span>
                    </div>
                    <SafeImage
                      className="event-team"
                      src={teamLogo(goal.team)}
                      alt={goal.team}
                      loading="lazy"
                    />
                    <div className="event-description">
                      <button onClick={() => onPlayer(goal.playerId)}>
                        {goal.name}
                      </button>
                      <p>
                        {goal.assists.length
                          ? goal.assists.map((a) => a.name).join(" · ")
                          : "Unassisted"}
                      </p>
                      <div>
                        {goal.strength === "pp" && (
                          <span className="event-tag">POWER PLAY</span>
                        )}
                        {goal.strength === "sh" && (
                          <span className="event-tag">SHORT HANDED</span>
                        )}
                        {goal.emptyNet && (
                          <span className="event-tag">EMPTY NET</span>
                        )}
                      </div>
                    </div>
                    <div className="event-score">
                      <b>
                        {goal.awayScore ?? "—"}–{goal.homeScore ?? "—"}
                      </b>
                      <small>
                        {g.away.abbrev} / {g.home.abbrev}
                      </small>
                    </div>
                  </article>
                ))
              ) : (
                <div className="empty-ledger">
                  {pregame
                    ? "The scoring ledger opens at puck drop."
                    : "No scoring events reported."}
                </div>
              )}
            </div>
          </section>
          <section className="game-section comparison-ledger">
            <div className="section-title">
              <div>
                <p className="eyebrow">THE NIGHT IN NUMBERS</p>
                <h2>
                  Team <em>statistics.</em>
                </h2>
              </div>
            </div>
            <div className="comparison-heading">
              <b>{g.away.abbrev}</b>
              <span>GAME TOTALS</span>
              <b>{g.home.abbrev}</b>
            </div>
            {g.comparisons.length ? (
              g.comparisons.map((s, i) => {
                const pct = /Pctg/.test(s.category),
                  display = (v) =>
                    v == null ? "—" : pct ? format(v, "pct") : String(v);
                const a = typeof s.awayValue === "number" ? s.awayValue : 0,
                  b = typeof s.homeValue === "number" ? s.homeValue : 0,
                  total = a + b;
                return (
                  <div className="comparison-row" key={s.category || i}>
                    <div>
                      <b>{display(s.awayValue)}</b>
                      <span>{comparisonNames[s.category] || s.category}</span>
                      <b>{display(s.homeValue)}</b>
                    </div>
                    {total > 0 && (
                      <div className="comparison-bars">
                        <span style={{ width: `${(a / total) * 100}%` }} />
                        <span style={{ width: `${(b / total) * 100}%` }} />
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="empty-ledger">
                Team comparisons are not available yet.
              </div>
            )}
          </section>
        </div>
        <section className="game-section penalty-section">
          <div className="section-title">
            <div>
              <p className="eyebrow">THE PENALTY BOX</p>
              <h2>
                Time <em>served.</em>
              </h2>
            </div>
            <span className="muted">CHRONOLOGICAL PENALTY LOG</span>
          </div>
          {g.penalties.length ? (
            <div className="penalty-grid">
              {g.penalties.map((p) => (
                <article key={p.id}>
                  <span className="penalty-time">
                    P{p.period} / {p.time}
                  </span>
                  <SafeImage
                    src={teamLogo(p.team)}
                    alt={p.team}
                    loading="lazy"
                  />
                  <div>
                    <b>{p.name}</b>
                    <span>{p.description}</span>
                  </div>
                  <strong>
                    {p.duration ?? "—"}
                    <small>MIN</small>
                  </strong>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-ledger">No penalty events reported.</div>
          )}
          <p className="table-footnote">
            Penalty events are a historical log. Current power plays are shown
            only when explicitly supplied by the live scoreboard.
          </p>
        </section>
      </div>
    </main>
  );
}
