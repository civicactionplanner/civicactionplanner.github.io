// Unit tests for the per-phase category floor check. Run with: node --test tests/floors.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkFloors } from "../src/floors.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(fs.readFileSync(path.join(root, "data", "civic-action-scorecard-2024-2025.json"), "utf8"));
const config = JSON.parse(fs.readFileSync(path.join(root, "data", "planner-config.json"), "utf8"));

test("the shipped map passes the floors with the listed exceptions", () => {
  assert.equal(checkFloors(data.actions, config.phaseFloors, config.floorExceptions), null);
});

test("a floor break without an exception fails", () => {
  const moved = data.actions.map((a) => (a.code === "SI-1" ? { ...a, phase: 2 } : a));
  const err = checkFloors(moved, config.phaseFloors, config.floorExceptions);
  assert.match(err, /Phase 1 SI has 3 actions, below the floor of 4/);
});

test("an exception must match the actual count exactly", () => {
  const err = checkFloors(data.actions, config.phaseFloors, [
    { phase: 2, cat: "SI", count: 2 },
    { phase: 3, cat: "SI", count: 2 },
  ]);
  assert.match(err, /Phase 2 SI has 1 actions but the listed exception says 2/);
});

test("a matching exception lets a below-floor count pass", () => {
  const err = checkFloors(data.actions, config.phaseFloors, [
    { phase: 2, cat: "SI", count: 1 },
    { phase: 3, cat: "SI", count: 2 },
  ]);
  assert.equal(err, null);
});
