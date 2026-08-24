"use client";

import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import puzzleFeed from "@/public/puzzles/index.json";

type Direction = "across" | "down";

type Puzzle = {
  id: string;
  number: number;
  title: string;
  date: string;
  author: string;
  note?: string;
  completionMessage?: string;
  grid: string[];
  clues: Record<Direction, Record<string, string>>;
  enumerations: Record<Direction, Record<string, string>>;
};

type Entry = {
  number: number;
  direction: Direction;
  cells: number[];
  clue: string;
  enumeration: string;
};

type Submission = {
  correct: number;
  total: number;
  percentage: number;
};

const appBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const initialPuzzles = puzzleFeed.puzzles as unknown as Puzzle[];

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function entryKey(entry: Entry) {
  return `${entry.direction}-${entry.number}`;
}

function directionLabel(direction: Direction) {
  return direction === "across" ? "Across" : "Down";
}

function Icon({ name }: { name: "heart" | "menu" | "back" | "forward" | "close" | "check" | "help" | "share" }) {
  const symbols = {
    heart: "♥",
    menu: "•••",
    back: "‹",
    forward: "›",
    close: "×",
    check: "✓",
    help: "?",
    share: "↗",
  };
  return <span aria-hidden="true">{symbols[name]}</span>;
}

function BrandMark({ large = false }: { large?: boolean }) {
  return (
    <span className={large ? "brand-mark brand-mark-large" : "brand-mark"} aria-hidden="true">
      <span className="brand-x">X</span>
      <span className="brand-heart">♥</span>
    </span>
  );
}

export default function Home() {
  const [puzzles, setPuzzles] = useState<Puzzle[]>(initialPuzzles);
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const puzzle = puzzles[puzzleIndex] ?? initialPuzzles[0];
  const rows = puzzle.grid.length;
  const cols = puzzle.grid[0]?.length ?? 0;
  const solution = useMemo(() => puzzle.grid.join("").toUpperCase(), [puzzle]);
  const firstOpenCell = useMemo(() => Math.max(0, [...solution].findIndex((letter) => letter !== "#")), [solution]);
  const emptyAnswers = useMemo(
    () => [...solution].map((letter) => (letter === "#" ? "#" : "")),
    [solution],
  );

  const [answers, setAnswers] = useState<string[]>(emptyAnswers);
  const [selected, setSelected] = useState(firstOpenCell);
  const [direction, setDirection] = useState<Direction>("across");
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [complete, setComplete] = useState(false);
  const [completionOpen, setCompletionOpen] = useState(false);
  const [submissionCount, setSubmissionCount] = useState(0);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [needsWork, setNeedsWork] = useState<Set<string>>(new Set());
  const [verified, setVerified] = useState<Set<string>>(new Set());
  const [menuOpen, setMenuOpen] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
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
          for (let cursor = index; cursor < (row + 1) * cols && solution[cursor] !== "#"; cursor += 1) cells.push(cursor);
          nextEntries.push({
            number,
            direction: "across",
            cells,
            clue: puzzle.clues.across[String(number)] ?? "Clue coming soon",
            enumeration: puzzle.enumerations.across[String(number)] ?? String(cells.length),
          });
        }
        if (startsDown) {
          const cells: number[] = [];
          for (let cursor = index; cursor < solution.length && solution[cursor] !== "#"; cursor += cols) cells.push(cursor);
          nextEntries.push({
            number,
            direction: "down",
            cells,
            clue: puzzle.clues.down[String(number)] ?? "Clue coming soon",
            enumeration: puzzle.enumerations.down[String(number)] ?? String(cells.length),
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
  const needsWorkCells = useMemo(() => {
    const cells = new Set<number>();
    for (const entry of entries) {
      if (needsWork.has(entryKey(entry))) entry.cells.forEach((cell) => cells.add(cell));
    }
    return cells;
  }, [entries, needsWork]);
  const fillableCount = useMemo(() => [...solution].filter((letter) => letter !== "#").length, [solution]);
  const filledCount = answers.filter((letter) => letter && letter !== "#").length;
  const remainingCount = fillableCount - filledCount;
  const progress = Math.round((filledCount / Math.max(fillableCount, 1)) * 100);

  useEffect(() => {
    fetch(`${appBasePath}/puzzles/index.json?now=${Date.now()}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((feed: { puzzles?: Puzzle[] }) => {
        if (feed.puzzles?.length) setPuzzles(feed.puzzles);
      })
      .catch(() => undefined);

    if ("serviceWorker" in navigator && !["localhost", "127.0.0.1"].includes(window.location.hostname)) {
      navigator.serviceWorker.register(`${appBasePath}/sw.js`, { updateViaCache: "none" }).catch(() => undefined);
    }

    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const setupFrame = window.requestAnimationFrame(() => {
      setIsStandalone(standalone);
      if (!localStorage.getItem("srilathas-x-word:welcomed")) setWelcomeOpen(true);
    });
    return () => window.cancelAnimationFrame(setupFrame);
  }, []);

  useEffect(() => {
    const loadFrame = window.requestAnimationFrame(() => {
      setLoadedPuzzleId(null);
      const saved = localStorage.getItem(`srilathas-x-word:${puzzle.id}`);
      if (saved) {
        try {
          const state = JSON.parse(saved) as {
            answers?: string[];
            elapsed?: number;
            complete?: boolean;
            submissionCount?: number;
          };
          setAnswers(state.answers?.length === solution.length ? state.answers : emptyAnswers);
          setElapsed(state.elapsed ?? 0);
          setComplete(state.complete ?? false);
          setCompletionOpen(false);
          setSubmissionCount(state.submissionCount ?? 0);
        } catch {
          setAnswers(emptyAnswers);
          setElapsed(0);
          setComplete(false);
          setCompletionOpen(false);
          setSubmissionCount(0);
        }
      } else {
        setAnswers(emptyAnswers);
        setElapsed(0);
        setComplete(false);
        setCompletionOpen(false);
        setSubmissionCount(0);
      }
      setNeedsWork(new Set());
      setVerified(new Set());
      setSubmission(null);
      setSelected(firstOpenCell);
      setDirection(entries.find((entry) => entry.cells.includes(firstOpenCell))?.direction ?? "across");
      setLoadedPuzzleId(puzzle.id);
    });
    return () => window.cancelAnimationFrame(loadFrame);
  }, [emptyAnswers, entries, firstOpenCell, puzzle.id, solution.length]);

  useEffect(() => {
    if (loadedPuzzleId !== puzzle.id) return;
    localStorage.setItem(
      `srilathas-x-word:${puzzle.id}`,
      JSON.stringify({ answers, elapsed, complete, submissionCount }),
    );
  }, [answers, complete, elapsed, loadedPuzzleId, puzzle.id, submissionCount]);

  useEffect(() => {
    if (paused || complete || welcomeOpen) return undefined;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [complete, paused, welcomeOpen]);

  const clearFeedbackForCell = useCallback((index: number) => {
    const relatedKeys = entries.filter((entry) => entry.cells.includes(index)).map(entryKey);
    setNeedsWork((current) => {
      const next = new Set(current);
      relatedKeys.forEach((key) => next.delete(key));
      return next;
    });
    setVerified((current) => {
      const next = new Set(current);
      relatedKeys.forEach((key) => next.delete(key));
      return next;
    });
    setSubmission(null);
  }, [entries]);

  const focusKeyboard = useCallback(() => {
    if (!complete) inputRef.current?.focus({ preventScroll: true });
  }, [complete]);

  const changeDirection = useCallback((nextDirection: Direction) => {
    setDirection(nextDirection);
    const currentEntry = entries.find((entry) => entry.direction === nextDirection && entry.cells.includes(selected));
    if (!currentEntry) {
      const firstEntry = entries.find((entry) => entry.direction === nextDirection);
      if (firstEntry) setSelected(firstEntry.cells[0]);
    }
    focusKeyboard();
  }, [entries, focusKeyboard, selected]);

  const selectCell = useCallback((index: number, requestedDirection?: Direction) => {
    if (solution[index] === "#") return;
    if (requestedDirection) {
      setDirection(requestedDirection);
    } else if (selected === index) {
      const hasAcross = entries.some((entry) => entry.direction === "across" && entry.cells.includes(index));
      const hasDown = entries.some((entry) => entry.direction === "down" && entry.cells.includes(index));
      if (hasAcross && hasDown) setDirection((value) => value === "across" ? "down" : "across");
    } else {
      const currentFits = entries.some((entry) => entry.direction === direction && entry.cells.includes(index));
      if (!currentFits) {
        const otherDirection = direction === "across" ? "down" : "across";
        if (entries.some((entry) => entry.direction === otherDirection && entry.cells.includes(index))) setDirection(otherDirection);
      }
    }
    setSelected(index);
    focusKeyboard();
  }, [direction, entries, focusKeyboard, selected, solution]);

  const moveWithinEntry = useCallback((delta: number) => {
    if (!activeEntry) return;
    const position = activeEntry.cells.indexOf(selected);
    const next = activeEntry.cells[Math.max(0, Math.min(activeEntry.cells.length - 1, position + delta))];
    if (next !== undefined) setSelected(next);
  }, [activeEntry, selected]);

  const moveToEntry = useCallback((delta: number) => {
    const list = entries.filter((entry) => entry.direction === direction);
    if (!activeEntry || !list.length) return;
    const position = list.findIndex((entry) => entry.number === activeEntry.number && entry.direction === activeEntry.direction);
    const next = list[(Math.max(position, 0) + delta + list.length) % list.length];
    setSelected(next.cells[0]);
    focusKeyboard();
  }, [activeEntry, direction, entries, focusKeyboard]);

  const enterLetter = useCallback((letter: string) => {
    if (!/^[a-z]$/i.test(letter) || solution[selected] === "#") return;
    clearFeedbackForCell(selected);
    setAnswers((current) => current.map((value, index) => index === selected ? letter.toUpperCase() : value));
    moveWithinEntry(1);
  }, [clearFeedbackForCell, moveWithinEntry, selected, solution]);

  const handleKey = useCallback((event: KeyboardEvent | ReactKeyboardEvent<HTMLInputElement>) => {
    if (menuOpen || installOpen || helpOpen || archiveOpen || resetOpen || submission || complete || welcomeOpen) return;
    if (/^[a-z]$/i.test(event.key)) {
      event.preventDefault();
      enterLetter(event.key);
      return;
    }
    if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      if (answers[selected]) {
        clearFeedbackForCell(selected);
        setAnswers((current) => current.map((value, index) => index === selected ? "" : value));
      } else if (activeEntry) {
        const position = activeEntry.cells.indexOf(selected);
        const previous = activeEntry.cells[Math.max(0, position - 1)];
        clearFeedbackForCell(previous);
        setAnswers((current) => current.map((value, index) => index === previous ? "" : value));
        setSelected(previous);
      }
      return;
    }
    if (event.key === "Tab" || event.key === "Enter") {
      event.preventDefault();
      moveToEntry(event.shiftKey ? -1 : 1);
      return;
    }
    if (event.key === " ") {
      event.preventDefault();
      changeDirection(direction === "across" ? "down" : "across");
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
        setDirection(event.key === "ArrowLeft" || event.key === "ArrowRight" ? "across" : "down");
      }
    }
  }, [activeEntry, answers, archiveOpen, changeDirection, clearFeedbackForCell, cols, complete, direction, enterLetter, helpOpen, installOpen, menuOpen, moveToEntry, resetOpen, selected, solution, submission, welcomeOpen]);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => handleKey(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [handleKey]);

  const submitPuzzle = () => {
    if (remainingCount > 0) return;
    const correctKeys = new Set<string>();
    const incorrectKeys = new Set<string>();
    for (const entry of entries) {
      const isCorrect = entry.cells.every((cell) => answers[cell] === solution[cell]);
      (isCorrect ? correctKeys : incorrectKeys).add(entryKey(entry));
    }
    const correct = correctKeys.size;
    const nextSubmissionCount = submissionCount + 1;
    setSubmissionCount(nextSubmissionCount);
    setNeedsWork(incorrectKeys);
    setVerified(correctKeys);
    if (correct === entries.length) {
      setComplete(true);
      setCompletionOpen(true);
      setSubmission(null);
    } else {
      setSubmission({
        correct,
        total: entries.length,
        percentage: Math.round((correct / entries.length) * 100),
      });
    }
  };

  const resetPuzzle = () => {
    setAnswers(emptyAnswers);
    setElapsed(0);
    setComplete(false);
    setCompletionOpen(false);
    setSubmissionCount(0);
    setNeedsWork(new Set());
    setVerified(new Set());
    setSubmission(null);
    setSelected(firstOpenCell);
    setResetOpen(false);
  };

  const startPuzzle = () => {
    localStorage.setItem("srilathas-x-word:welcomed", "true");
    focusKeyboard();
    setWelcomeOpen(false);
  };

  const shareScore = async () => {
    const text = `Srilatha’s X Word · No. ${puzzle.number}\n10/10 · ${formatTime(elapsed)}\nHandle with Urgent Care`;
    if (navigator.share) {
      await navigator.share({ title: "Srilatha’s X Word", text }).catch(() => undefined);
    } else {
      await navigator.clipboard?.writeText(text).catch(() => undefined);
    }
  };

  const gridStyle = {
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    "--grid-cols": cols,
  } as CSSProperties;

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
        disabled={complete}
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
        <button className="brand" onClick={() => setWelcomeOpen(true)} aria-label="About Srilatha’s X Word">
          <BrandMark />
          <span className="brand-label">SRILATHA’S X WORD</span>
        </button>
        <div className="topbar-actions">
          <button className="timer" onClick={() => setPaused((value) => !value)} aria-label={paused ? "Resume timer" : "Pause timer"}>
            <span className={paused ? "timer-dot paused" : "timer-dot"} />
            {paused ? "PAUSED" : formatTime(elapsed)}
          </button>
          <button className="icon-button" onClick={() => setMenuOpen(true)} aria-label="Puzzle options"><Icon name="menu" /></button>
        </div>
      </header>

      <section className="puzzle-heading">
        <div>
          <p className="eyebrow">Srilatha’s X Word · No. {puzzle.number}</p>
          <h1>{puzzle.title}</h1>
          <p className="byline">{puzzle.author}</p>
        </div>
        <button className="archive-link" onClick={() => setHelpOpen(true)}>How to play <Icon name="forward" /></button>
      </section>

      <div className="progress-row">
        <div className="progress-track" aria-label={`${progress}% complete`}><div style={{ width: `${progress}%` }} /></div>
        <span>{progress}%</span>
      </div>

      {!isStandalone && (
        <aside className="install-banner">
          <BrandMark />
          <div>
            <strong>The full-screen edition</strong>
            <span>Add Srilatha’s X Word to your Home Screen for a beautifully focused experience.</span>
          </div>
          <button onClick={() => setInstallOpen(true)}>Add to iPhone</button>
        </aside>
      )}

      <section className="solver-layout">
        <div className="board-column">
          <div className="grid" role="grid" aria-label={`${rows} by ${cols} crossword grid`} style={gridStyle}>
            {[...solution].map((solutionLetter, index) => {
              if (solutionLetter === "#") return <div className="cell block" key={index} role="presentation" />;
              const isSelected = selected === index;
              const isActive = activeCells.has(index);
              const requiresWork = needsWorkCells.has(index);
              return (
                <button
                  key={index}
                  type="button"
                  role="gridcell"
                  className={`cell ${isActive ? "active" : ""} ${isSelected ? "selected" : ""} ${requiresWork ? "needs-work" : ""}`}
                  onClick={(event) => {
                    event.preventDefault();
                    selectCell(index);
                  }}
                  aria-label={`${numbers.get(index) ? `${numbers.get(index)}, ` : ""}${answers[index] || "blank"}${requiresWork ? ", in an answer that needs another look" : ""}`}
                  aria-selected={isSelected}
                >
                  {numbers.has(index) && <span className="cell-number">{numbers.get(index)}</span>}
                  <span className="cell-letter">{answers[index]}</span>
                </button>
              );
            })}
          </div>

          <div className={activeEntry && needsWork.has(entryKey(activeEntry)) ? "active-clue active-clue-wrong" : "active-clue"} aria-live="polite">
            <button onClick={() => moveToEntry(-1)} aria-label="Previous clue"><Icon name="back" /></button>
            <div>
              <span>{activeEntry?.number} {activeEntry ? directionLabel(activeEntry.direction) : ""} · ({activeEntry?.enumeration})</span>
              <p>{activeEntry?.clue}</p>
              {activeEntry && needsWork.has(entryKey(activeEntry)) && <small>Needs another look — no answer revealed</small>}
            </div>
            <button onClick={() => moveToEntry(1)} aria-label="Next clue"><Icon name="forward" /></button>
          </div>

          <div className="submit-area">
            <button className="primary-button submit-button" disabled={complete || remainingCount > 0} onClick={submitPuzzle}>
              {complete ? "Completed · 10/10" : remainingCount > 0 ? `${remainingCount} square${remainingCount === 1 ? "" : "s"} to go` : "Submit puzzle"}
            </button>
            <p>{complete ? "Perfect score recorded." : remainingCount > 0 ? "Fill every square to submit your answers." : "Ready when you are. Answers are checked together."}</p>
          </div>

          {puzzle.note && <p className="puzzle-note"><Icon name="heart" /> {puzzle.note}</p>}
        </div>

        <aside className="clue-panel">
          <div className="clue-tabs" role="tablist" aria-label="Clue direction">
            {(["across", "down"] as Direction[]).map((tabDirection) => (
              <button
                key={tabDirection}
                role="tab"
                aria-selected={direction === tabDirection}
                className={direction === tabDirection ? "selected-tab" : ""}
                onClick={() => changeDirection(tabDirection)}
              >
                {directionLabel(tabDirection)}
              </button>
            ))}
          </div>
          {(["across", "down"] as Direction[]).map((clueDirection) => (
            <div className={`clue-section ${direction === clueDirection ? "mobile-current" : ""}`} key={clueDirection}>
              <h2>{clueDirection}</h2>
              <ol>
                {entries.filter((entry) => entry.direction === clueDirection).map((entry) => {
                  const key = entryKey(entry);
                  const current = activeEntry && key === entryKey(activeEntry);
                  const status = needsWork.has(key) ? "needs-work" : verified.has(key) ? "verified" : "";
                  return (
                    <li key={key}>
                      <button className={`${current ? "current" : ""} ${status}`} onClick={() => selectCell(entry.cells[0], clueDirection)}>
                        <span>{entry.number}</span>
                        <span>{entry.clue} <small>({entry.enumeration})</small></span>
                        <span className="clue-status" aria-label={status === "needs-work" ? "Needs another look" : status === "verified" ? "Correct" : undefined}>
                          {status === "needs-work" ? "!" : status === "verified" ? <Icon name="check" /> : ""}
                        </span>
                      </button>
                    </li>
                  );
                })}
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
          <BrandMark large />
          <h2>Take your time.</h2>
          <p>The puzzle will be right here.</p>
          <button className="primary-button" onClick={() => setPaused(false)}>Keep solving</button>
        </div>
      )}

      {welcomeOpen && (
        <div className="scrim welcome-scrim">
          <div className="welcome-card" role="dialog" aria-modal="true" aria-label="Welcome to Srilatha’s X Word">
            <BrandMark large />
            <p className="eyebrow">Srilatha’s X Word · No. {puzzle.number}</p>
            <h2>{puzzle.title}</h2>
            <p className="welcome-copy">Ten clues with a story behind every answer. Fill the grid, submit it all at once, and keep trying anything marked for another look.</p>
            <div className="welcome-rules">
              <span><strong>10</strong> personal clues</span>
              <span><strong>No</strong> answer reveals</span>
              <span><strong>1</strong> perfect score</span>
            </div>
            <button className="primary-button" onClick={startPuzzle}>Start crossword</button>
            {!isStandalone && <button className="text-button" onClick={() => { setWelcomeOpen(false); setInstallOpen(true); }}>Add to iPhone</button>}
          </div>
        </div>
      )}

      {menuOpen && (
        <div className="scrim" onClick={() => setMenuOpen(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label="Puzzle options" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-heading">
              <div><p className="eyebrow">Puzzle options</p><h2>{puzzle.title}</h2></div>
              <button className="icon-button" onClick={() => setMenuOpen(false)} aria-label="Close"><Icon name="close" /></button>
            </div>
            <button className="sheet-action" onClick={() => { setMenuOpen(false); setHelpOpen(true); }}><span>How to play</span><small>Navigation, scoring, and submission</small></button>
            {!isStandalone && <button className="sheet-action" onClick={() => { setMenuOpen(false); setInstallOpen(true); }}><span>Add to iPhone</span><small>Enjoy the full-screen Home Screen edition</small></button>}
            <button className="sheet-action" onClick={() => { setMenuOpen(false); setArchiveOpen(true); }}><span>Puzzle archive</span><small>{puzzles.length} puzzle{puzzles.length === 1 ? "" : "s"} available</small></button>
            <button className="sheet-action danger" onClick={() => { setMenuOpen(false); setResetOpen(true); }}><span>Start over</span><small>Clear every answer and reset the timer</small></button>
          </div>
        </div>
      )}

      {helpOpen && (
        <div className="scrim" onClick={() => setHelpOpen(false)}>
          <div className="sheet help-sheet" role="dialog" aria-modal="true" aria-label="How to play" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-heading">
              <div><p className="eyebrow">A quick guide</p><h2>How to play</h2></div>
              <button className="icon-button" onClick={() => setHelpOpen(false)} aria-label="Close"><Icon name="close" /></button>
            </div>
            <div className="guide-step"><span>1</span><div><strong>Choose a clue</strong><p>Tap any square or clue. Tap a crossing square again to switch between Across and Down.</p></div></div>
            <div className="guide-step"><span>2</span><div><strong>Fill the whole grid</strong><p>Your progress and timer save automatically, even if you close the app.</p></div></div>
            <div className="guide-step"><span>3</span><div><strong>Submit together</strong><p>Once every square is filled, submit the puzzle for a word-level score.</p></div></div>
            <div className="guide-step"><span>4</span><div><strong>Keep trying</strong><p>Incorrect clues are marked, but their answers are never shown. Correct them and submit again.</p></div></div>
            <button className="primary-button" onClick={() => setHelpOpen(false)}>Got it</button>
          </div>
        </div>
      )}

      {installOpen && (
        <div className="scrim" onClick={() => setInstallOpen(false)}>
          <div className="sheet install-sheet" role="dialog" aria-modal="true" aria-label="Add Srilatha’s X Word to iPhone" onClick={(event) => event.stopPropagation()}>
            <BrandMark large />
            <button className="sheet-close icon-button" onClick={() => setInstallOpen(false)} aria-label="Close"><Icon name="close" /></button>
            <p className="eyebrow">The full-screen edition</p>
            <h2>Keep Srilatha’s X Word close</h2>
            <div className="install-step"><span>1</span><p>Open this link in <strong>Safari</strong>.</p></div>
            <div className="install-step"><span>2</span><p>Tap the <strong>Share</strong> icon at the bottom of Safari.</p></div>
            <div className="install-step"><span>3</span><p>Scroll down and choose <strong>Add to Home Screen</strong>.</p></div>
            <div className="install-step"><span>4</span><p>Tap <strong>Add</strong>. The X Word icon will appear with your other apps.</p></div>
            <p className="install-footnote">New crosswords arrive automatically whenever the app opens—no updates or redownloads required.</p>
          </div>
        </div>
      )}

      {archiveOpen && (
        <div className="scrim" onClick={() => setArchiveOpen(false)}>
          <div className="sheet archive-sheet" role="dialog" aria-modal="true" aria-label="Puzzle archive" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-heading">
              <div><p className="eyebrow">Made for Srilatha</p><h2>Puzzle archive</h2></div>
              <button className="icon-button" onClick={() => setArchiveOpen(false)} aria-label="Close"><Icon name="close" /></button>
            </div>
            <div className="archive-list">
              {puzzles.map((item, index) => (
                <button key={item.id} onClick={() => { setPuzzleIndex(index); setArchiveOpen(false); }}>
                  <span className="archive-date">No. {item.number}</span>
                  <span><strong>{item.title}</strong><small>{item.author}</small></span>
                  <span className={index === puzzleIndex ? "archive-status current" : "archive-status"}>{index === puzzleIndex ? "Open" : "Play"}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {resetOpen && (
        <div className="scrim" onClick={() => setResetOpen(false)}>
          <div className="confirm-card" role="alertdialog" aria-modal="true" aria-label="Start puzzle over" onClick={(event) => event.stopPropagation()}>
            <p className="eyebrow">Start over?</p>
            <h2>Clear the whole grid?</h2>
            <p>This removes every letter and resets your timer. It cannot be undone.</p>
            <div><button className="secondary-button" onClick={() => setResetOpen(false)}>Keep progress</button><button className="danger-button" onClick={resetPuzzle}>Clear puzzle</button></div>
          </div>
        </div>
      )}

      {submission && (
        <div className="scrim score-scrim">
          <div className="score-card" role="dialog" aria-modal="true" aria-label="Puzzle score">
            <div className="score-ring" style={{ "--score": `${submission.percentage * 3.6}deg` } as CSSProperties}>
              <span>{submission.percentage}%</span>
            </div>
            <p className="eyebrow">Submission {submissionCount}</p>
            <h2>{submission.correct} of {submission.total} answers are right.</h2>
            <p>{submission.total - submission.correct} clue{submission.total - submission.correct === 1 ? " is" : "s are"} marked for another look. Nothing has been revealed.</p>
            <button className="primary-button" onClick={() => setSubmission(null)}>Continue solving</button>
          </div>
        </div>
      )}

      {completionOpen && (
        <div className="scrim celebration">
          <div className="complete-card" role="dialog" aria-modal="true" aria-label="Puzzle complete">
            <div className="confetti"><span>✦</span><span>♥</span><span>✦</span></div>
            <p className="eyebrow">Perfect score · 10/10</p>
            <h2>Handle with care: completed.</h2>
            <p className="completion-message">“{puzzle.completionMessage}”</p>
            <div className="result-row"><span>Time<strong>{formatTime(elapsed)}</strong></span><span>Submissions<strong>{submissionCount}</strong></span></div>
            <button className="primary-button" onClick={shareScore}><Icon name="share" /> Share score</button>
            <button className="text-button" onClick={() => setCompletionOpen(false)}>Back to puzzle</button>
          </div>
        </div>
      )}
    </main>
  );
}
