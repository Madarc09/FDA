window.FDA_DATA = {
  players: [
    {
      id: "crosby", name: "Sidney Crosby", initials: "SC", team: "PIT", position: "C", type: "F",
      gp: 68, fpts: 403.0, fpg: 403/68, verified: true, signal: "RISING", projectedFpg: 6.3,
      audit: [
        ["Goals", 29, 3.5], ["Assists", 45, 2.5], ["Shots on goal", 160, 0.25],
        ["Hits", 60, 0.25], ["Blocks", 30, 0.5], ["Faceoffs won", 773, 0.2],
        ["Faceoffs lost", 628, -0.2], ["Power-play points", 23, 1], ["Game-winning goals", 4, 2],
        ["Minor penalties", 17, 2], ["First stars", 7, 3], ["Shootout goals", 2, 2]
      ]
    },
    {
      id: "malkin", name: "Evgeni Malkin", initials: "EM", team: "PIT", position: "C", type: "F",
      gp: 56, fpts: 314.6, fpg: 314.6/56, verified: true, signal: "STEADY", projectedFpg: 5.7,
      audit: [
        ["Goals", 19, 3.5], ["Assists", 42, 2.5], ["Shots on goal", 148, 0.25],
        ["Hits", 24, 0.25], ["Blocks", 17, 0.5], ["Faceoffs won", 109, 0.2],
        ["Faceoffs lost", 136, -0.2], ["Power-play points", 22, 1], ["Game-winning goals", 3, 2],
        ["Minor penalties", 23, 2], ["First stars", 6, 3], ["Shootout goals", 1, 2], ["Hat tricks", 1, 3]
      ]
    },
    {
      id: "cowan", name: "Easton Cowan", initials: "EC", team: "TOR", position: "RW", type: "F",
      gp: 66, fpts: 184.1, fpg: 184.1/66, verified: true, signal: "RISING", projectedFpg: 3.1,
      audit: [
        ["Goals", 11, 3.5], ["Assists", 18, 2.5], ["Shots on goal", 92, 0.25],
        ["Hits", 72, 0.25], ["Blocks", 32, 0.5], ["Faceoffs won", 2, 0.2],
        ["Faceoffs lost", 4, -0.2], ["Power-play points", 6, 1], ["Game-winning goals", 1, 2],
        ["Minor penalties", 15, 2], ["Fights", 1, 3], ["First stars", 1, 3]
      ]
    },
    { id: "mcdavid", name: "Connor McDavid", initials: "CM", team: "EDM", position: "C", type: "F", gp: 82, fpts: 649.7, fpg: 649.7/82, verified: true, signal: "ELITE", projectedFpg: 8.1 },
    { id: "draisaitl", name: "Leon Draisaitl", initials: "LD", team: "EDM", position: "C", type: "F", gp: 65, fpts: 471.6, fpg: 471.6/65, verified: true, signal: "ELITE", projectedFpg: 7.4 },
    { id: "bouchard", name: "Evan Bouchard", initials: "EB", team: "EDM", position: "D", type: "D", gp: 82, fpts: 491.8, fpg: 491.8/82, verified: true, signal: "RISING", projectedFpg: 6.2 },
    { id: "matthews", name: "Auston Matthews", initials: "AM", team: "TOR", position: "C", type: "F", gp: 60, fpts: 362.85, fpg: 362.85/60, verified: true, signal: "RISING", projectedFpg: 6.4 }
  ],
  skaterScoring: [
    ["First star", "1Star", 3], ["Assist", "A", 2.5], ["Block", "Blk", 0.5], ["Faceoff lost", "FOL", -0.2],
    ["Faceoff won", "FOW", 0.2], ["Fight", "Ft", 3], ["Game-winning goal", "GWG", 2], ["Goal", "G", 3.5],
    ["Gordie Howe hat trick", "GHHT", 3], ["Hat trick", "HT", 3], ["Hit", "Hit", 0.25], ["Minor penalty", "MnP", 2],
    ["Power-play point", "PPP", 1], ["Shootout goal", "SG", 2], ["Short-handed point", "SHP", 2], ["Shot on goal", "SOG", 0.25]
  ],
  goalieScoring: [
    ["First star", "1Star", 3], ["Assist", "A", 5], ["Goal", "G", 50], ["Goal against", "GA", -1],
    ["Save", "SV", 0.25], ["Shutout", "SHO", 3], ["Win", "W", 5]
  ]
};
