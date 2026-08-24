import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const feed = JSON.parse(await readFile(new URL("../public/puzzles/index.json", import.meta.url), "utf8"));
assert.ok(Array.isArray(feed.puzzles) && feed.puzzles.length > 0, "Puzzle feed must contain at least one puzzle");

const urgentCareEntries = new Map([
  ["KEVALBHATT", { enumeration: "5, 5", clue: "Dad’s unexpected contribution to the priesthood" }],
  ["SIMPLYCOOKING", { enumeration: "6, 7", clue: "The culinary channel from a parallel universe" }],
  ["WORLDWARSNACKBOX", { enumeration: "5, 3, 5, 3", clue: "Apparently, soldiers ate from these between battles" }],
  ["CAMBRIDGEAVENUE", { enumeration: "9, 6", clue: "Our own little bit of university town, nowhere near the university" }],
  ["MISTBORN", { enumeration: "8", clue: "A shared journey beneath a red sun" }],
  ["FACULTY", { enumeration: "7", clue: "A place where intelligence is both the product and the prerequisite" }],
  ["PIZZA", { enumeration: "5", clue: "Three weeks proved there really can be too much of a good thing" }],
  ["SUPERFICIAL", { enumeration: "11", clue: "Ironically, her imitation of this word lacks depth" }],
  ["PREGNANT", { enumeration: "8", clue: "Apparently a possible explanation for any bodily sensation whatsoever" }],
  ["PLATO", { enumeration: "5", clue: "He turned ‘because the gods said so’ into a 2,400-year argument" }],
]);

for (const puzzle of feed.puzzles) {
  const rows = puzzle.grid.length;
  const cols = puzzle.grid[0]?.length ?? 0;
  assert.ok(rows > 0 && cols > 0, `${puzzle.id}: grid cannot be empty`);
  assert.ok(puzzle.grid.every((row) => row.length === cols), `${puzzle.id}: every row must have the same length`);
  assert.ok(puzzle.grid.every((row) => /^[A-Z#]+$/.test(row)), `${puzzle.id}: grid may contain only A–Z and #`);

  const solution = puzzle.grid.join("");
  const entries = [];
  let number = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const index = row * cols + col;
      if (solution[index] === "#") continue;
      const startsAcross = (col === 0 || solution[index - 1] === "#") && col + 1 < cols && solution[index + 1] !== "#";
      const startsDown = (row === 0 || solution[index - cols] === "#") && row + 1 < rows && solution[index + cols] !== "#";
      if (startsAcross || startsDown) number += 1;
      if (startsAcross) {
        let answer = "";
        for (let cursor = index; cursor < (row + 1) * cols && solution[cursor] !== "#"; cursor += 1) answer += solution[cursor];
        entries.push({ number, direction: "across", answer });
      }
      if (startsDown) {
        let answer = "";
        for (let cursor = index; cursor < solution.length && solution[cursor] !== "#"; cursor += cols) answer += solution[cursor];
        entries.push({ number, direction: "down", answer });
      }
    }
  }

  const expectedEntries = puzzle.id === "handle-with-urgent-care-001" ? urgentCareEntries : null;
  assert.equal(entries.length, expectedEntries?.size ?? 10, `${puzzle.id}: expected exactly ten answer entries`);
  for (const entry of entries) {
    const key = String(entry.number);
    assert.ok(puzzle.clues[entry.direction]?.[key], `${puzzle.id}: missing ${entry.number} ${entry.direction} clue`);
    assert.ok(puzzle.enumerations[entry.direction]?.[key], `${puzzle.id}: missing ${entry.number} ${entry.direction} enumeration`);
    if (expectedEntries) {
      const expected = expectedEntries.get(entry.answer);
      assert.ok(expected, `${puzzle.id}: unexpected or misspelled answer ${entry.answer}`);
      assert.equal(puzzle.clues[entry.direction][key], expected.clue, `${puzzle.id}: clue does not match ${entry.answer}`);
      assert.equal(puzzle.enumerations[entry.direction][key], expected.enumeration, `${puzzle.id}: enumeration does not match ${entry.answer}`);
    }
    const enumeratedLength = puzzle.enumerations[entry.direction][key]
      .split(",")
      .reduce((total, part) => total + Number(part.trim()), 0);
    assert.equal(enumeratedLength, entry.answer.length, `${puzzle.id}: ${entry.number} ${entry.direction} enumeration is wrong`);
  }

  const openCells = [...solution].map((letter, index) => letter === "#" ? null : index).filter((index) => index !== null);
  const visited = new Set([openCells[0]]);
  const queue = [openCells[0]];
  while (queue.length) {
    const current = queue.shift();
    const row = Math.floor(current / cols);
    const col = current % cols;
    for (const next of [current - 1, current + 1, current - cols, current + cols]) {
      if (next < 0 || next >= solution.length || solution[next] === "#" || visited.has(next)) continue;
      const nextRow = Math.floor(next / cols);
      const nextCol = next % cols;
      if (Math.abs(nextRow - row) + Math.abs(nextCol - col) !== 1) continue;
      visited.add(next);
      queue.push(next);
    }
  }
  assert.equal(visited.size, openCells.length, `${puzzle.id}: all answers must form one connected crossword`);
}

console.log(`Validated ${feed.puzzles.length} puzzle with 10 connected answers.`);
