# Cyber Daily 10

A daily cybersecurity quiz PWA: 10 multiple-choice questions a day.
Built with React 19, TypeScript and Vite.

## Project structure
| Path | What it is |
| --- | --- |
| `index.html` | Page shell |
| `src/main.tsx` | Starts the app, zoom lock, service worker registration and auto-update |
| `src/App.tsx` | Loads questions, holds state, switches between Home, Today's 10 and Practice |
| `src/styles.css` | All styling, including the dark theme (follows the phone's light/dark setting) |
| `src/sw.js` | Service worker template (offline + updates), version-stamped at build time |
| `src/assets/fonts/` | Figtree font |
| `src/components/Home.tsx` | Home screen tile grid: Today's 10 (locks with a countdown once done) and Practice |
| `src/components/Tile.tsx` | A single home-screen tile |
| `src/components/QuestionView.tsx` | Question, answers, hint and result |
| `src/components/DoneView.tsx` | End-of-set summary for both modes |
| `src/components/Profile.tsx` | Profile screen |
| `src/components/Badge.tsx` | Level ring and badge medals |
| `src/components/Celebration.tsx` | Pop-up sheet for level-ups, badges and streak freezes |
| `src/components/BlitzView.tsx` | Acronym Blitz: intro, the timed round and the results |
| `src/components/Header.tsx`, `Ticks.tsx`, `icons.tsx` | Small UI pieces |
| `src/hooks/useCountdown.ts` | Countdown to the next daily set |
| `src/hooks/useEdgeSwipe.ts` | Swipe from the left edge to go back Home |
| `src/lib/quiz.ts` | Quiz logic: daily draw, Smart Practice, streak, storage |
| `src/lib/progress.ts` | XP, levels, badges, streak freezes, category scores, recommendations |
| `src/lib/blitz.ts` | Acronym Blitz logic: difficulty ramp, reversed questions, scoring, XP cap |
| `src/lib/haptics.ts` | Light haptic taps (iPhone iOS 18+ and Android) |
| `public/questions.json` | The question bank |
| `public/acronyms.json` | The Acronym Blitz bank |
| `public/manifest.json`, icons, `figtree-OFL.txt` | PWA manifest, icons and font licence (copied into the build with their exact names) |
| `.github/workflows/deploy.yml` | GitHub Actions workflow (see below) |
| `vite.config.ts`, `tsconfig.json`, `package.json`, `package-lock.json` | Build setup |

## Publishing on GitHub Pages
A Vite app has to be built before it can be served, so GitHub builds it for you. Every push to `main` runs `.github/workflows/deploy.yml`, which builds the app and publishes `dist/` to GitHub Pages (**Settings → Pages → Source: GitHub Actions**). Check the **Actions** tab: when the run goes green, the app is live at your Pages URL.

## Updates on your phone
Each build stamps `sw.js` with a new cache version, so old copies are cleared automatically. The app also checks for an update every time it opens or comes back to the foreground, and reloads once to apply it.

## How the daily draw works
- A new set of 10 unlocks at local midnight. Your set is saved, so closing the app resumes where you left off. An answer is locked the moment you tap it.
- Correct answers are ticked off for the current round. Wrong answers go back in the pot and the answer is never shown.
- Yesterday's questions are held back, so you won't get the same one two days in a row unless nothing else is left.
- Questions you haven't seen for longest are favoured, randomly among equals.
- If fewer than 10 remain, the rest are topped up with "Review" questions you've already got right. These don't affect progress.
- When every question is ticked off, a new round starts with the full bank.
- Answer order is shuffled every time a question appears.

Progress is stored on the device (localStorage, same key as the original version, so existing progress carries over).

## Adding a home-screen tile
In `src/components/Home.tsx`, add an entry to the `tiles` list. Each tile has a `title`, `icon`, one-line `meta`, optional `foot`, a `tone` (`feature` orange, `feature-done` soft orange, `plain` white, `locked` grey) and an `onOpen` action. Tiles flow into the two-column grid automatically; set `wide: true` to span both columns.

## Smart Practice
Uses every question you've ever answered correctly, plus every acronym you've missed in Acronym Blitz (this list never resets). Acronyms appear as "What does X stand for?" questions. Each item sits in one of five boxes:

| Box | Comes back after |
| --- | --- |
| 1 | 1 day |
| 2 | 3 days |
| 3 | 7 days |
| 4 | 14 days |
| 5 | 30 days |

- A right answer on a due question moves it up a box. A wrong answer sends it back to box 1 (back tomorrow) and shows the right answer.
- Answering correctly before it's due doesn't move it up, so repeating Practice can't max everything out.
- A round of up to 10 picks due questions first, then your weakest categories, then a couple at random.
- The Practice tile shows how many are due.
- Practice never changes daily progress or the streak.

Every answer in every mode is logged with its category (`log` in saved state), ready for the Profile.

## Acronym Blitz
A 60-second speed round, available from level 1.

- Each question shows an acronym with 4 full names to choose from. About 1 in 6 is reversed: the full name is shown and you pick the acronym.
- The next question appears straight away. A wrong answer takes 3 seconds off the clock.
- 5 right in a row starts a ×2 combo (each answer then scores 2) until you get one wrong.
- The bar under the header shows the time left. It turns orange for the last 10 seconds, and the haptics get firmer.
- It starts with common acronyms (tier 1) and moves to specialist ones (tier 3) as the round goes on.
- The end screen shows your score, your best, and every acronym you missed with its meaning. Missed acronyms go into Smart Practice, due straight away.
- Every answer is logged as mode `blitz` with its category, so it feeds the Profile.
- XP: 2 per right answer and 10 for finishing, for the first 3 rounds each day. Leaving mid-round earns no XP.

### Adding acronyms
Add entries to `public/acronyms.json` with a new unique `id`:

```json
{
  "id": "ACR-131",
  "acronym": "SIEM",
  "full": "Security Information and Event Management",
  "decoys": ["Security Incident and Event Monitoring", "Security Information and Event Monitoring", "Security Incident and Event Management"],
  "meaning": "One plain-English line, shown on the end screen.",
  "category": "One of the categories in questions.json",
  "tier": 2
}
```

- Decoys must be believable near-misses, with one or two words changed, and about the same length as the real name.
- Avoid decoys that are also in real use, such as "Data Leak Prevention" for DLP.
- `tier`: 1 for common, 2 for working knowledge, 3 for specialist.

## Profile, levels and badges
Tap the level ring (top right of Home) or the Profile tile.

**XP and ranks**
- XP: 10 per daily question right, 20 for finishing the set, 50 for a clean sweep, 5 per due review right in Practice (1 if it wasn't due). Acronym Blitz: 2 per right answer and 10 per finished round, for the first 3 rounds each day.
- Ranks run from Trainee (level 1) to CISO (level 10). Tap your rank name on the Profile to see them all; tap the level ring to flip it. The XP needed for each is set in `RANKS` in `src/lib/progress.ts`.

**Category scores**
- Each category gets a score from 0 to 100, based on your last 30 answers with recent ones weighted more.
- A score appears after 5 answers. Trend arrows compare with 2 weeks ago.

**Streak freezes**
- You earn one for every 7 days in a row, up to 2.
- A missed day uses one automatically.

**Badges**
- There are 22 badges. Three are hidden until earned.
- To add one, add an entry to `BADGES` in `src/lib/progress.ts`.

## Adding questions
Add entries to `public/questions.json` with a new unique `id`:

```json
{
  "id": "CYB-101",
  "category": "Category name",
  "question": "Question text?",
  "options": ["A", "B", "C", "D"],
  "correctIndex": 0,
  "hint": "A subtle nudge.",
  "explanation": "Shown only when answered correctly."
}
```

Don't reuse or change existing ids, or progress for that question is lost.

## Working on it locally
```
npm install
npm run dev      # local dev server
npm run build    # type-check and build to dist/
```

## Font
Figtree (SIL Open Font License, see `public/figtree-OFL.txt`).
