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
  metaDescription: "Pixel Football: a retro LED football game. Play the computer or a friend.",
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
    keys: "Keys: arrows to move, Space for next play, K to kick, P to pause.",
    close: "Close",
  },

  /** The banner over the field after a play. */
  banner: {
    tackle: (gain: number) => (gain === 0 ? "Stopped" : `Tackled · ${yards(gain)}`),
    firstDown: (gain: number) => `First down! · ${yards(gain)}`,
    turnover: "Turnover on downs",
    touchdown: "Touchdown!",
    fieldGoal: "Field goal!",
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
      "Pro moves the defence 50% faster than Rookie. Changing level starts a new game.",
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

export const liveGames = [pixelFootball];
