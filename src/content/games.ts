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
    "An LED style football game. Dodge five defenders, make ten yards in four downs, run back kicks, and kick on fourth. Keyboard or touch.",
  lede: "A football game in the style of the LED handhelds from the late 70s. You are the bright dot. Get past the dim ones.",

  /** Printed on the case. */
  brand: "PIXEL",
  model: "FOOTBALL",
  labels: {
    down: "DOWN",
    field: "FIELD",
    toGo: "TO GO",
    home: "HOME",
    away: "AWAY",
    time: "TIME",
    quarter: "QTR",
  },
  buttons: {
    up: "Up",
    down: "Down",
    forward: "Run",
    back: "Back",
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
    kickoff: (team: string) => `${team} kicks off. Press Kick.`,
    returnReady: (team: string, kick: "kickoff" | "punt", distance: number, from: number) =>
      `${kick === "kickoff" ? "Kickoff" : "Punt"} of ${distance} yards. ${team} takes it at its own ${from}. Run it back.`,
    tackle: (gain: number) =>
      gain === 0 ? "Stopped at the line." : gain < 0 ? `Tackled for a loss of ${yards(-gain)}.` : `Tackled after ${yards(gain)}.`,
    firstDown: (gain: number) => `${yards(gain)} and a first down.`,
    returned: (gain: number) =>
      gain > 0 ? `Returned ${yards(gain)}. First and 10.` : gain === 0 ? "Stopped where it landed. First and 10." : `Brought down ${yards(-gain)} back. First and 10.`,
    turnover: (gain: number) => `${gain === 0 ? "Stopped" : gain < 0 ? "Thrown for a loss" : `Tackled after ${yards(gain)}`}, short on fourth down. Turnover.`,
    touchdown: (gain: number) => (gain > 1 ? `Touchdown! A ${gain} yard run.` : "Touchdown!"),
    safety: "Safety! Two points, and the ball goes back with a kick.",
    fieldGoal: (distance: number) => `The ${distance} yard field goal is good.`,
    missedKick: (distance: number) => `The ${distance} yard field goal is no good. Turnover.`,
    touchback: (kick: "kickoff" | "punt", distance: number) =>
      `A ${distance} yard ${kick} into the end zone. Touchback.`,
    endQuarter: (quarter: number) => (quarter === 2 ? "Halftime." : `End of the ${ordinal(quarter).toLowerCase()} quarter.`),
    final: (home: number, away: number) =>
      home === away ? `Final: a tie, ${home} to ${away}.` : `Final: ${home > away ? "home" : "away"} wins, ${Math.max(home, away)} to ${Math.min(home, away)}.`,
    paused: "Paused.",
    start: "Away kicks off to start the game. Press Kick or Run.",
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
      "You are the bright dot. The five dim dots are the defence. Touch one, or let one reach you from any side, and you are tackled. The one who got you blinks.",
      "Each press moves you one yard: forward, back, or across the three lanes. Dropping back can pull the defence out of position, but go down in your own end zone and it is a safety, worth 2 to the other side.",
      "Gain 10 yards in four downs for a first down. A touchdown is 7 points.",
      "Kickoffs open each half and follow every score. A kick that lands in play is run back live; one into the end zone is a touchback at the 20.",
      "On fourth down you can kick before the snap. Inside the opponent's 35 it is a field goal for 3, and the longer the kick the likelier the miss. Further out it is a punt, which the other side runs back.",
      "You play both sides. Home runs right, away runs left. Pass it to a friend, or play yourself.",
      "Four 15 minute quarters, about 45 seconds of real play each. The clock only runs while a play is live, and a play that starts before the buzzer gets finished.",
      "The readout shows the down, the yard line with a light on the side of midfield the ball is on, and yards to go. Score shows both scores and the time left.",
      "Rookie or Pro sets how fast the defence moves. You can switch at any time.",
    ],
  },
  keys: {
    title: "Keys",
    items: [
      { k: "Space or Enter", v: "Run forward, or kick off" },
      { k: "Left and Right, or A and D", v: "Forward and back, by the direction of play" },
      { k: "Up and Down, or W and S", v: "Change lane" },
      { k: "K", v: "Kick: kickoffs, and fourth down" },
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
