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
  lede: "Small games that run in your browser. No accounts, no ads.",
  all: "All games",
  metaDescription: "Pixel Football, a retro LED football game, and Color Echo, a four color memory game.",
} as const;

export const pixelFootball = {
  slug: "pixel-football",
  name: "Pixel Football",
  /** The small line above the name on cards. */
  label: "Retro handheld game",
  description: "Retro LED football. Dodge the defenders, run for a touchdown. Play the computer or a friend.",
  lede: "Dodge the red dots and run for a touchdown. Play the computer or a friend.",

  /** Printed on the case. */
  brand: "PIXEL",
  model: "FOOTBALL",
  labels: {
    down: "DOWN",
    field: "FIELD",
    toGo: "TO GO",
    home: "HOME",
    away: "AWAY",
    you: "YOU",
    cpu: "CPU",
    time: "TIME",
    quarter: "QTR",
  },
  buttons: {
    up: "Up",
    down: "Down",
    forward: "Run",
    next: "Next",
    nextPlay: "Next play",
    kick: "Kick",
    /** Under Kick while it is locked. */
    kickHint: "4th down",
    play: "Play",
    resumeFull: "Back to the game",
    close: "Close the game",
    status: "Status",
    score: "Score",
    newGame: "New game",
    howTo: "How to play",
    pause: "Pause",
    resume: "Resume",
    sound: "Sound",
    on: "On",
    off: "Off",
    soundIsOn: "Sound is on. Turn it off",
    soundIsOff: "Sound is off. Turn it on",
  },
  level: { label: "Level", rookie: "Rookie", pro: "Pro" },

  /** The pop up that opens the game: three steps, then pick who to play. */
  intro: {
    title: "How to play",
    steps: [
      { title: "You are the bright dot", body: "Run toward the goal and slide between lanes to dodge the red defenders." },
      { title: "Make 10 yards in 4 tries", body: "Do it and you get 4 more. Reach the end zone for a touchdown, 7 points." },
      { title: "Tap Next after each tackle", body: "On fourth down you can kick instead: a field goal if you're close." },
    ],
    choose: "Who are you playing?",
    cpu: "Play the computer",
    cpuNote: "You're Home. The computer runs Away's plays.",
    friend: "Play a friend",
    friendNote: "Take turns: Home, then Away. Pass the phone.",
    keys: "Keys: arrows to move, Space for next play, C for the score, K to kick, P to pause.",
    close: "Close",
  },

  /** The banner over the field after a play. */
  banner: {
    tackle: (gain: number) => (gain === 0 ? "Stopped" : `Tackled · ${yards(gain)}`),
    firstDown: (gain: number) => `First down! · ${yards(gain)}`,
    turnover: "Turnover on downs",
    touchdown: "Touchdown!",
    fieldGoal: "Field goal!",
    /** The big banner for a score: the points, who got them, and where that leaves the game. */
    points: (points: number, team: string) => `+${points} for ${team}`,
    scoreLine: (home: string, h: number, away: string, a: number) => `${home} ${h} · ${away} ${a}`,
    punt: (distance: number) => `Punt · ${yards(distance)}`,
    touchback: "Punt · touchback",
    endQuarter: (quarter: number) => (quarter === 2 ? "Halftime" : `End of Q${quarter}`),
    next: (ball: string, down: number, toGo: number, toGoal: number) =>
      `Next: ${ball} · ${ordinal(down).toLowerCase()} and ${toGo === toGoal ? "goal" : toGo}`,
    passTo: (team: string) => `Pass the phone to ${team}`,
    cpuNext: "The computer has the ball",
    tap: "Tap Next play",
  },

  /** The line under the field, and what a screen reader hears. */
  messages: {
    press: "Press Run to start the play.",
    cpuBall: "The computer is running. Watch it go.",
    running: "Run! Dodge the red dots.",
    fourth: "Fourth down: kick, or run for it.",
    ready: (ball: string, down: number, toGo: number, toGoal: number) =>
      `${ball}. ${ordinal(down)} and ${toGo === toGoal ? "goal" : toGo}, ${toGoal} to the goal line.`,
    tackle: (gain: number) => (gain === 0 ? "Stopped at the line." : `Tackled after ${yards(gain)}.`),
    firstDown: (gain: number) => `${yards(gain)} and a first down.`,
    turnover: (gain: number) => `${gain === 0 ? "Stopped" : `Tackled after ${yards(gain)}`}, short on fourth down. Turnover.`,
    touchdown: (gain: number) => `Touchdown! A ${gain} yard run.`,
    fieldGoal: (distance: number) => `A ${distance} yard field goal, good.`,
    punt: (distance: number, touchback: boolean) =>
      touchback ? `A ${distance} yard punt into the end zone. Touchback.` : `A ${distance} yard punt. The other side takes over.`,
    endQuarter: (quarter: number) => (quarter === 2 ? "Halftime." : `End of the ${ordinal(quarter).toLowerCase()} quarter.`),
    final: (winner: string | null, high: number, low: number) =>
      winner === null ? `Final: a tie, ${high} to ${low}.` : `Final: ${winner} ${winner === "You" ? "win" : "wins"}, ${high} to ${low}.`,
    paused: "Paused.",
  },
  teams: { home: "Home", away: "Away", you: "You", cpu: "Computer" },
  balls: { home: "Home ball", away: "Away ball", you: "Your ball", cpu: "Computer's ball" },

  scoreboard: {
    title: "Scoreboard",
    quarter: (q: number) => `Q${q}`,
    best: "Your bests in this browser",
    longestRun: "Longest run",
    mostPoints: "Most points by one side",
    none: "None yet",
    yards: (n: number) => yards(n),
  },

  /** Your own top ten against the computer, kept in this browser only. */
  highScores: {
    title: "Your high scores against the computer",
    note: "Kept in this browser only.",
    empty: "Finish a game against the computer to get on the board.",
    line: (you: number, cpu: number) => `You ${you} · CPU ${cpu}`,
    newHigh: "New high score!",
    madeList: (rank: number) => `#${rank} on your high scores`,
  },

  /** The full rules, folded away at the bottom of the page for anyone who wants them. */
  rules: {
    title: "Full rules",
    items: [
      "The field is 3 lanes by 9 yards. Each play starts at your own end of it. Run off the far end and you keep going on the next 9 yards.",
      "Each press moves you one yard: forward, or across a lane. There is no going backwards. Touch a defender, or let one reach you, and you are tackled. The one who got you blinks.",
      "Gain 10 yards in four downs for a first down. A touchdown is 7. Short on fourth down and the other side takes over where you went down.",
      "Kick only on fourth down. Close enough and it is a field goal for 3, likelier the closer you are. Otherwise it is a punt of up to 65 yards. After any score the other side starts on its own 20.",
      "Four quarters of 15 game minutes, about 2 and a half real minutes each. The clock only runs during a play. The second half starts with Away on its own 20.",
      "Status shows the down, the yard line (a light shows which side of midfield) and yards to go. Score shows both scores and the time. Either one, or Next, sets up the next play.",
      "The defence lines up 3 yards off: a wall across all three lanes, a linebacker and a safety. It moves one tackler at a time, and they drift toward your lane. Running straight only gets you 2 yards, so you have to dodge. Pro moves 50% faster than Rookie. Changing level starts a new game.",
      "The trick: step across to pull the defence that way, then cut back and run down the other side.",
    ],
    keysTitle: "Keys",
    keys: [
      { k: "Left or Right, A or D", v: "Run toward the goal" },
      { k: "Up and Down, or W and S", v: "Change lane" },
      { k: "Space or Enter", v: "Next play (also Status)" },
      { k: "C", v: "Score" },
      { k: "K", v: "Kick, on fourth down" },
      { k: "P or Esc", v: "Pause" },
    ],
  },
  phoneNote: "On a phone the game opens full screen, with the buttons under your thumbs.",
} as const;

function ordinal(n: number): string {
  return ["First", "Second", "Third", "Fourth"][n - 1] ?? `${n}th`;
}

function yards(n: number): string {
  return n === 1 ? "1 yard" : `${n} yards`;
}

export const colorEcho = {
  slug: "color-echo",
  name: "Color Echo",
  label: "Memory game",
  description: "Four colors, one growing tune. Watch the pattern, play it back, and see how far you get.",
  lede: "Watch the lights, then play them back. One more each round.",

  /** The four pads, in grid order: top left, top right, bottom left, bottom right. */
  pads: [
    { name: "Coral", key: "1" },
    { name: "Amber", key: "2" },
    { name: "Teal", key: "3" },
    { name: "Violet", key: "4" },
  ],
  padLabel: (name: string, key: string) => `${name} pad, key ${key}`,

  buttons: {
    start: "Start",
    again: "Play again",
    soundIsOn: "Sound is on. Turn it off",
    soundIsOff: "Sound is off. Turn it on",
    sound: "Sound",
    on: "On",
    off: "Off",
  },
  goal: {
    label: "Rounds",
    option: (goal: number | null) => (goal === null ? "Endless" : String(goal)),
  },

  /** The readout above the pads. */
  status: {
    idle: "Press Start, then watch",
    watch: "Watch",
    yourTurn: "Your turn",
    nice: "Nice. One more",
    round: (round: number, goal: number | null) => (goal === null ? `Round ${round}` : `Round ${round} of ${goal}`),
    lost: (done: number) => (done === 0 ? "Missed the first one" : `You got ${done} ${done === 1 ? "round" : "rounds"}`),
    slow: "Too slow",
    won: (goal: number) => `All ${goal} rounds!`,
    newBest: "New best!",
    speedUp: "Faster now",
  },

  /** What a screen reader hears. */
  announce: {
    watch: (round: number) => `Round ${round}. Watch.`,
    yourTurn: (count: number) => `Your turn. Repeat ${count === 1 ? "1 light" : `${count} lights`}, 3 seconds per press.`,
    lost: (done: number, name: string, slow: boolean) =>
      `${slow ? "Out of time. " : ""}Game over after ${done === 1 ? "1 round" : `${done} rounds`}. It was ${name}.`,
    won: (goal: number) => `You won all ${goal} rounds.`,
  },

  best: {
    title: "Your bests in this browser",
    line: (goal: number | null) => (goal === null ? "Endless" : `${goal} rounds`),
    value: (n: number, goal: number | null) => (goal !== null && n >= goal ? `${n} · won` : n === 0 ? "None yet" : String(n)),
  },

  rules: {
    title: "How to play",
    items: [
      "Press Start. One pad lights up and plays its note. Press the same pad.",
      "Each round the game plays the whole pattern again with one new light on the end. Repeat all of it, in order.",
      "You have 3 seconds for each press. The bar under the dots shows how long is left, and it fills again after every right press.",
      "One wrong press, or running out of time, ends the game. The pad you should have pressed blinks so you can see what it was.",
      "Pick 8, 14, 20 or 31 rounds to win, or Endless to play until you slip. The lights speed up at rounds 5, 9 and 13.",
      "Each pad has its own shape as well as its own color and note, so you can play by any of the three.",
    ],
    keysTitle: "Keys",
    keys: [
      { k: "1 2 3 4", v: "The four pads, left to right, top to bottom" },
      { k: "Q W A S", v: "The same pads, laid out like the grid" },
      { k: "Space or Enter", v: "Start, or play again" },
    ],
  },
} as const;

export const liveGames = [pixelFootball, colorEcho];
