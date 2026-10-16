// V4 is the public mobile default. Preserve an explicit support fallback.
export function isMobileV4Enabled(search = '') {
  return new URLSearchParams(search).get('acg_mobile_audit') !== '0';
}
