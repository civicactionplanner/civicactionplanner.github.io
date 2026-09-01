// Per-phase category floor check. Pure; used by scripts/build.mjs and tests/floors.test.mjs.
// Returns null when the map is valid, otherwise a message describing the first violation.
// IA is excluded from floors. An exception must match its actual count exactly.
export function checkFloors(actions, floors, exceptions) {
  const cats = ["DE", "ES", "CW", "AC", "SI"];
  const exFor = (p, cat) => (exceptions || []).find((e) => e.phase === p && e.cat === cat);
  for (const p of [1, 2, 3, 4]) {
    const floor = floors && floors[String(p)];
    if (!Number.isInteger(floor)) return `phaseFloors is missing an entry for phase ${p}`;
    for (const cat of cats) {
      const count = actions.filter((a) => a.phase === p && a.cat === cat).length;
      const ex = exFor(p, cat);
      if (ex) {
        if (count !== ex.count) return `Phase ${p} ${cat} has ${count} actions but the listed exception says ${ex.count}`;
      } else if (count < floor) {
        return `Phase ${p} ${cat} has ${count} actions, below the floor of ${floor} and not a listed exception`;
      }
    }
  }
  return null;
}
