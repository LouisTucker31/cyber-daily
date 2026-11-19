# Cyber Daily 10

A daily cybersecurity quiz PWA: 10 multiple-choice questions a day.
Built with React, TypeScript and Vite. Every source file lives in the repo root.

## Files
| File | What it is |
| --- | --- |
| `index.html` | Page shell |
| `main.tsx` | Starts the app, zoom lock, service worker registration and auto-update |
| `App.tsx` | Loads questions, holds state, switches between Home, Today's 10 and Practice |
| `Home.tsx` | Home screen tile grid: Today's 10 (locks with a countdown once done) and Practice |
| `Tile.tsx` | A single home-screen tile |
| `useCountdown.ts` | Countdown to the next daily set |
| `QuestionView.tsx` | Question, answers, hint and result |
| `DoneView.tsx` | End-of-set summary for both modes |
| `Header.tsx`, `Ticks.tsx`, `icons.tsx` | Small UI pieces |
| `quiz.ts` | All quiz logic: daily draw, progress, streak, storage |
| `styles.css` | All styling |
| `questions.json` | The question bank |
| `sw.js` | Service worker (offline + updates) |
| `manifest.json`, icons, `figtree.woff2` | PWA manifest, icons and font |
| `vite.config.ts`, `tsconfig.json`, `package.json`, `package-lock.json` | Build setup |
| `deploy.yml` | GitHub Actions workflow (see below) |

## Publishing on GitHub Pages
A Vite app has to be built before it can be served, so GitHub builds it for you on every push.

1. Upload every file to the root of the repo.
2. **Add file → Create new file**, type the name `.github/workflows/deploy.yml` (the slashes create the folders), paste in the contents of `deploy.yml`, and commit.
3. **Settings → Pages → Source: GitHub Actions**.
4. Check the **Actions** tab: when the run goes green, the app is live at your Pages URL.

From then on, every commit rebuilds and redeploys automatically.

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
In `Home.tsx`, add an entry to the `tiles` list. Each tile has a `title`, `icon`, one-line `meta`, optional `foot`, a `tone` (`feature` orange, `feature-done` soft orange, `plain` white, `locked` grey) and an `onOpen` action. Tiles flow into the two-column grid automatically; set `wide: true` to span both columns.

## Practice
Practice rounds of up to 10 use questions you've answered correctly at least once, least recently practised first. A wrong answer shows the right one and the explanation. Practice never changes daily progress or the streak.

## Adding questions
Add entries to `questions.json` with a new unique `id`:

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
Figtree (SIL Open Font License, see `figtree-OFL.txt`).
