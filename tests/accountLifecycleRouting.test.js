import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveCommandAccountId,
  resolveLifecycleReplacement,
} from '../src/hooks/useTradingTerminal.js';
import { exposureAvailability } from '../src/utils/exposureAvailability.js';

function grant(id, fundedAccountId, {
  accountType = 'CHALLENGE',
  phase = 1,
  status = 'ACTIVE',
  tradingEnabled = true,
} = {}) {
  return { id, fundedAccountId, accountType, phase, status, tradingEnabled };
}

function commandAccount(activeAccountId, grants, switching = false) {
  return resolveCommandAccountId({
    activeAccountId,
    grantedAccountIds: grants.map(item => item.id),
    accountSwitching: switching,
  });
}

test('multi-tab lifecycle stress keeps every command pinned to each tab activeAccountId', () => {
  const trial = grant('trial-p1', 'trial-1', { accountType: 'DEMO' });
  const challengeOneP1 = grant('challenge-1-p1', 'challenge-1');
  const challengeTwoP1 = grant('challenge-2-p1', 'challenge-2');
  let grants = [trial, challengeOneP1, challengeTwoP1];

  const tabs = {
    trial: 'trial-p1',
    challengeOne: 'challenge-1-p1',
    challengeTwo: 'challenge-2-p1',
  };

  for (let cycle = 0; cycle < 250; cycle += 1) {
    assert.equal(commandAccount(tabs.trial, grants), 'trial-p1');
    assert.equal(commandAccount(tabs.challengeOne, grants), 'challenge-1-p1');
    assert.equal(commandAccount(tabs.challengeTwo, grants), 'challenge-2-p1');
  }

  const challengeOneP2 = grant('challenge-1-p2', 'challenge-1', { phase: 2 });
  grants = [trial, challengeOneP2, challengeTwoP1];

  assert.throws(
    () => commandAccount(tabs.challengeOne, grants),
    error => error.code === 'ACCOUNT_ACCESS_REVOKED',
  );
  assert.equal(resolveLifecycleReplacement({
    accountGrants: grants,
    activeAccountId: tabs.challengeOne,
    lifecycleId: 'challenge-1',
  })?.id, 'challenge-1-p2');

  tabs.challengeOne = 'challenge-1-p2';
  for (let cycle = 0; cycle < 250; cycle += 1) {
    assert.equal(commandAccount(tabs.challengeOne, grants), 'challenge-1-p2');
    assert.equal(commandAccount(tabs.challengeTwo, grants), 'challenge-2-p1');
    assert.equal(commandAccount(tabs.trial, grants), 'trial-p1');
  }

  grants = [challengeOneP2, challengeTwoP1];
  assert.throws(
    () => commandAccount(tabs.trial, grants),
    error => error.code === 'ACCOUNT_ACCESS_REVOKED',
  );
  assert.equal(resolveLifecycleReplacement({
    accountGrants: grants,
    activeAccountId: tabs.trial,
    lifecycleId: 'trial-1',
  }), null);
});

test('Master Review never auto-hands off to a paused incomplete Master account', () => {
  const pausedMaster = grant('challenge-1-master', 'challenge-1', {
    accountType: 'FUNDED',
    phase: 2,
    status: 'PAUSED',
    tradingEnabled: false,
  });
  const unrelated = grant('challenge-2-p1', 'challenge-2');
  const grants = [pausedMaster, unrelated];

  assert.equal(resolveLifecycleReplacement({
    accountGrants: grants,
    activeAccountId: 'challenge-1-p2',
    lifecycleId: 'challenge-1',
  }), null);

  assert.throws(
    () => resolveCommandAccountId({
      activeAccountId: 'challenge-1-p2',
      grantedAccountIds: grants.map(item => item.id),
    }),
    error => error.code === 'ACCOUNT_ACCESS_REVOKED',
  );

  const exposure = exposureAvailability({
    account: {
      id: pausedMaster.id,
      status: pausedMaster.status,
      tradingEnabled: pausedMaster.tradingEnabled,
      valuationStatus: 'LIVE',
    },
    connectionStatus: 'ready',
    market: {
      symbol: 'EURUSD',
      bid: 1.1,
      ask: 1.1001,
      sessionOpen: true,
      isStale: false,
      marketState: 'LIVE',
    },
    commandState: {},
  });
  assert.equal(exposure.allowed, false);
});

test('active Master handoff stays execution-locked until account switching finishes', () => {
  const master = grant('challenge-1-master', 'challenge-1', {
    accountType: 'FUNDED',
    phase: 2,
    status: 'ACTIVE',
    tradingEnabled: true,
  });
  const grants = [master];

  assert.equal(resolveLifecycleReplacement({
    accountGrants: grants,
    activeAccountId: 'challenge-1-p2',
    lifecycleId: 'challenge-1',
  })?.id, 'challenge-1-master');

  assert.throws(
    () => resolveCommandAccountId({
      activeAccountId: master.id,
      grantedAccountIds: grants.map(item => item.id),
      accountSwitching: true,
    }),
    error => error.code === 'ACCOUNT_SWITCH_IN_PROGRESS',
  );

  assert.equal(commandAccount(master.id, grants, false), 'challenge-1-master');
});

test('lifecycle replacement never crosses funded lifecycle identities', () => {
  const grants = [
    grant('challenge-1-p2', 'challenge-1', { phase: 2 }),
    grant('challenge-2-master', 'challenge-2', { accountType: 'FUNDED', phase: 2 }),
    grant('challenge-3-p2', 'challenge-3', { phase: 2 }),
  ];

  assert.equal(resolveLifecycleReplacement({
    accountGrants: grants,
    activeAccountId: 'challenge-1-p1',
    lifecycleId: 'challenge-1',
  })?.id, 'challenge-1-p2');

  assert.equal(resolveLifecycleReplacement({
    accountGrants: grants,
    activeAccountId: 'challenge-9-p1',
    lifecycleId: 'challenge-9',
  }), null);
});
