const AMBIGUOUS_EXECUTION_CODES = new Set(['REQUEST_TIMEOUT', 'NETWORK_ERROR', 'COMMAND_IN_PROGRESS']);

export function isAmbiguousExecutionError(error) {
  return AMBIGUOUS_EXECUTION_CODES.has(String(error?.code || ''));
}

const defaultSleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function executeWithOrderReconciliation({
  submit,
  findOrder,
  clientOrderId,
  onReconciled = () => {},
  sleep = defaultSleep,
  submitAttempts = 2,
  reconciliationAttempts = 4,
}) {
  let lastError = null;

  for (let attempt = 0; attempt < submitAttempts; attempt += 1) {
    try {
      return await submit();
    } catch (error) {
      if (!isAmbiguousExecutionError(error)) throw error;
      lastError = error;
      if (attempt < submitAttempts - 1) await sleep(150);
    }
  }

  for (let attempt = 0; attempt < reconciliationAttempts; attempt += 1) {
    try {
      const order = await findOrder(clientOrderId);
      if (order) {
        onReconciled(order);
        return { order, reconciled: true, executionStatus: order.status || 'CONFIRMED' };
      }
    } catch (error) {
      if (!isAmbiguousExecutionError(error)) throw error;
      lastError = error;
    }
    if (attempt < reconciliationAttempts - 1) await sleep(250 * (attempt + 1));
  }

  const error = new Error('Execution status is unknown because the backend response could not be confirmed. New exposure stays paused until the terminal is reloaded and authoritative account state is restored.');
  error.code = 'EXECUTION_STATUS_UNKNOWN';
  error.clientOrderId = clientOrderId;
  error.cause = lastError;
  throw error;
}
