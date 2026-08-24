# Publishing puzzles to Srilatha's X Word

The installed app and its crossword content are deliberately separate. The app checks `public/puzzles/index.json` whenever it opens, and its service worker keeps the latest puzzle available offline.

## Send a new puzzle

1. Add the new puzzle object at the start of the `puzzles` array in `public/puzzles/index.json`.
2. Give it a unique `id` and bump the top-level `version`.
3. Commit and push to the `main` branch on GitHub. GitHub Pages republishes automatically. The new puzzle will appear the next time the app opens; no reinstall is required.

Use `#` for a black square and capital letters for answer squares. Every grid row must have the same length. Clue keys use the standard crossword number calculated from the grid. `enumerations` records each answer’s word lengths, such as `"5, 5"`. The player supports any rectangular connected grid, Across and Down entries, touch and hardware keyboards, whole-grid scoring without answer reveals, progress saving, timing, and an archive.

## Production architecture

The production app is a free installable web app hosted by GitHub Pages. When you want an authoring screen and push alerts, replace the JSON feed with a small authenticated puzzle API and database while keeping this player unchanged. A server can then send standards-based Web Push notifications to the Home Screen app when a puzzle is published.
