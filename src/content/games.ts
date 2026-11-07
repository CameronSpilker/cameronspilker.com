/**
 * Copy for the games section of the site.
 *
 * Same rule as the tools: components under `src/components/games` hold no
 * strings of their own.
 */

/** The framing for `/games` and the homepage section that points at it. */
export const gamesIndex = {
  label: "Games",
  title: "Little games",
  lede: "Small games that run in your browser. No accounts, no ads, nothing uploaded.",
  all: "All games",
  metaDescription: "Small browser games: Pixel Football, a dot matrix football game in the style of the late 70s LED handhelds.",
} as const;

export const pixelFootball = {
  slug: "pixel-football",
  name: "Pixel Football",
  title: "Run the ball through a wall of red dots",
  description:
    "An LED style football game. Dodge five defenders, make ten yards in four downs, kick on fourth. Keyboard or touch.",
  lede: "A football game in the style of the LED handhelds from the late 70s. You are the bright dot. Get past the dim ones.",

  /** Printed on the case. */
  brand: "PIXEL",
  model: "FOOTBALL",
  labels: {
    down: "DOWN",
    toGo: "TO GO",
    toGoal: "TO GOAL",
    home: "HOME",
    away: "AWAY",
    time: "TIME",
    quarter: "QTR",
  },
  buttons: {
    up: "Up",
    down: "Down",
    forward: "Run",
    kick: "Kick",
    status: "Status",
    score: "Score",
    newGame: "New game",
    pause: "Pause",
    resume: "Resume",
    sound: "Sound",
  },
  level: { label: "Level", rookie: "Rookie", pro: "Pro" },

  /** What the display reads out under the field, and what a screen reader hears. */
  messages: {
    ready: (team: string, down: number, toGo: number, toGoal: number) =>
      `${team} ball. ${ordinal(down)} and ${toGo === toGoal ? "goal" : toGo}, ${toGoal} to the goal line.`,
    fourth: "Fourth down. Kick, or go for it.",
    tackle: (gain: number) => (gain === 0 ? "Stopped at the line." : `Tackled after ${yards(gain)}.`),
    firstDown: (gain: number) => `${yards(gain)} and a first down.`,
    turnover: (gain: number) => `${gain === 0 ? "Stopped" : `Tackled after ${yards(gain)}`}, short on fourth down. Turnover.`,
    touchdown: (gain: number) => `Touchdown! A ${gain} yard run.`,
    fieldGoal: (distance: number) => `The ${distance} yard field goal is good.`,
    missedKick: (distance: number) => `The ${distance} yard field goal is no good.`,
    punt: (distance: number, touchback: boolean) =>
      touchback ? `A ${distance} yard punt into the end zone. Touchback.` : `A ${distance} yard punt.`,
    endQuarter: (quarter: number) => (quarter === 2 ? "Halftime." : `End of the ${ordinal(quarter).toLowerCase()} quarter.`),
    final: (home: number, away: number) =>
      home === away ? `Final: a tie, ${home} to ${away}.` : `Final: ${home > away ? "home" : "away"} wins, ${Math.max(home, away)} to ${Math.min(home, away)}.`,
    paused: "Paused.",
    start: "Press Run or any arrow to snap the ball.",
  },
  teams: { home: "Home", away: "Away" },

  scoreboard: {
    title: "Scoreboard",
    quarter: (q: number) => `Q${q}`,
    best: "Your bests in this browser",
    longestRun: "Longest run",
    mostPoints: "Most points by one side",
    none: "None yet",
    yards: (n: number) => yards(n),
  },

  rules: {
    title: "How to play",
    items: [
      "You are the bright dot. The five dim dots are the defence. Touch one, or let one reach you, and you are tackled.",
      "Run forward one yard per press, and slide between the three lanes to get around defenders. There is no going backwards.",
      "Gain 10 yards in four downs for a first down. A touchdown is 7 points.",
      "On fourth down you can kick before the snap. Inside the opponent's 35 it is a field goal for 3, and the longer the kick the likelier the miss. Further out it is a punt.",
      "You play both sides. Home runs right, away runs left, and the ball changes hands after a score, a kick or a turnover on downs. Pass it to a friend, or play yourself.",
      "Four quarters of 45 seconds. The clock only runs while a play is live, and a play that starts before the buzzer gets finished.",
      "Rookie or Pro sets how fast the defence moves. You can switch at any time.",
    ],
  },
  keys: {
    title: "Keys",
    items: [
      { k: "Space or Enter", v: "Run" },
      { k: "Arrow in the direction of play", v: "Run" },
      { k: "Up and Down, or W and S", v: "Change lane" },
      { k: "K", v: "Kick, on fourth down" },
      { k: "P or Esc", v: "Pause" },
    ],
  },
  privacy: "Runs entirely in your browser. Your bests are kept in this browser's storage and nowhere else.",
} as const;

function ordinal(n: number): string {
  return ["First", "Second", "Third", "Fourth"][n - 1] ?? `${n}th`;
}

function yards(n: number): string {
  return n === 1 ? "1 yard" : `${n} yards`;
}

export const liveGames = [pixelFootball];
