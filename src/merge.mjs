// Sign-in merge decision: whole-state, newest wins, never field by field.
// Pure so it can run in the page (inlined at build) and under node:test.
// Returns {action:"uploadLocal"} | {action:"useCloud", backupLocal:true} | {action:"none"}.
export function mergeStates(local, cloud){
  var localHas = !!(local && ((local.counts && Object.keys(local.counts).length) ||
    (local.notes && Object.keys(local.notes).length) || local.name));
  var cloudUpdated = cloud && typeof cloud.updated === "number" ? cloud.updated : 0;
  var localUpdated = local && typeof local.updated === "number" ? local.updated : 0;
  if (!cloud || !cloudUpdated) return localHas ? { action: "uploadLocal" } : { action: "none" };
  if (cloudUpdated > localUpdated) return { action: "useCloud", backupLocal: true };
  if (localUpdated > cloudUpdated) return { action: "uploadLocal" };
  return { action: "none" };
}
