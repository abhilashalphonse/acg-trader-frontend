// Revisions are comparable only within one backend process epoch.
// Epochs are process start timestamps, allowing late responses from an older
// process to be rejected after a reconnect to a newer process.
export function isOlderCandle(incoming, previous) {
  if (!incoming || !previous) return false;
  const epoch = value => value == null ? null : Number(value);
  const nextEpoch = epoch(incoming.stateEpoch);
  const priorEpoch = epoch(previous.stateEpoch);
  if (Number.isFinite(nextEpoch) && Number.isFinite(priorEpoch) && nextEpoch !== priorEpoch) {
    return nextEpoch < priorEpoch;
  }
  if (Number.isFinite(nextEpoch) && !Number.isFinite(priorEpoch)) return false;
  if (incoming.stateVersion == null || previous.stateVersion == null) return false;
  return Number(incoming.stateVersion) < Number(previous.stateVersion);
}
