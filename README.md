# Srilatha's X Word

An installable, mobile-first crossword app made for Srilatha. It is a Progressive Web App hosted free on GitHub Pages, requires no account, saves progress on the device, and downloads new puzzles without an app update.

## Install on iPhone

1. Open `https://rishavpunatar.github.io/srilathas-x-word/` in Safari.
2. Tap Share.
3. Choose **Add to Home Screen**.

The app opens in its own full-screen window and appears as **Srilatha's X Word** with its own icon.

## Publish a crossword

Edit `public/puzzles/index.json`, add the new puzzle at the beginning of the `puzzles` array, bump the feed version, and push to `main`. The included GitHub Actions workflow publishes it automatically. The installed app checks for new puzzle content when opened and retains the latest version offline.

Grid rows use capital letters for answers and `#` for black squares. All rows must have the same length. Clue keys use the standard numbers calculated from the grid.

## Development

```bash
npm install
npm run dev
npm test
```

`npm run build:github` creates the static GitHub Pages artifact in `out/`.

## Architecture

- Next.js and React player, exported as static files
- Web App Manifest and Home Screen icon for installation
- Service worker for offline play and fresh puzzle-feed checks
- Local browser storage for answers, elapsed time, and completion state
- GitHub Pages for free public-by-link hosting and automatic deployments

The repository and puzzle feed are public. If the puzzle solutions or messages ever need to be secret before release, move the feed to a small private API with scheduled publishing.
