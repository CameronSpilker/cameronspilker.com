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
    "An LED style football game on a 9 yard screen. Dodge five defenders, make ten yards in four downs, kick on fourth. Keyboard or touch.",
  lede: "A football game played by the rules of the LED handhelds from the late 70s. You are the bright dot. Get past the dim ones.",

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
    left: "Move left",
    right: "Move right",
    kick: "Kick",
    play: "Play",
    resumeFull: "Back to the game",
    close: "Close the game",
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
    fieldGoal: (distance: number) => `The kicker goes for it: a ${distance} yard field goal, good.`,
    punt: (distance: number, touchback: boolean) =>
      touchback ? `A ${distance} yard punt into the end zone. Touchback.` : `A ${distance} yard punt. The other side takes over.`,
    endQuarter: (quarter: number) => (quarter === 2 ? "Halftime." : `End of the ${ordinal(quarter).toLowerCase()} quarter.`),
    setUp: "Press Status for the next play.",
    final: (home: number, away: number) =>
      home === away ? `Final: a tie, ${home} to ${away}.` : `Final: ${home > away ? "home" : "away"} wins, ${Math.max(home, away)} to ${Math.min(home, away)}.`,
    paused: "Paused.",
    start: "Home ball, first and 10 on its own 20. Press an arrow to snap the ball.",
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
      "Each press moves you one yard: toward the goal, or across the three lanes. There is no going backwards.",
      "The screen is 9 yards long. Every play starts at your own end of it. Run off the far end and you start the next 9 yards from the near end, with the defence where it stood.",
      "Gain 10 yards in four downs for a first down. A touchdown is 7 points. Short on fourth down and the other side takes over where you went down.",
      "Kick only on fourth down. The kicker decides: close enough, and it is a field goal for 3 (the closer, the likelier). Otherwise it is a punt of up to 65 yards. After any score the other side starts on its own 20.",
      "After every play, press Status or Score to set up the next one. Status shows the down, the yard line (with a light for the side of midfield) and yards to go, which goes dark inside the 10. Score shows both scores and the time.",
      "You play both sides. Home runs right and away runs left. Pass it to a friend, or play yourself.",
      "Four 15 minute quarters, about 2 and a half minutes of real play each. The clock only runs while a play is live. Possession carries over between quarters, but the second half starts with away on its own 20.",
      "Pro moves the defence 50% faster than Rookie. Changing level starts a new game.",
      "The trick: start a play by moving across to pull the defence that way, then cut back and run down the other side. Watch for the safety.",
    ],
  },
  keys: {
    title: "Keys",
    items: [
      { k: "Left or Right, A or D", v: "Run toward the goal" },
      { k: "Up and Down, or W and S", v: "Change lane" },
      { k: "Space or Enter", v: "Status, and set up the next play" },
      { k: "C", v: "Score, and set up the next play" },
      { k: "K", v: "Kick, on fourth down" },
      { k: "P or Esc", v: "Pause" },
    ],
  },
  phoneNote: "On a phone the game opens full screen with the field upright and the buttons under your thumbs.",
  privacy: "Runs entirely in your browser. Your bests are kept in this browser's storage and nowhere else.",
} as const;

function ordinal(n: number): string {
  return ["First", "Second", "Third", "Fourth"][n - 1] ?? `${n}th`;
}

function yards(n: number): string {
  return n === 1 ? "1 yard" : `${n} yards`;
}

export const liveGames = [pixelFootball];
