import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const feed = JSON.parse(await readFile(new URL("../public/puzzles/index.json", import.meta.url), "utf8"));
assert.ok(Array.isArray(feed.puzzles) && feed.puzzles.length > 0, "Puzzle feed must contain at least one puzzle");

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

  assert.equal(entries.length, 10, `${puzzle.id}: expected exactly ten answer entries`);
  for (const entry of entries) {
    const key = String(entry.number);
    assert.ok(puzzle.clues[entry.direction]?.[key], `${puzzle.id}: missing ${entry.number} ${entry.direction} clue`);
    assert.ok(puzzle.enumerations[entry.direction]?.[key], `${puzzle.id}: missing ${entry.number} ${entry.direction} enumeration`);
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
