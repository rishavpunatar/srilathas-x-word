"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Direction = "across" | "down";

type Puzzle = {
  id: string;
  title: string;
  date: string;
  author: string;
  note?: string;
  completionMessage?: string;
  grid: string[];
  clues: Record<Direction, Record<string, string>>;
};

type Entry = {
  number: number;
  direction: Direction;
  cells: number[];
  clue: string;
};

const appBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const fallbackPuzzle: Puzzle = {
  id: "small-things-001",
  title: "Small Things",
  date: "24 August 2026",
  author: "Made with love",
  note: "Five tiny words for a quiet little moment together.",
  completionMessage: "You make the ordinary feel like the best part of the day.",
  grid: ["STUNG", "TENOR", "UNTIE", "NOISE", "GREET"],
  clues: {
    across: {
      "1": "Left smarting after meeting a bee",
      "6": "Voice between baritone and alto",
      "7": "Loosen, as a ribbon",
      "8": "Sound you might ask a neighbour to keep down",
      "9": "Welcome at the door",
    },
    down: {
      "1": "Felt the sharp end of a wasp",
      "2": "Singing range above baritone",
      "3": "Set a knot free",
      "4": "A racket, but not the tennis kind",
      "5": "Say hello to",
    },
  },
};

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function Icon({ name }: { name: "heart" | "menu" | "back" | "forward" | "close" | "spark" }) {
  const symbols = {
    heart: "♥",
    menu: "•••",
    back: "‹",
    forward: "›",
    close: "×",
    spark: "✦",
  };
  return <span aria-hidden="true">{symbols[name]}</span>;
}

export default function Home() {
  const [puzzles, setPuzzles] = useState<Puzzle[]>([fallbackPuzzle]);
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const puzzle = puzzles[puzzleIndex] ?? fallbackPuzzle;
  const rows = puzzle.grid.length;
  const cols = puzzle.grid[0]?.length ?? 0;
  const solution = useMemo(() => puzzle.grid.join("").toUpperCase(), [puzzle]);
  const emptyAnswers = useMemo(
    () => [...solution].map((letter) => (letter === "#" ? "#" : "")),
    [solution],
  );
  const [answers, setAnswers] = useState<string[]>(emptyAnswers);
  const [selected, setSelected] = useState(() => solution.indexOf("#") === 0 ? 1 : 0);
  const [direction, setDirection] = useState<Direction>("across");
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [complete, setComplete] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [loadedPuzzleId, setLoadedPuzzleId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { entries, numbers } = useMemo(() => {
    const nextEntries: Entry[] = [];
    const nextNumbers = new Map<number, number>();
    let number = 0;

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const index = row * cols + col;
        if (solution[index] === "#") continue;
        const startsAcross = (col === 0 || solution[index - 1] === "#") &&
          col + 1 < cols && solution[index + 1] !== "#";
        const startsDown = (row === 0 || solution[index - cols] === "#") &&
          row + 1 < rows && solution[index + cols] !== "#";
        if (startsAcross || startsDown) {
          number += 1;
          nextNumbers.set(index, number);
        }
        if (startsAcross) {
          const cells: number[] = [];
          for (let cursor = index; cursor < (row + 1) * cols && solution[cursor] !== "#"; cursor += 1) {
            cells.push(cursor);
          }
          nextEntries.push({
            number,
            direction: "across",
            cells,
            clue: puzzle.clues.across[String(number)] ?? "Clue coming soon",
          });
        }
        if (startsDown) {
          const cells: number[] = [];
          for (let cursor = index; cursor < solution.length && solution[cursor] !== "#"; cursor += cols) {
            cells.push(cursor);
          }
          nextEntries.push({
            number,
            direction: "down",
            cells,
            clue: puzzle.clues.down[String(number)] ?? "Clue coming soon",
          });
        }
      }
    }
    return { entries: nextEntries, numbers: nextNumbers };
  }, [cols, puzzle, rows, solution]);

  const directionEntries = useMemo(
    () => entries.filter((entry) => entry.direction === direction),
    [direction, entries],
  );
  const activeEntry = useMemo(() => {
    const inDirection = directionEntries.find((entry) => entry.cells.includes(selected));
    return inDirection ?? entries.find((entry) => entry.cells.includes(selected)) ?? entries[0];
  }, [directionEntries, entries, selected]);
  const activeCells = useMemo(() => new Set(activeEntry?.cells ?? []), [activeEntry]);
  const fillableCount = useMemo(() => [...solution].filter((letter) => letter !== "#").length, [solution]);
  const filledCount = answers.filter((letter) => letter && letter !== "#").length;
  const progress = Math.round((filledCount / Math.max(fillableCount, 1)) * 100);

  useEffect(() => {
    fetch(`${appBasePath}/puzzles/index.json?now=${Date.now()}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((feed: { puzzles?: Puzzle[] }) => {
        if (feed.puzzles?.length) setPuzzles(feed.puzzles);
      })
      .catch(() => undefined);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register(`${appBasePath}/sw.js`).catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    setLoadedPuzzleId(null);
    const saved = localStorage.getItem(`srilathas-x-word:${puzzle.id}`);
    if (saved) {
      try {
        const state = JSON.parse(saved) as { answers?: string[]; elapsed?: number; complete?: boolean };
        setAnswers(state.answers?.length === solution.length ? state.answers : emptyAnswers);
        setElapsed(state.elapsed ?? 0);
        setComplete(state.complete ?? false);
      } catch {
        setAnswers(emptyAnswers);
        setElapsed(0);
        setComplete(false);
      }
    } else {
      setAnswers(emptyAnswers);
      setElapsed(0);
      setComplete(false);
    }
    setChecked(new Set());
    setSelected(solution.indexOf("#") === 0 ? 1 : 0);
    setDirection("across");
    setLoadedPuzzleId(puzzle.id);
  }, [emptyAnswers, puzzle.id, solution.length]);

  useEffect(() => {
    if (loadedPuzzleId !== puzzle.id) return;
    localStorage.setItem(
      `srilathas-x-word:${puzzle.id}`,
      JSON.stringify({ answers, elapsed, complete }),
    );
  }, [answers, complete, elapsed, loadedPuzzleId, puzzle.id]);

  useEffect(() => {
    if (paused || complete) return undefined;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [complete, paused]);

  const selectCell = useCallback((index: number, requestedDirection?: Direction) => {
    if (solution[index] === "#") return;
    if (requestedDirection) {
      setDirection(requestedDirection);
    } else if (selected === index) {
      const hasAcross = entries.some((entry) => entry.direction === "across" && entry.cells.includes(index));
      const hasDown = entries.some((entry) => entry.direction === "down" && entry.cells.includes(index));
      if (hasAcross && hasDown) setDirection((value) => (value === "across" ? "down" : "across"));
    } else {
      const currentFits = entries.some((entry) => entry.direction === direction && entry.cells.includes(index));
      if (!currentFits) setDirection(direction === "across" ? "down" : "across");
    }
    setSelected(index);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [direction, entries, selected, solution]);

  const moveWithinEntry = useCallback((delta: number) => {
    if (!activeEntry) return;
    const position = activeEntry.cells.indexOf(selected);
    const next = activeEntry.cells[Math.max(0, Math.min(activeEntry.cells.length - 1, position + delta))];
    if (next !== undefined) setSelected(next);
  }, [activeEntry, selected]);

  const moveToEntry = useCallback((delta: number) => {
    if (!activeEntry || !directionEntries.length) return;
    const position = directionEntries.findIndex((entry) => entry.number === activeEntry.number);
    const next = directionEntries[(position + delta + directionEntries.length) % directionEntries.length];
    setSelected(next.cells[0]);
  }, [activeEntry, directionEntries]);

  const enterLetter = useCallback((letter: string) => {
    if (!/^[a-z]$/i.test(letter) || solution[selected] === "#") return;
    setAnswers((current) => {
      const next = [...current];
      next[selected] = letter.toUpperCase();
      const solved = next.every((value, index) => solution[index] === "#" || value === solution[index]);
      if (solved) {
        window.setTimeout(() => setComplete(true), 180);
        setChecked(new Set());
      }
      return next;
    });
    setChecked((current) => {
      const next = new Set(current);
      next.delete(selected);
      return next;
    });
    moveWithinEntry(1);
  }, [moveWithinEntry, selected, solution]);

  const handleKey = useCallback((event: KeyboardEvent | React.KeyboardEvent<HTMLInputElement>) => {
    if (menuOpen || installOpen || archiveOpen) return;
    if (/^[a-z]$/i.test(event.key)) {
      event.preventDefault();
      enterLetter(event.key);
      return;
    }
    if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      if (answers[selected]) {
        setAnswers((current) => current.map((value, index) => index === selected ? "" : value));
      } else {
        moveWithinEntry(-1);
      }
      setChecked((current) => {
        const next = new Set(current);
        next.delete(selected);
        return next;
      });
      return;
    }
    if (event.key === "Tab" || event.key === "Enter") {
      event.preventDefault();
      moveToEntry(event.shiftKey ? -1 : 1);
      return;
    }
    if (event.key === " ") {
      event.preventDefault();
      setDirection((value) => value === "across" ? "down" : "across");
      return;
    }
    const offsets: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -cols,
      ArrowDown: cols,
    };
    if (event.key in offsets) {
      event.preventDefault();
      const next = selected + offsets[event.key];
      if (next >= 0 && next < solution.length && solution[next] !== "#") {
        setSelected(next);
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") setDirection("across");
        else setDirection("down");
      }
    }
  }, [answers, archiveOpen, cols, enterLetter, installOpen, menuOpen, moveToEntry, selected, solution]);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => handleKey(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [handleKey]);

  const checkPuzzle = () => {
    const incorrect = new Set<number>();
    answers.forEach((answer, index) => {
      if (answer && answer !== "#" && answer !== solution[index]) incorrect.add(index);
    });
    setChecked(incorrect);
    setMenuOpen(false);
    if (incorrect.size === 0 && filledCount === fillableCount) setComplete(true);
  };

  const revealWord = () => {
    if (!activeEntry) return;
    setAnswers((current) => current.map((value, index) =>
      activeEntry.cells.includes(index) ? solution[index] : value,
    ));
    setChecked(new Set());
    setMenuOpen(false);
  };

  const resetPuzzle = () => {
    setAnswers(emptyAnswers);
    setElapsed(0);
    setComplete(false);
    setChecked(new Set());
    setMenuOpen(false);
  };

  return (
    <main className="app-shell">
      <input
        ref={inputRef}
        className="keyboard-capture"
        aria-label="Type a crossword letter"
        autoCapitalize="characters"
        autoCorrect="off"
        autoComplete="off"
        inputMode="text"
        value=""
        onChange={(event) => {
          const value = event.target.value;
          if (value) enterLetter(value.slice(-1));
        }}
        onKeyDown={(event) => {
          event.stopPropagation();
          handleKey(event);
        }}
      />

      <header className="topbar">
        <button className="brand" onClick={() => setArchiveOpen(true)} aria-label="Open puzzle archive">
          <span className="brand-mark"><Icon name="heart" /></span>
          <span className="brand-label">SRILATHA’S X WORD</span>
        </button>
        <div className="topbar-actions">
          <button className="timer" onClick={() => setPaused((value) => !value)} aria-label={paused ? "Resume timer" : "Pause timer"}>
            <span className={paused ? "timer-dot paused" : "timer-dot"} />
            {paused ? "PAUSED" : formatTime(elapsed)}
          </button>
          <button className="icon-button" onClick={() => setMenuOpen(true)} aria-label="Puzzle options">
            <Icon name="menu" />
          </button>
        </div>
      </header>

      <section className="puzzle-heading">
        <div>
          <p className="eyebrow">{puzzle.date}</p>
          <h1>{puzzle.title}</h1>
          <p className="byline">{puzzle.author}</p>
        </div>
        <button className="archive-link" onClick={() => setArchiveOpen(true)}>
          {puzzles.length > 1 ? `${puzzles.length} puzzles` : "Puzzle archive"} <Icon name="forward" />
        </button>
      </section>

      <div className="progress-track" aria-label={`${progress}% complete`}>
        <div style={{ width: `${progress}%` }} />
      </div>

      <section className="solver-layout">
        <div className="board-column">
          <div
            className="grid"
            role="grid"
            aria-label={`${rows} by ${cols} crossword grid`}
            style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
          >
            {[...solution].map((solutionLetter, index) => {
              const isBlock = solutionLetter === "#";
              const isSelected = selected === index;
              const isActive = activeCells.has(index);
              const isWrong = checked.has(index);
              return isBlock ? (
                <div className="cell block" key={index} role="presentation" />
              ) : (
                <button
                  key={index}
                  type="button"
                  role="gridcell"
                  className={`cell ${isActive ? "active" : ""} ${isSelected ? "selected" : ""} ${isWrong ? "wrong" : ""}`}
                  onClick={() => selectCell(index)}
                  aria-label={`${numbers.get(index) ? `${numbers.get(index)}, ` : ""}${answers[index] || "blank"}`}
                  aria-selected={isSelected}
                >
                  {numbers.has(index) && <span className="cell-number">{numbers.get(index)}</span>}
                  <span className="cell-letter">{answers[index]}</span>
                  {isWrong && <span className="wrong-mark" aria-label="incorrect">·</span>}
                </button>
              );
            })}
          </div>

          <div className="active-clue" aria-live="polite">
            <button onClick={() => moveToEntry(-1)} aria-label="Previous clue"><Icon name="back" /></button>
            <div>
              <span>{activeEntry?.number} {direction === "across" ? "Across" : "Down"}</span>
              <p>{activeEntry?.clue}</p>
            </div>
            <button onClick={() => moveToEntry(1)} aria-label="Next clue"><Icon name="forward" /></button>
          </div>

          {puzzle.note && <p className="puzzle-note"><Icon name="heart" /> {puzzle.note}</p>}
        </div>

        <aside className="clue-panel">
          {(["across", "down"] as Direction[]).map((clueDirection) => (
            <div className="clue-section" key={clueDirection}>
              <h2>{clueDirection}</h2>
              <ol>
                {entries.filter((entry) => entry.direction === clueDirection).map((entry) => (
                  <li key={`${clueDirection}-${entry.number}`}>
                    <button
                      className={activeEntry?.number === entry.number && direction === clueDirection ? "current" : ""}
                      onClick={() => selectCell(entry.cells[0], clueDirection)}
                    >
                      <span>{entry.number}</span>
                      <span>{entry.clue}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </aside>
      </section>

      <footer>
        <span>{filledCount} of {fillableCount} squares</span>
        <button onClick={() => setInstallOpen(true)}>Add to iPhone</button>
      </footer>

      {paused && (
        <div className="pause-screen" role="dialog" aria-modal="true" aria-label="Puzzle paused">
          <div><Icon name="heart" /></div>
          <h2>Take your time.</h2>
          <p>The puzzle will be right here.</p>
          <button className="primary-button" onClick={() => setPaused(false)}>Keep solving</button>
        </div>
      )}

      {menuOpen && (
        <div className="scrim" onClick={() => setMenuOpen(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label="Puzzle options" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-heading">
              <div><p className="eyebrow">Puzzle options</p><h2>{puzzle.title}</h2></div>
              <button className="icon-button" onClick={() => setMenuOpen(false)} aria-label="Close"><Icon name="close" /></button>
            </div>
            <button className="sheet-action" onClick={checkPuzzle}><span>Check puzzle</span><small>Mark any letters that need another look</small></button>
            <button className="sheet-action" onClick={revealWord}><span>Reveal this word</span><small>Fill {activeEntry?.number} {direction}</small></button>
            <button className="sheet-action danger" onClick={resetPuzzle}><span>Start over</span><small>Clear your answers and timer</small></button>
          </div>
        </div>
      )}

      {installOpen && (
        <div className="scrim" onClick={() => setInstallOpen(false)}>
          <div className="sheet install-sheet" role="dialog" aria-modal="true" aria-label="Install Srilatha’s X Word" onClick={(event) => event.stopPropagation()}>
            <div className="install-icon"><Icon name="heart" /></div>
            <button className="sheet-close icon-button" onClick={() => setInstallOpen(false)} aria-label="Close"><Icon name="close" /></button>
            <p className="eyebrow">Keep it close</p>
            <h2>Add Srilatha’s X Word to your iPhone</h2>
            <div className="install-step"><span>1</span><p>Open this page in <strong>Safari</strong>.</p></div>
            <div className="install-step"><span>2</span><p>Tap the <strong>Share</strong> button.</p></div>
            <div className="install-step"><span>3</span><p>Choose <strong>Add to Home Screen</strong>.</p></div>
            <p className="install-footnote">New puzzles arrive inside the app automatically—there is nothing else to download.</p>
          </div>
        </div>
      )}

      {archiveOpen && (
        <div className="scrim" onClick={() => setArchiveOpen(false)}>
          <div className="sheet archive-sheet" role="dialog" aria-modal="true" aria-label="Puzzle archive" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-heading">
              <div><p className="eyebrow">Made for you</p><h2>Puzzle archive</h2></div>
              <button className="icon-button" onClick={() => setArchiveOpen(false)} aria-label="Close"><Icon name="close" /></button>
            </div>
            <div className="archive-list">
              {puzzles.map((item, index) => (
                <button key={item.id} onClick={() => { setPuzzleIndex(index); setArchiveOpen(false); }}>
                  <span className="archive-date">{item.date}</span>
                  <span><strong>{item.title}</strong><small>{item.author}</small></span>
                  <span className={index === puzzleIndex ? "archive-status current" : "archive-status"}>{index === puzzleIndex ? "Open" : "Play"}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {complete && (
        <div className="scrim celebration">
          <div className="complete-card" role="dialog" aria-modal="true" aria-label="Puzzle complete">
            <div className="confetti"><span>✦</span><span>♥</span><span>✦</span></div>
            <p className="eyebrow">Perfect solve</p>
            <h2>You got every square.</h2>
            <p className="completion-message">“{puzzle.completionMessage ?? "See you at the next one."}”</p>
            <div className="result-row"><span>Time<strong>{formatTime(elapsed)}</strong></span><span>Puzzle<strong>{puzzle.title}</strong></span></div>
            <button className="primary-button" onClick={() => setComplete(false)}>Back to puzzle</button>
          </div>
        </div>
      )}
    </main>
  );
}
