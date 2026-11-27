// Phase 4F isolated transport boundary. Not mounted in the production terminal.
// The host must provide an authenticated POST function and a current-scope fence.
// No provider key, customer credential or external provider endpoint belongs here.
const routes=Object.freeze({
  capabilities:[],preflight:['selection','profile'],
  create:['conversationId','selection','profile','workspace'],
  list:[],history:['conversationId','afterSequence','limit'],
  append:['conversationId','messageId','text'],cancel:['conversationId','messageId'],
  analyze:['conversationId','messageId'],generate:['conversationId','messageId'],delete:['conversationId']
});
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const account=v=>typeof v==='string'&&/^[0-9a-f]{24}$/.test(v);
const fail=code=>Object.assign(new Error('Isolated AI request unavailable'),{code});
const plain=v=>v!==null&&typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype;
export function createIsolatedChatClient({isolated=false,accountId,connectionId,post,isCurrent}={}){
  if(isolated!==true||!account(accountId)||!uuid(connectionId)||typeof post!=='function'||typeof isCurrent!=='function')throw fail('AI_CLIENT_DISABLED');
  const authority=Object.freeze({accountId,connectionId});
  async function request(operation,payload={},signal){
    const current=()=>{if(signal?.aborted||isCurrent(authority)!==true)throw fail('AI_SCOPE_CHANGED');};
    current();
    if(!Object.hasOwn(routes,operation)||!plain(payload)||Object.keys(payload).some(k=>!routes[operation].includes(k)))throw fail('AI_INVALID_REQUEST');
    for(const k of ['conversationId','messageId'])if(routes[operation].includes(k)&&!uuid(payload[k]))throw fail('AI_INVALID_REQUEST');
    if(operation==='append'&&(typeof payload.text!=='string'||!payload.text.trim()||new TextEncoder().encode(payload.text).length>4096))throw fail('AI_INVALID_REQUEST');
    // Snapshot inputs before the asynchronous boundary. Never retry a failed POST.
    const body=structuredClone({...payload,...authority});
    const route='/v1/ai/chat/'+(['capabilities','preflight'].includes(operation)?operation:'conversations/'+operation);
    let result;
    try{result=await post(route,body,{signal});}catch{current();throw fail('AI_REQUEST_FAILED');}
    current();
    if(!plain(result)||result.contractVersion!=='native-chat-v1'||result.runtimeEnabled!==false||
      (Object.hasOwn(result,'dispatchAllowed')&&result.dispatchAllowed!==false)||
      (Object.hasOwn(result,'creditDeducted')&&result.creditDeducted!==false))throw fail('AI_INVALID_RESPONSE');
    if(body.conversationId&&operation!=='history'&&result.conversationId!==body.conversationId)throw fail('AI_INVALID_RESPONSE');
    if(operation==='history'&&result.conversation?.conversationId!==body.conversationId)throw fail('AI_INVALID_RESPONSE');
    if(body.messageId&&result.messageId!==body.messageId)throw fail('AI_INVALID_RESPONSE');
    if(['append','cancel','analyze','preflight','generate'].includes(operation)&&(result.dispatchAllowed!==false||result.creditDeducted!==false))throw fail('AI_INVALID_RESPONSE');
    if(operation==='generate'&&(result.fixtureProviderOnly!==true||typeof result.replayed!=='boolean'||!result.providerRun))throw fail('AI_INVALID_RESPONSE');
    // Transport validation is not a display/evidence verifier. Use the existing
    // workspace report projection and operation-specific UI validation before render.
    return result;
  }
  return Object.freeze({request});
}
