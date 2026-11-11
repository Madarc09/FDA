import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useResource } from "../services/api";
import { columns, sortRows, filterRows } from "../../shared/stat-columns.mjs";
import { format, seasonLabel, teamLogo } from "../../shared/format.mjs";
import {
  Icon,
  SafeImage,
  PageHeading,
  SourceNote,
  Loading,
  ErrorPanel,
} from "../components/UI";
const pageTitles = {
  team: ["Team", "statistics.", "32 clubs. Every point earned."],
  skater: ["Player", "statistics.", "The names behind the numbers."],
  goalie: ["Goaltender", "statistics.", "The last line of defence."],
};
function StatsTable({ rows, kind, sort, direction, onSort, onPlayer, offset }) {
  const ref = useRef(),
    positions = useRef(new Map());
  useLayoutEffect(() => {
    const nodes = [
        ...(ref.current?.querySelectorAll("tbody tr[data-id]") || []),
      ],
      reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const next = new Map();
    for (const el of nodes) {
      const top = el.getBoundingClientRect().top;
      next.set(el.dataset.id, top);
      const old = positions.current.get(el.dataset.id);
      if (!reduce && old != null && Math.abs(old - top) < 1200 && old !== top)
        el.animate(
          [
            { transform: `translateY(${old - top}px)` },
            { transform: "translateY(0)" },
          ],
          { duration: 220, easing: "ease-out" },
        );
    }
    positions.current = next;
  }, [rows]);
  return (
    <div
      className="stats-scroll"
      role="region"
      aria-label="Sortable NHL statistics, horizontally scrollable"
      tabIndex={0}
    >
      <table className="stats-table" ref={ref}>
        <thead>
          <tr>
            <th className="rank-cell">#</th>
            <th className="identity-cell">
              {kind === "team" ? "TEAM" : "PLAYER"}
            </th>
            {kind !== "team" && <th>POS</th>}
            {columns[kind].map((c) => (
              <th
                key={c.key}
                aria-sort={
                  sort === c.key
                    ? direction === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
                }
                className={sort === c.key ? "sorted" : ""}
              >
                <button
                  onClick={() => onSort(c)}
                  title={c.title}
                  aria-label={`Sort by ${c.title}`}
                >
                  <span>{c.label}</span>
                  <span className="sort-arrow">
                    {sort === c.key ? (direction === "asc" ? "↑" : "↓") : "↕"}
                  </span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((p, index) => (
            <tr key={p.id} data-id={p.id}>
              <td className="rank-cell">
                {String(index + 1 + offset).padStart(2, "0")}
              </td>
              <th scope="row" className="identity-cell">
                {kind === "team" ? (
                  <a
                    className="table-person"
                    href={
                      p.team === "TOR"
                        ? "/teams/toronto"
                        : `/stats/players?team=${p.team}`
                    }
                  >
                    <SafeImage
                      src={p.logo || teamLogo(p.team)}
                      alt=""
                      loading="lazy"
                    />
                    <span>
                      <b>{p.name}</b>
                      <small>{p.team}</small>
                    </span>
                  </a>
                ) : (
                  <button
                    className="table-person"
                    onClick={() => onPlayer(p.id)}
                  >
                    <SafeImage src={p.headshot} alt="" loading="lazy" />
                    <span>
                      <b>{p.name}</b>
                      <small>{p.team}</small>
                    </span>
                  </button>
                )}
              </th>
              {kind !== "team" && (
                <td className="position-cell">{p.position}</td>
              )}
              {columns[kind].map((c) => (
                <td className={sort === c.key ? "sorted" : ""} key={c.key}>
                  {format(p[c.key], c.kind)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export default function Stats({ kind, onPlayer, locationKey }) {
  const resource = useResource({ resource: "stats", kind }),
    [query, setQuery] = useState(""),
    [team, setTeam] = useState(
      () => new URLSearchParams(location.search).get("team") || "",
    ),
    [position, setPosition] = useState(""),
    [minimum, setMinimum] = useState(kind === "goalie" ? 5 : 0),
    [sort, setSort] = useState(kind === "goalie" ? "wins" : "points"),
    [direction, setDirection] = useState("desc"),
    [page, setPage] = useState(0);
  useEffect(() => {
    setTeam(new URLSearchParams(location.search).get("team") || "");
    setPage(0);
  }, [locationKey]);
  const [title, accent, description] = pageTitles[kind];
  const filtered = useMemo(
    () =>
      filterRows(resource.data?.rows || [], {
        query,
        team,
        position,
        minGames: minimum,
      }),
    [resource.data, query, team, position, minimum],
  );
  const ordered = useMemo(
    () => sortRows(filtered, sort, direction),
    [filtered, sort, direction],
  );
  const pageSize = 50,
    visible = useMemo(
      () => ordered.slice(page * pageSize, (page + 1) * pageSize),
      [ordered, page],
    );
  const sortCol = columns[kind].find((c) => c.key === sort),
    leader = ordered[0];
  const changeSort = (c) => {
    setDirection(
      sort === c.key
        ? direction === "asc"
          ? "desc"
          : "asc"
        : c.lower
          ? "asc"
          : "desc",
    );
    setSort(c.key);
    setPage(0);
  };
  const reset = () => {
    setQuery("");
    setTeam("");
    setPosition("");
    setMinimum(0);
    setPage(0);
  };
  const filter = (setter) => (e) => {
    setter(e.target.value);
    setPage(0);
  };
  return (
    <main className={`stats-page ${kind} page-main`}>
      <div className="page-width">
        <PageHeading
          eyebrow="THE STATISTICAL LEDGER"
          title={title}
          accent={accent}
          description={description}
        >
          <div className="season-stamp">
            <small>REGULAR SEASON</small>
            <b>{seasonLabel(resource.meta?.season)}</b>
          </div>
        </PageHeading>
        <nav className="stats-nav" aria-label="Statistics categories">
          {[
            ["team", "teams", "TEAM STATS"],
            ["skater", "players", "PLAYER STATS"],
            ["goalie", "goalies", "GOALIE STATS"],
          ].map(([type, path, label]) => (
            <a
              className={kind === type ? "active" : ""}
              key={type}
              href={`/stats/${path}`}
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="ledger-masthead">
          <div>
            <p className="eyebrow light">THE CURRENT ORDER</p>
            <h2>{sortCol?.title.split(" · ")[0]}</h2>
            <p>
              {direction === "desc" ? "Highest to lowest" : "Lowest to highest"}
              {sortCol?.lower ? " · Lower is better" : ""}
            </p>
          </div>
          {leader && (
            <div className="ranking-leader">
              <SafeImage
                src={kind === "team" ? leader.logo : leader.headshot}
                alt=""
              />
              <div>
                <small>TOP OF THIS VIEW</small>
                <strong>{leader.name}</strong>
                <span>
                  {leader.team} · {leader.gamesPlayed} GP
                </span>
              </div>
              <b>{format(leader[sort], sortCol?.kind)}</b>
            </div>
          )}
        </div>
        <div className="stats-controls">
          <label className="search-field">
            <Icon name="search" />
            <input
              value={query}
              onChange={filter(setQuery)}
              placeholder={kind === "team" ? "Find a team…" : "Find a player…"}
              aria-label={kind === "team" ? "Search teams" : "Search players"}
            />
          </label>
          {kind !== "team" && (
            <label>
              <span>TEAM</span>
              <select
                value={team}
                onChange={filter(setTeam)}
                aria-label="Filter by NHL team"
              >
                <option value="">All teams</option>
                {resource.data?.teams.map((t) => (
                  <option key={t.abbrev} value={t.abbrev}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {kind === "skater" && (
            <label>
              <span>POSITION</span>
              <select
                value={position}
                onChange={filter(setPosition)}
                aria-label="Filter by position"
              >
                <option value="">All positions</option>
                <option value="C">Centre</option>
                <option value="L">Left wing</option>
                <option value="R">Right wing</option>
                <option value="D">Defence</option>
              </select>
            </label>
          )}
          {kind !== "team" && (
            <label>
              <span>MINIMUM GP</span>
              <select
                value={minimum}
                onChange={(e) => {
                  setMinimum(Number(e.target.value));
                  setPage(0);
                }}
                aria-label="Minimum games played"
              >
                {[0, 1, 5, 10, 20, 40].map((n) => (
                  <option value={n} key={n}>
                    {n === 0 ? "All players" : `${n}+ games`}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button className="text-button" onClick={reset}>
            Reset filters
          </button>
          <button
            className="icon-button"
            aria-label="Refresh statistics"
            onClick={resource.refresh}
            disabled={resource.loading}
          >
            <Icon name="refresh" />
          </button>
        </div>
        <div className="table-caption">
          <span>
            {filtered.length} of {resource.data?.rows.length ?? "—"}{" "}
            {kind === "team"
              ? "teams"
              : kind === "goalie"
                ? "goaltenders"
                : "skaters"}
            {minimum > 0 && ` · Minimum ${minimum} GP`}
          </span>
          <span>
            SELECT ANY COLUMN TO SORT <i>↕</i>
          </span>
        </div>
        {!resource.data ? (
          resource.error ? (
            <ErrorPanel error={resource.error} retry={resource.refresh} />
          ) : (
            <Loading label="Opening the NHL statistical ledger…" />
          )
        ) : filtered.length ? (
          <StatsTable
            rows={visible}
            offset={page * pageSize}
            kind={kind}
            sort={sort}
            direction={direction}
            onSort={changeSort}
            onPlayer={onPlayer}
          />
        ) : (
          <div className="empty-state">
            <h3>No matching entries.</h3>
            <button className="button small" onClick={reset}>
              Reset filters
            </button>
          </div>
        )}
        {filtered.length > pageSize && (
          <div className="pagination">
            <span>
              {page * pageSize + 1}–
              {Math.min((page + 1) * pageSize, filtered.length)} of{" "}
              {filtered.length}
            </span>
            <div>
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                aria-label="Previous statistics page"
              >
                <Icon name="left" />
                Previous
              </button>
              <button
                disabled={(page + 1) * pageSize >= filtered.length}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
                <Icon name="right" />
              </button>
            </div>
          </div>
        )}
        <SourceNote meta={resource.meta} error={resource.error} />
        <p className="table-footnote">
          All sorting and filtering happens instantly within the loaded dataset.
          — means the source did not supply a value.
          {kind === "goalie"
            ? " Save percentage uses shots faced; GAA uses time played. Use the minimum-games filter to compare meaningful samples."
            : kind === "team"
              ? " Streak and last-ten records come from the standings feed and may update at a different time than season totals."
              : " Players who have appeared for multiple teams retain their full-season totals."}
        </p>
      </div>
    </main>
  );
}
