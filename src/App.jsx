import React, { useCallback, useEffect, useState } from "react";
import Home from "./pages/Home";
import { Toronto, TeamDirectory } from "./pages/Teams";
import Stats from "./pages/Stats";
import { LiveScores, GameDetails } from "./pages/Live";
import { PlayerModal } from "./components/Card";
import { Icon, SafeImage } from "./components/UI";
const NAV = [
  ["HOME", "/"],
  ["TEAMS", "/teams"],
  ["TEAM STATS", "/stats/teams"],
  ["PLAYER STATS", "/stats/players"],
  ["GOALIE STATS", "/stats/goalies"],
  ["LIVE SCORES", "/scores"],
];
export default function App() {
  const [route, setRoute] = useState(location.pathname + location.search),
    [menu, setMenu] = useState(false),
    [player, setPlayer] = useState(null);
  const closePlayer = useCallback(() => setPlayer(null), []);
  useEffect(() => {
    const pop = () => {
      setRoute(location.pathname + location.search);
      setPlayer(null);
      setMenu(false);
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    const click = (e) => {
      const a = e.target.closest("a");
      if (
        !a ||
        e.defaultPrevented ||
        e.button !== 0 ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey ||
        e.altKey ||
        a.target ||
        a.download
      )
        return;
      const url = new URL(a.href);
      if (url.origin !== location.origin || url.hash) return;
      e.preventDefault();
      const next = url.pathname + url.search;
      if (next !== location.pathname + location.search)
        history.pushState({}, "", next);
      setRoute(next);
      setMenu(false);
      setPlayer(null);
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    document.addEventListener("click", click);
    return () => document.removeEventListener("click", click);
  }, []);
  const path = route.split("?")[0];
  useEffect(() => {
    const title =
      NAV.find(([, url]) => path === url)?.[0] ||
      (path === "/teams/toronto"
        ? "Toronto Collection"
        : path.startsWith("/scores/")
          ? "Game Centre"
          : "The Original Set");
    document.title = `${title} — The Original Set`;
  }, [path]);
  let page;
  if (path === "/") page = <Home onPlayer={setPlayer} />;
  else if (path === "/teams") page = <TeamDirectory />;
  else if (path === "/teams/toronto") page = <Toronto onPlayer={setPlayer} />;
  else if (path.startsWith("/stats/")) {
    const kind = { teams: "team", players: "skater", goalies: "goalie" }[
      path.split("/")[2]
    ];
    page = kind ? (
      <Stats key={kind} kind={kind} onPlayer={setPlayer} locationKey={route} />
    ) : null;
  } else if (/^\/scores\/\d{10}$/.test(path))
    page = (
      <GameDetails key={path} id={path.split("/")[2]} onPlayer={setPlayer} />
    );
  else if (path === "/scores") page = <LiveScores key={route} />;
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header">
        <div className="header-micro">
          <span>HOCKEY, WORTH HOLDING ON TO.</span>
          <span>THE TORONTO COLLECTION · FIRST EDITION</span>
        </div>
        <div className="header-main page-width">
          <a className="brand" href="/" aria-label="The Original Set home">
            <SafeImage
              src="/art/original-set-logo-v1.webp"
              alt="The Original Set"
            />
          </a>
          <button
            className="mobile-menu icon-button"
            aria-label={menu ? "Close navigation" : "Open navigation"}
            aria-expanded={menu}
            aria-controls="main-navigation"
            onClick={() => setMenu((v) => !v)}
          >
            <Icon name={menu ? "close" : "menu"} size={25} />
          </button>
          <nav
            id="main-navigation"
            className={menu ? "open" : ""}
            aria-label="Main navigation"
          >
            {NAV.map(([label, url]) => (
              <a
                href={url}
                key={url}
                className={
                  path === url ||
                  (url === "/teams" && path.startsWith("/teams/")) ||
                  (url === "/scores" && path.startsWith("/scores/"))
                    ? "active"
                    : ""
                }
                aria-current={path === url ? "page" : undefined}
              >
                {label}
                {url === "/scores" && <span className="nav-dot" />}
              </a>
            ))}
          </nav>
        </div>
      </header>
      <div id="main-content" tabIndex={-1}>
        {page || (
          <main className="page-width page-main empty-state">
            <h1>Out of play.</h1>
            <p>That page is not in the collection.</p>
            <a className="button" href="/">
              Back to home
            </a>
          </main>
        )}
      </div>
      <footer className="site-footer">
        <div className="page-width footer-main">
          <a href="/" className="footer-wordmark">
            THE <strong>ORIGINAL SET.</strong>
          </a>
          <p>
            For the love of hockey.
            <br />
            <span>Built around the players. Made for the fans.</span>
          </p>
          <a href="/teams/toronto" className="quiet-link">
            OPEN THE COLLECTION <Icon name="arrow" />
          </a>
        </div>
        <div className="page-width footer-bottom">
          <span>
            INDEPENDENT HOCKEY COLLECTION · NOT AFFILIATED WITH THE NHL
          </span>
          <span>
            PLAYER PHOTOGRAPHY & DATA: NHL · LINEUPS: ATTRIBUTED AT SOURCE
          </span>
        </div>
      </footer>
      {player && <PlayerModal key={player} id={player} onClose={closePlayer} />}
    </>
  );
}
