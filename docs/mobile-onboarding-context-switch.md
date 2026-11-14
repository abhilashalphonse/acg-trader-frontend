# Mobile onboarding and account-context switching — implementation / review gate

Status: **frontend candidate on a feature branch; release not authorized**.
Source: `docs/onboarding-v1-approved-contract.md`. The V4 mobile chart/dock,
desktop V4, backend ledger, and ACG Funded federation are unchanged.

## Entry routes

| Journey | URL | Identity |
| --- | --- | --- |
| Opt-in mobile welcome | `/?acg_mobile_onboarding=1` | No signup on this screen; attempts to restore an existing trader cookie |
| Start Trading | `/?acg_connect_prop=1` | Native tenant ID / username / password |
| Try Demo | `/?acg_auth=signin&acg_onboarding_audit=1` (first-use welcome links through signup) | Independent Supabase provider identity; backend-owned personal demo |
| Continue session | `/terminal` | Current opaque trader session |
| For businesses | `/acg-landing-v6.html#business` | Separate informational path |

The welcome is an explicit first-launch/preview route: it does not replace the
normal root, existing ACG Funded login, federation ticket route, or desktop UI.
It never redeems federation tickets. The onboarding auth path uses the already
implemented email/password, email confirmation, Google OAuth PKCE, recovery,
retry-safe `POST /v1/auth/personal/demo`, and disabled-by-default flags.

## Mobile Accounts V4 behavior

1. **Within one authorized session:** use the existing account selector. The
   trading hook owns synchronization of account, open positions, pending orders,
   history, valuations and execution lockout.
2. **To switch trading context:** choose ACG Trader Demo or Connect Prop / Broker.
   The selection does NOT switch account IDs, create grants, exchange tenant
   tokens or merge accounts; it opens a separate authentication journey.
3. Show an explicit confirmation explaining that open server-side positions and
   pending orders remain with their original account, while local drafts are
   discarded.
4. Prevent switching while an account switch, order submission or uncertain
   execution is in progress. Never leave an unknown order without reconciliation.
5. On confirmation, call the existing `POST /v1/auth/logout` and only navigate
   after successful server revocation. Failed revocation displays an error while
   keeping the original trading context. Personal Supabase identity credentials,
   if already separately authorized, remain in their own session storage and
   can only restore the *personal* demo via the dedicated backend endpoint.
6. **Full sign out** is different: revoke the trading session **and** clear any
   cached personal Supabase sign-in, including when the user last selected a
   partner context. This avoids accidentally restoring a previous personal
   identity after a full sign-out.
7. Both the default V4 and legacy mobile account surfaces provide context
   changes, without adding bottom navigation or changing chart space.

**Important:** A Supabase-origin trader session is not necessarily first-party;
legacy opt-in partner integration may also use this auth method. The UI must not
infer account ownership from `authMethod === 'SUPABASE'` or from account codes.
Both destination choices remain explicit. The partner and personal server
sessions never coexist in the terminal at the same time.

## Flags and release boundaries

Do not enable `VITE_ACG_SUPABASE_AUTH_ENABLED`,
`SUPABASE_IDENTITY_BOOTSTRAP_ENABLED`,
`SUPABASE_TRADING_SESSIONS_ENABLED` or `ACG_PERSONAL_DEMO_ENABLED` in
production as part of this work. When disabled, Try Demo stays a clearly labelled
registration **preview**, not a live $100K account. Backend configuration and
staging authorization gates in `docs/personal-demo-implementation.md` still apply.

## Acceptance matrix (staging / browser)

- 320, 360, 393, 430px portrait and landscape: welcome, signin, account sheet,
  context confirmation, safe-area insets, keyboard dismissal, and no overflow
- Federation ticket still redeems via the original login; partner tenant/credential
  login still works from Start Trading
- Email signup and confirmation, Google PKCE, password recovery, returning demo
  session, and setup failure/retry (when staging flags permit)
- Within-session account switch holds execution while balances, positions,
  orders, valuations and risk state sync to the newly selected account
- Switch Personal → Partner and Partner → Personal: previous trader cookie
  revoked; data never leaks; new context requires its own auth
- Network failure during session revocation: no navigation or silent context
  change; error and retry available
- Active or uncertain order submission: context buttons disabled until resolved
- Full signout clears provider identity even if the last trading session was
  a partner login; another tab cannot regain the revoked trader session
- No public auth enabled until backend/staging acceptance is complete and owner
  separately authorizes rollout

## What this PR does not assert

It does **not** attest to successful end-to-end provider staging tests, native
Capacitor packaging, App Store / Play Store release, production deployment,
or a working publicly enabled personal demo. Those require separate evidence.
