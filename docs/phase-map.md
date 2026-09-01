# Phase map and balance rule

Updated August 25, 2026 (v2.0-balanced-phases).

Every phase draws on all five scorecard categories so students are prompted toward
breadth, above all in Phase 1. Perfect balance is impossible because the categories
differ in size (Democratic Engagement alone has 34 of the 109 actions), so the rule is
a floor per category per phase, remaining slots by difficulty.

| Phase | Actions | Single-pass points | Cumulative | DE | ES | CW | AC | SI | IA |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 Start | 24 | 150 | 150 | 6 | 5 | 4 | 4 | 4 | 1 |
| 2 Bronze | 36 | 270 | 420 | 13 | 10 | 8 | 4 | 1 | 0 |
| 3 Silver | 35 | 430 | 850 | 12 | 8 | 10 | 3 | 2 | 0 |
| 4 Gold | 14 | 230 | 1080 | 3 | 3 | 4 | 2 | 2 | 0 |

Floors (IA excluded): Phase 1 at least 4 per category, Phases 2 and 3 at least 3,
Phase 4 at least 2. Social Innovation has only nine actions, so two listed exceptions
bend the floor: 1 in Phase 2 and 2 in Phase 3. The build (scripts/build.mjs, via
src/floors.mjs) fails on any map that breaks a floor without its exact exception, on
phase counts other than 24/36/35/14, or if a phase's cumulative single-pass points
cannot reach the next award threshold.

The phase pages and home cards show a five-dot coverage strip per phase, a soft
"try one from" suggestion (priority ES, CW, AC, SI, DE from planner-config.json's
suggestPriority), and a breadth chip in the hero. None of it gates anything;
unlock recommendations stay points-based at 100/200/300.
