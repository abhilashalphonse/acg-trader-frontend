// Synthetic UI fixture only. Not actual market evidence or an API response.
export function sampleWorkspaceReport(workspace,now=Date.now()){
  const conversationId='11111111-1111-4111-8111-111111111111',messageId='22222222-2222-4222-8222-222222222222';
  const expected={...workspace,conversationId,messageId};
  const envelope={contractVersion:'native-chat-v1',runtimeEnabled:false,mode:'DETERMINISTIC_HISTORICAL_REPORT',semanticAnswer:false,
    offlineOnly:true,dispatchAllowed:false,creditDeducted:false,conversationId,messageId,workspace,source:{provider:'twelve-data',scheduleVersion:1},
    response:{schemaVersion:'verified-response-v1',verification:'RECOMPUTED_REFERENCE_SELECTION_ONLY',status:'ANSWER',
      symbol:workspace.symbol,quoteStatus:'UNAVAILABLE',asOfMs:now,verifiedAtMs:now,expiresAtMs:now+10000,
      responseId:'a'.repeat(64),contextId:'b'.repeat(64),packageId:'c'.repeat(64),
      observations:[{type:'FACT',timeframe:workspace.timeframe,referenceId:'d'.repeat(64),sourceId:'e'.repeat(64),
        data:{kind:'LAST_CLOSED_PRICE',value:'119',unit:'price',throughCloseTimeMs:now-60000}},
        {type:'FACT',timeframe:workspace.timeframe,referenceId:'f'.repeat(64),sourceId:'1'.repeat(64),
          data:{kind:'OBSERVED_RANGE_HIGH',value:'120',unit:'price',throughCloseTimeMs:now-60000}}],
      interpretations:[],education:[],frames:[{timeframe:workspace.timeframe,coverage:{status:'MATCHES_CONFIGURED_CALENDAR'}}],
      limitations:['NO_SEMANTIC_RELEVANCE_OR_COMPLETENESS_PROOF']}};
  return {envelope,expected};
}
