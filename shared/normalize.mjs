import { text, number, fullName, headshot } from "./format.mjs";
export function normalizeRoster(payload, team = "TOR") {
  return ["forwards", "defensemen", "goalies"].flatMap((group) =>
    (payload[group] || []).map((p) => ({
      id: p.id,
      name: fullName(p),
      firstName: text(p.firstName),
      lastName: text(p.lastName),
      team,
      position:
        p.positionCode ||
        (group === "goalies" ? "G" : group === "defensemen" ? "D" : "F"),
      number: number(p.sweaterNumber),
      headshot: p.headshot || null,
      heroImage: p.heroImage || null,
      height: number(p.heightInInches),
      weight: number(p.weightInPounds),
      birthDate: p.birthDate || null,
      birthplace: [
        text(p.birthCity),
        text(p.birthStateProvince),
        p.birthCountry,
      ]
        .filter(Boolean)
        .join(", "),
      hand: p.shootsCatches || null,
    })),
  );
}
export function normalizePlayer(p) {
  if (!Number.isInteger(p.playerId))
    throw new Error("NHL player identity missing");
  return {
    id: p.playerId,
    name: fullName(p),
    firstName: text(p.firstName),
    lastName: text(p.lastName),
    team: p.currentTeamAbbrev || null,
    teamName: text(p.fullTeamName),
    position: p.position,
    number: number(p.sweaterNumber),
    headshot: p.headshot || null,
    heroImage: p.heroImage || null,
    height: number(p.heightInInches),
    weight: number(p.weightInPounds),
    birthDate: p.birthDate || null,
    birthplace: [text(p.birthCity), text(p.birthStateProvince), p.birthCountry]
      .filter(Boolean)
      .join(", "),
    hand: p.shootsCatches || null,
    active: p.isActive,
    draft: p.draftDetails || null,
    history: (p.seasonTotals || [])
      .filter((s) => s.leagueAbbrev === "NHL" && s.gameTypeId === 2)
      .map((s) => ({ ...s, teamName: text(s.teamName) }))
      .sort(
        (a, b) => b.season - a.season || (a.sequence || 0) - (b.sequence || 0),
      ),
    career: p.careerTotals?.regularSeason || {},
    current: p.featuredStats?.regularSeason?.subSeason || null,
    currentSeason: p.featuredStats?.season || p.currentSeason || null,
  };
}
export function normalizeStats(
  kind,
  summary,
  extra = [],
  standings = [],
  powerplay = [],
) {
  const extras = new Map(extra.map((r) => [r.playerId || r.teamId, r]));
  const pp = new Map(powerplay.map((r) => [r.teamId, r]));
  const stand = new Map(standings.map((s) => [text(s.teamName), s]));
  return summary.map((r) => {
    const id = r.playerId || r.teamId,
      x = extras.get(id) || {};
    if (kind === "team") {
      const s = stand.get(r.teamFullName) || {},
        p = pp.get(id) || {};
      return {
        ...r,
        id,
        name: r.teamFullName,
        team: text(s.teamAbbrev),
        logo: s.teamLogo || null,
        goalDifferential:
          r.goalsFor != null && r.goalsAgainst != null
            ? r.goalsFor - r.goalsAgainst
            : null,
        shots: number(x.shots),
        hits: number(x.hits),
        blockedShots: number(x.blockedShots),
        powerPlayGoals: number(p.powerPlayGoalsFor),
        streak: s.streakCode ? `${s.streakCode}${s.streakCount}` : null,
        lastTen: s.l10GamesPlayed
          ? `${s.l10Wins}–${s.l10Losses}–${s.l10OtLosses}`
          : null,
        conference: s.conferenceName || "",
        division: s.divisionName || "",
      };
    }
    const teams = (r.teamAbbrevs || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return {
      ...r,
      id,
      name: r.skaterFullName || r.goalieFullName,
      teams,
      team: teams.join(" / "),
      position: kind === "goalie" ? "G" : r.positionCode,
      hits: number(x.hits),
      blockedShots: number(x.blockedShots),
      headshot: headshot(id),
    };
  });
}
export const isLive = (state) => ["LIVE", "CRIT"].includes(state);
export function normalizeGame(g) {
  const side = (key) => {
    const t = g[key] || {},
      sit = g.situation?.[key] || {};
    return {
      id: t.id,
      abbrev: t.abbrev,
      name:
        [text(t.placeName), text(t.commonName)].filter(Boolean).join(" ") ||
        text(t.name) ||
        t.abbrev,
      logo: t.logo,
      score: number(t.score),
      shots: number(t.sog),
      strength: number(sit.strength),
      situations: Array.isArray(sit.situationDescriptions)
        ? sit.situationDescriptions
        : [],
    };
  };
  return {
    id: g.id,
    season: g.season,
    date: g.gameDate,
    state: g.gameState,
    scheduleState: g.gameScheduleState,
    startTime: g.startTimeUTC,
    venue: text(g.venue),
    away: side("awayTeam"),
    home: side("homeTeam"),
    period: number(g.periodDescriptor?.number),
    periodType: g.periodDescriptor?.periodType || "",
    clock: g.clock?.timeRemaining || null,
    intermission: !!g.clock?.inIntermission,
    situationClock: g.situation?.timeRemaining || null,
    situationKnown: !!g.situation,
    outcome: g.gameOutcome?.lastPeriodType || "",
    gameCenterLink: g.gameCenterLink || null,
  };
}
export function normalizeGameDetail(
  landing,
  box = {},
  rail = {},
  score = null,
) {
  const game = normalizeGame({
    ...landing,
    ...(score ? { situation: score.situation } : {}),
  });
  // Boxscore typically carries the latest shots. Retain null when absent.
  for (const [side, key] of [
    ["away", "awayTeam"],
    ["home", "homeTeam"],
  ]) {
    if (box[key]?.sog != null) game[side].shots = box[key].sog;
  }
  const goals = (landing.summary?.scoring || [])
    .flatMap((period) =>
      (period.goals || []).map((g, index) => ({
        id: g.eventId || `${period.periodDescriptor.number}-${index}`,
        period: period.periodDescriptor.number,
        periodType: period.periodDescriptor.periodType,
        time: g.timeInPeriod,
        playerId: g.playerId,
        name: fullName(g),
        team: text(g.teamAbbrev),
        assists: (g.assists || []).map((a) => ({
          id: a.playerId,
          name: fullName(a),
        })),
        awayScore: number(g.awayScore),
        homeScore: number(g.homeScore),
        strength: g.strength || null,
        emptyNet: g.goalModifier === "empty-net",
        modifier: g.goalModifier,
        headshot: g.headshot,
      })),
    )
    .sort((a, b) => a.period - b.period || a.time.localeCompare(b.time));
  const penalties = (landing.summary?.penalties || [])
    .flatMap((period) =>
      (period.penalties || []).map((p, index) => ({
        id: `${period.periodDescriptor.number}-${index}`,
        period: period.periodDescriptor.number,
        time: p.timeInPeriod,
        team: text(p.teamAbbrev),
        name: fullName(p.committedByPlayer || {}) || "Team penalty",
        duration: number(p.duration),
        description: p.descKey?.replaceAll("-", " ") || p.type || "Penalty",
      })),
    )
    .sort((a, b) => a.period - b.period || a.time.localeCompare(b.time));
  const goalies = {};
  for (const key of ["awayTeam", "homeTeam"]) {
    const team = landing[key]?.abbrev;
    const liveRows = box.playerByGameStats?.[key]?.goalies;
    const onIce = landing.summary?.iceSurface?.[key]?.goalies || [];
    const pre = landing.matchup?.goalieComparison?.[key]?.leaders || [];
    goalies[key] = (liveRows || pre)
      .map((p) => ({
        id: p.playerId,
        name: fullName(p) || text(p.name),
        team,
        headshot: p.headshot || headshot(p.playerId),
        starter: p.starter === true,
        status:
          p.starter === true
            ? "Confirmed starter"
            : onIce.some((i) => i.playerId === p.playerId)
              ? "On ice"
              : p.toi && p.toi !== "00:00"
                ? "Played"
                : liveRows
                  ? "Available"
                  : "Starter unconfirmed",
        saves: number(p.saves),
        shotsAgainst: number(p.shotsAgainst),
        goalsAgainst: number(p.goalsAgainst),
        savePct: p.shotsAgainst === 0 ? null : number(p.savePctg),
        toi: p.toi || null,
        pregame: !liveRows,
        seasonStats: p,
      }))
      .sort(
        (a, b) =>
          Number(b.starter) - Number(a.starter) ||
          Number(b.status === "On ice") - Number(a.status === "On ice"),
      );
  }
  return {
    ...game,
    goals,
    penalties,
    goalies,
    comparisons: rail.teamGameStats || [],
    linescore: rail.linescore || null,
    tv: (landing.tvBroadcasts || []).map((t) => t.network),
  };
}
