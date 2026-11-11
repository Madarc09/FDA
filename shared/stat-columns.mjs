const c = (key, label, title, kind = "int", lower = false) => ({
  key,
  label,
  title,
  kind,
  lower,
});
export const columns = {
  team: [
    c("gamesPlayed", "GP", "Games played"),
    c("wins", "W", "Wins"),
    c("losses", "L", "Losses", "int", true),
    c("otLosses", "OTL", "Overtime / shootout losses", "int", true),
    c("points", "PTS", "Standings points"),
    c("pointPct", "PTS%", "Points percentage", "pct"),
    c("goalsFor", "GF", "Goals for"),
    c("goalsAgainst", "GA ↓", "Goals against · lower is better", "int", true),
    c("goalDifferential", "DIFF", "Goal differential", "signed"),
    c("goalsForPerGame", "GF/GP", "Goals per game", "decimal"),
    c(
      "goalsAgainstPerGame",
      "GA/GP ↓",
      "Goals against per game · lower is better",
      "decimal",
      true,
    ),
    c("shots", "SOG", "Shots on goal"),
    c("shotsForPerGame", "SOG/GP", "Shots per game", "decimal"),
    c(
      "shotsAgainstPerGame",
      "SA/GP ↓",
      "Shots against per game · lower is better",
      "decimal",
      true,
    ),
    c("powerPlayPct", "PP%", "Power-play percentage", "pct"),
    c("penaltyKillPct", "PK%", "Penalty-kill percentage", "pct"),
    c("powerPlayGoals", "PPG", "Power-play goals"),
    c("faceoffWinPct", "FO%", "Faceoff win percentage", "pct"),
    c("hits", "HIT", "Hits"),
    c("blockedShots", "BLK", "Blocked shots"),
    c("streak", "STREAK", "Current winning / losing streak", "text"),
    c("lastTen", "LAST 10", "Last ten games, W–L–OTL", "text"),
  ],
  skater: [
    c("gamesPlayed", "GP", "Games played"),
    c("goals", "G", "Goals"),
    c("assists", "A", "Assists"),
    c("points", "PTS", "Points"),
    c("plusMinus", "+/−", "Plus / minus", "signed"),
    c("shots", "SOG", "Shots on goal"),
    c("shootingPct", "S%", "Shooting percentage", "pct"),
    c("ppGoals", "PPG", "Power-play goals"),
    c("ppPoints", "PPP", "Power-play points"),
    c("shGoals", "SHG", "Short-handed goals"),
    c("gameWinningGoals", "GWG", "Game-winning goals"),
    c("penaltyMinutes", "PIM", "Penalty minutes"),
    c("hits", "HIT", "Hits"),
    c("blockedShots", "BLK", "Blocked shots"),
    c("faceoffWinPct", "FO%", "Faceoff win percentage", "pct"),
    c("timeOnIcePerGame", "TOI/GP", "Average time on ice", "time"),
  ],
  goalie: [
    c("gamesPlayed", "GP", "Games played"),
    c("gamesStarted", "GS", "Games started"),
    c("wins", "W", "Wins"),
    c("losses", "L", "Losses", "int", true),
    c("otLosses", "OTL", "Overtime / shootout losses", "int", true),
    c("savePct", "SV%", "Save percentage", "save"),
    c(
      "goalsAgainstAverage",
      "GAA ↓",
      "Goals-against average · lower is better",
      "decimal",
      true,
    ),
    c("shutouts", "SO", "Shutouts"),
    c("saves", "SV", "Saves"),
    c("shotsAgainst", "SA", "Shots against"),
    c("goalsAgainst", "GA ↓", "Goals against · lower is better", "int", true),
    c("timeOnIce", "MIN", "Minutes played", "minutes"),
    c("goals", "G", "Goals"),
    c("assists", "A", "Assists"),
  ],
};
export function sortRows(rows, key, direction = "desc") {
  return [...rows].sort((a, b) => {
    const av = a[key],
      bv = b[key],
      an = av == null || av === "",
      bn = bv == null || bv === "";
    if (an || bn)
      return an === bn
        ? String(a.name).localeCompare(String(b.name))
        : an
          ? 1
          : -1;
    const diff =
      typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv), undefined, { numeric: true });
    return (
      (direction === "asc" ? diff : -diff) ||
      String(a.name).localeCompare(String(b.name)) ||
      a.id - b.id
    );
  });
}
export function filterRows(
  rows,
  { query = "", team = "", position = "", minGames = 0 } = {},
) {
  const q = query
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  return rows.filter(
    (p) =>
      (!q ||
        p.name
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .includes(q)) &&
      (!team || (p.teams || [p.team]).includes(team)) &&
      (!position || p.position === position) &&
      (!minGames || p.gamesPlayed >= minGames),
  );
}
