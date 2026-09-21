// Unit tests for the per-phase category floor check. Run with: node --test tests/floors.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkFloors } from "../src/floors.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(fs.readFileSync(path.join(root, "data", "civic-action-scorecard-2026-2027.json"), "utf8"));
const config = JSON.parse(fs.readFileSync(path.join(root, "data", "planner-config.json"), "utf8"));

test("the shipped map passes the floors with the listed exceptions", () => {
  assert.equal(checkFloors(data.actions, config.phaseFloors, config.floorExceptions), null);
});

test("a floor break without an exception fails", () => {
  const moved = data.actions.map((a) => (a.code === "AC-1" ? { ...a, phase: 2 } : a));
  const err = checkFloors(moved, config.phaseFloors, config.floorExceptions);
  assert.match(err, /Phase 1 AC has 3 actions, below the floor of 4/);
});

test("an exception must match the actual count exactly", () => {
  const err = checkFloors(data.actions, config.phaseFloors, [{ phase: 3, cat: "SI", count: 1 }]);
  assert.match(err, /Phase 3 SI has 2 actions but the listed exception says 1/);
});

test("a matching exception lets a below-floor count pass", () => {
  assert.equal(checkFloors(data.actions, config.phaseFloors, [{ phase: 3, cat: "SI", count: 2 }]), null);
});
