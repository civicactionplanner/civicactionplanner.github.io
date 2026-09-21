# Phase map and balance rule

Updated September 20, 2026 (v3.0-scorecard-2026-27).

Every phase draws on all five scorecard categories so students are prompted toward
breadth, above all in Phase 1. Perfect balance is impossible because the categories
differ in size (Democratic Engagement alone has 40 of the 124 actions), so the rule is
a floor per category per phase, remaining slots by difficulty. Actions carried over
from the 2024-25 map kept their phase; the sixteen 2026-27 additions were placed by
difficulty (four easy online actions in Phase 1, the Unify Deep Dive in Phase 3, the
rest in Phase 2).

| Phase | Actions | DE | ES | CW | AC | SI |
| --- | --- | --- | --- | --- | --- | --- |
| 1 Start | 27 | 7 | 6 | 5 | 4 | 5 |
| 2 Bronze | 47 | 18 | 11 | 10 | 5 | 3 |
| 3 Silver | 36 | 12 | 8 | 11 | 3 | 2 |
| 4 Gold | 14 | 3 | 3 | 4 | 2 | 2 |

Floors: Phase 1 at least 4 per category, Phases 2 and 3 at least 3, Phase 4 at least
2. Social Innovation has twelve actions, so one listed exception bends the floor: 2 in
Phase 3. The build (scripts/build.mjs, via src/floors.mjs) fails on any map that
breaks a floor without its exact exception, on phase counts other than 27/47/36/14,
or if a phase's cumulative single-pass points cannot reach the next award threshold.

The phase pages and home cards show a five-dot coverage strip per phase, a soft
"try one from" suggestion (priority ES, CW, AC, SI, DE from planner-config.json's
suggestPriority), and a breadth chip in the hero. None of it gates anything;
unlock recommendations stay points-based at 100/200/300.
