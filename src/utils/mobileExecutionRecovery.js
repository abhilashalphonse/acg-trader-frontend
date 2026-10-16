const KNOWN = new Set(['PENDING','ACCEPTED','TRIGGERED','FILLED','REJECTED','CANCELLED','CANCELED','EXPIRED']);
export const mobileRecoveryKey = accountId => `acg-mobile-v4-recovery:${accountId}`;
export async function findMobileExecutionOutcome({accountId, recovery, findOrders}) {
  if (!accountId || String(recovery?.accountId)!==String(accountId) || !recovery?.clientOrderId) {
    return {confirmed:false,message:'Account refresh requested. Verify the previous order in Trades.'};
  }
  const response=await findOrders(accountId);
  const order=(response?.items || []).find(item=>item.id &&
    String(item.clientOrderId)===String(recovery.clientOrderId) &&
    (item.accountId == null || String(item.accountId)===String(accountId)) &&
    KNOWN.has(String(item.status || '').toUpperCase()));
  return order ? {confirmed:true,order} : {confirmed:false,message:'Previous order is still unconfirmed. New orders remain paused.'};
}
