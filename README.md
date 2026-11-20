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
| `src/assets/contours.svg` | Faint topographic lines behind every screen (a mask; the colour and strength are `--bg-art` in `styles.css`) |
| `src/components/Home.tsx` | Home screen tile grid: Today's 10 (locks with a countdown once done) and Practice |
| `src/components/Tile.tsx` | A single home-screen tile |
| `src/components/QuestionView.tsx` | Question, answers, hint and result |
| `src/components/DoneView.tsx` | End-of-set summary for both modes |
| `src/components/Profile.tsx` | Profile screen |
| `src/components/Badge.tsx` | Level ring and badge medals |
| `src/components/Celebration.tsx` | Picks how to celebrate: the level-up, the badge/skill award, or a sheet for streak freezes |
| `src/components/LevelUp.tsx` | Full-screen level-up: the old level slams in, spins into the new one, slams down with confetti, floats, then fades (tap to skip) |
| `src/components/Sheet.tsx` | Slide-up bottom sheet (swipe down or tap outside to close), used for celebrations and badge details |
| `src/components/BlitzView.tsx` | Acronym Blitz: intro, the timed round and the results |
| `src/components/PhishView.tsx` | Spot the Phish: intro and level picker, the swipeable cards with inspecting, the flip to the explanation, results and the Directory |
| `src/components/Header.tsx`, `Ticks.tsx` | Small UI pieces |
| `src/components/icons.tsx` | Interface icons, mostly from [Lucide](https://lucide.dev) (`lucide-react`, ISC licence). Badge medals and glyphs are drawn separately in `Badge.tsx` |
| `src/components/Award.tsx` | Full-screen moment for a new badge or skill-up: a smaller version of the level-up |
| `src/hooks/useCountdown.ts` | Countdown to the next daily set |
| `src/hooks/useEdgeSwipe.ts` | Swipe from the left edge to go back Home |
| `src/lib/quiz.ts` | Quiz logic: daily draw, Smart Practice, streak, storage |
| `src/lib/progress.ts` | XP, levels, badges, streak freezes, category scores, recommendations |
| `src/lib/blitz.ts` | Acronym Blitz logic: difficulty ramp, reversed questions, scoring, XP cap |
| `src/lib/phish.ts` | Spot the Phish logic: dealing a round, scoring, streaks, XP cap |
| `src/lib/haptics.ts` | Light haptic taps (iPhone iOS 18+ and Android) |
| `src/lib/confetti.ts` | Small canvas confetti in the medal colours (off when the phone asks for reduced motion) |
| `public/questions.json` | The question bank |
| `public/acronyms.json` | The Acronym Blitz bank |
| `public/phish.json` | The Spot the Phish cards (written with placeholders) and the casts of fictional organisations |
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
A speed round against the clock, available from level 1. The round runs until your time runs out.

- Each question shows an acronym with 4 full names to choose from. About 1 in 6 is reversed: the full name is shown and you pick the acronym.
- The next question appears straight away. You start with 60 seconds. A right answer adds time (+3s for your first 10, +2s for the next 10, +1s for the next 10, then nothing) and a wrong answer takes 3 seconds off. The clock never goes above 60 seconds, so even a fast round ends after about 2 minutes. Tune it in `bonusMs()` in `src/lib/blitz.ts`.
- 5 right in a row starts a ×2 combo (each answer then scores 2) until you get one wrong.
- The bar under the header shows the time left out of 60 seconds. It turns orange for the last 10 seconds, and the haptics get firmer.
- It starts with common acronyms (tier 1) and moves to specialist ones (tier 3) as the round goes on.
- No acronym repeats within a round. Ones you get right are rested: new ones and ones you missed come first, and a right one only comes back once the others at that difficulty have been used (longest-ago first). The bank has 130, and a round uses about 25 to 45.
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

## Spot the Phish
Ten messages a round. Swipe left (or tap **Phish**) if it's an attack, swipe right (or tap **Legit**) if it's genuine. Available from level 1.

- **Cards:** emails, texts, Kestrel Chat messages, bare links, sign-in prompts, sign-in pages, app permission requests and voicemails.
- **A new cast every round:** one employer, bank, delivery company and energy supplier, picked at random from the fictional ones in `casts` in `public/phish.json` (4 employers, 3 of each of the others). Phone numbers come from Ofcom's ranges reserved for drama, so none are real.
- **The Directory** shows just the genuine details for this round's cast: each organisation's domain, phone number or text sender, and a rule or two. It's built in `directoryFor()` in `src/lib/phish.ts`. Open it from the intro or the chip above the card.
- **Inspecting, as on a real phone:**
  - Tap a sender's name to see the full address, including any different reply-to address.
  - Tap a browser address bar to see the full web address.
  - Press and hold a link to see where it really goes. A short tap just shows a reminder.
- **After each call** the card flies off the screen the way you chose, then the explanation flips in. The warning signs (red) or the reasons it's safe (green) are highlighted where they appear, each with a numbered note.
- **Levels:**
  - **Rookie:** from level 1, Rookie cards only.
  - **Analyst:** from level 4, 7 Analyst and 3 Rookie cards.
  - **Expert:** from level 7, 6 Expert, 3 Analyst and 1 Rookie card.
  - Each round has between 4 and 7 phish, so it's never a predictable 50/50.
- **Dealing:** cards you haven't seen come first, then the ones seen longest ago. A round has no more than 3 of one type (email, text and so on), and the same type rarely comes twice in a row.
- **Scoring:** out of 100. Each right call is 10, a false alarm (flagging a genuine message) is 3, and letting a phish through is 0.
- **Progress:**
  - Every answer is logged as mode `phish` under "Phishing and Social Engineering", so it feeds that skill on the Profile.
  - XP: 2 per right call (3 at Analyst, 4 at Expert) plus 10 per round, for the first 3 rounds each day.
- **Badges:** Gone Phishing (first round), Cool Head (no false alarms, at least 4 caught), Unhookable (20 caught in a row) and Expert Eye (a perfect Expert round).

### Adding cards
Add to `cards` in `public/phish.json` with a new unique `id`. Write organisation details as placeholders so the cast can change each round:

- **Employer:** `{E}` name, `{Es}` short name, `{Eslug}` domain name (`{Eslug}.co.uk`), `{Edig}` / `{Elet}` / `{Ehyp}` look-alikes (a digit 1, a letter i, a hyphen), `{Elow}`, `{Ephone}`, `{Ecity}`, `{Etown}`.
- **Bank:** `{B}`, `{Bs}`, `{Bslug}`, `{Bphone}`.
- **Delivery:** `{D}`, `{Dslug}`, `{Dlink}` (short links are `{Dlink}.uk`).
- **Energy:** `{N}`, `{Ns}`, `{Nslug}`, `{Nhyp}`, `{Nabbr}`, `{Nphone}`.

- `tier`: 1 Rookie, 2 Analyst, 3 Expert.
- `type`: one of `email`, `sms`, `chat`, `link`, `mfa`, `login`, `consent`, `voicemail`.
- `phish`: true or false.

Then fill in the fields for that type, following the existing cards:
- `from` with `name` and `address`, plus `replyTo` and `external` if needed;
- `subject`, `body` and `links` (`[[0]]` in the body marks where `links[0]` goes);
- `attachment`, `url`, `page`, `consent` or `mfa`.

Every card needs:
- `points`: the signs, or the reasons it's safe. Each one points at a part of the card (`at`: `from`, `replyTo`, `external`, `subject`, `attachment`, `link0`, `url`, `publisher`, `scopes`, `prompt`) or at an exact phrase in the text (`quote`).
- `lesson`: one line for the end screen.

A few rules for writing cards:
- Phishing cards should be polished, with no typos.
- Genuine cards can look a little alarming.
- Every giveaway should be checkable against the Directory.

## Profile, levels and badges
Tap the level ring (top right of Home) or the Profile tile.

**XP and ranks**
- XP: 10 per daily question right, 20 for finishing the set, 50 for a clean sweep, 5 per due review right in Practice (1 if it wasn't due). Acronym Blitz: 2 per right answer and 10 per finished round, for the first 3 rounds each day. Spot the Phish: 2 per right call (3 at Analyst, 4 at Expert) and 10 per round, for the first 3 rounds each day.
- Ranks run from Trainee (level 1) to CISO (level 10). Tap your rank name on the Profile to see your XP and all the ranks; tap the level ring to flip it. The XP needed for each is set in `RANKS` in `src/lib/progress.ts`.

**Category scores**
- Each category gets a score from 0 to 100, based on your last 30 answers with recent ones weighted more. It shows as a medal: bronze under 50, silver from 50, gold from 75, platinum from 90 (`skillTier` in `src/lib/progress.ts`).
- Skills are sorted highest first and fold away like badges. Tap one for a sheet with what it covers (`SKILL_INFO`), the score, and where to build it: questions learned, Practice items due, and Blitz acronyms on that topic.
- A score appears after 5 answers. Trend arrows compare with 2 weeks ago.

**Streak freezes**
- You earn one for every 7 days in a row, up to 2.
- A missed day uses one automatically.

**Badges**
- There are 28 badges, including one for the first time you play each mode. Three are hidden until earned.
- A new badge gets a short full-screen moment: the medal drops in with a shine and a little confetti. The same happens when a skill first reaches silver, gold or platinum. Level-ups get the bigger version.
- On the Profile they are ordered: earned (newest first), then closest to completion, then not started. Tap one to see its details and progress in a sheet that slides up; swipe it down or tap outside to close.
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
