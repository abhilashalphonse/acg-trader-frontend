import {test} from 'node:test';
import assert from 'node:assert/strict';
import {workspaceFailureNotice} from '../src/components/ai/workspacePresentation.js';
const expected={operationId:'fixture',symbol:'BTCUSD',timeframe:'5m'};
const result={contractVersion:'restricted-pilot-v1',mode:'WORKSPACE_CHAT',executionAllowed:false,operationId:expected.operationId,workspace:{symbol:expected.symbol,timeframe:expected.timeframe},state:'FAILED'};
test('typed daily budget denials distinguish count from spend without automatic retry',()=>{
 assert.match(workspaceFailureNotice({...result,failureReason:'DAILY_REQUEST_LIMIT'},expected),/request allowance reached.*00:00 UTC/);
 assert.match(workspaceFailureNotice({...result,failureReason:'DAILY_SPEND_LIMIT'},expected),/spending allowance cannot cover.*00:00 UTC/);
 assert.match(workspaceFailureNotice({...result,operationId:'foreign',failureReason:'DAILY_SPEND_LIMIT'},expected),/could not be verified/);
});
