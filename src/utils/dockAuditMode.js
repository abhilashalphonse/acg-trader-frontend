// Explicit, tab-local desktop UX audit. This flag grants no auth or
// execution permissions, and never persists in the user's normal layout.
export function isDockAuditEnabled(search=''){
  return new URLSearchParams(search).get('acg_dock_audit')==='1';
}

// Approved compact V4 dock/popup can be compiled on for production without a
// URL flag. Explicit ?acg_dock_audit=0 is a per-tab presentation rollback.
// This gate does not grant trading, account or order permissions.
export function isDockLiveEnabled(search='', liveBuild=false){
  const override=new URLSearchParams(search).get('acg_dock_audit');
  if(override==='0')return false;
  if(override==='1')return true;
  return liveBuild===true;
}
