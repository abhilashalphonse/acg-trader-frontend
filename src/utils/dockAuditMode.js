// Explicit, tab-local desktop UX audit. This flag grants no auth or
// execution permissions, and never persists in the user's normal layout.
export function isDockAuditEnabled(search=''){
  return new URLSearchParams(search).get('acg_dock_audit')==='1';
}
