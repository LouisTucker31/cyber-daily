# Cyber Daily 10

A front-end only PWA: 10 cybersecurity multiple-choice questions a day.

## Setup (GitHub Pages)
1. Upload all files to the root of a public repo (no folders needed).
2. Settings → Pages → Deploy from branch → `main` / root.
3. Open the Pages URL in Safari → Share → Add to Home Screen.

## How the daily draw works
- A new set of 10 unlocks at local midnight. Your set is saved, so closing or refreshing the app resumes where you left off. An answer is locked the moment you tap it.
- Correct answers are ticked off for the current round. Wrong answers go back in the pot and the answer is never shown.
- Yesterday's questions are held back, so you won't get the same one two days in a row unless nothing else is left.
- Questions you haven't seen for the longest are favoured, randomly among equals.
- If fewer than 10 remain, the rest are topped up with "Review" questions you've already got right. These don't affect progress.
- When every question is ticked off, a new round starts with the full bank.
- Answer order is shuffled every time a question appears.

Progress is stored on the device (localStorage). Deleting the home-screen app clears it.

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

New questions join the pot automatically on the next draw. Don't reuse or change existing ids, or progress for that question is lost.

## Updates
The service worker fetches the newest files whenever you're online and checks for a new version each time the app opens or comes back to the foreground, reloading once to apply it. Every release also bumps `CACHE_VERSION` in `sw.js` (currently `cyber-daily-v2`) so old cached copies are cleared.

## Font
Figtree (SIL Open Font License, see `figtree-OFL.txt`), bundled locally so it works offline.
