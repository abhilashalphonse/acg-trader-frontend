const APPROVED_FUNDED_HOSTS = new Set(['acgfunded.com', 'www.acgfunded.com']);

// Do not allow build-time environment variables to turn login-screen links into
// an open redirect to a lookalike credential-collection domain.
export function approvedFundedUrl(candidate = 'https://acgfunded.com') {
  try {
    const url = new URL(String(candidate || ''));
    if (url.protocol !== 'https:' || !APPROVED_FUNDED_HOSTS.has(url.hostname.toLowerCase()) ||
        url.username || url.password || (url.port && url.port !== '443')) return null;
    return url.toString();
  } catch { return null; }
}
