// Unit tests for the sign-in merge rule. Run with: node --test tests/merge.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { mergeStates } from "../src/merge.mjs";

const state = (updated, counts) => ({ v: 2, name: "", counts: counts || {}, ia: 10, sub: {}, appr: {}, notes: {}, updated });

test("empty cloud with local progress uploads local", () => {
  assert.deepEqual(mergeStates(state(5, { "DE-3": 1 }), null), { action: "uploadLocal" });
});

test("cloud newer by updated replaces local, with a backup first", () => {
  assert.deepEqual(mergeStates(state(5, { "DE-3": 1 }), state(9, { "ES-8": 1 })), { action: "useCloud", backupLocal: true });
});

test("local newer by updated uploads local", () => {
  assert.deepEqual(mergeStates(state(9, { "DE-3": 1 }), state(5, { "ES-8": 1 })), { action: "uploadLocal" });
});

test("both empty does nothing", () => {
  assert.deepEqual(mergeStates(state(0), null), { action: "none" });
});
