# ACG Trader onboarding V1 — APPROVED product contract (2026-10-16)

Status: **Approved for implementation planning. Not implemented end to end.**
Source: the owner's acceptance of the three-path plan following the
TradeLocker/Match-Trader reference discussion.

## Non-negotiable product separation

ACG Trader **standalone** and broker/prop **tenant** experiences use the
same V4 terminal technology but have **independent authentication,
account ownership, permissions, sessions and account data**.

- Standalone ACG Trader identity: Supabase email/password or Google; its
  practice accounts belong to ACG Trader, **not** to ACG Funded or any
  partner tenant.
- Existing Connect Prop: tenant ID + username/user ID + password; preserve
  the existing tenant-native authentication and authorization path. **Do
  not require a Supabase account** to connect to a prop firm.
- Preserve ACG Funded's pre-existing ticket-federation integration unchanged.
  Connecting through a tenant may not silently link, merge or upgrade
  the personal Supabase identity—even when email addresses match.
- Organization membership never implicitly grants trading-account access.
- Any internal storage isolation/first-party namespace for standalone
  accounts must not expose a partner tenant ID or partner auth mode to the
  standalone user, or cause partner-grant discovery in personal onboarding.

## V6 landing entry points

**Keep approved V6 visual language and content**; change only necessary
entry actions/copy, reviewed against the V6 reference:

1. **Start Trading** → the **existing Connect Prop** screen, containing
   tenant ID, username and password (or ACG Funded's federation entry).
   After successful tenant auth → that tenant's authorized V4 workspace.
2. **Try Demo** → **Supabase** email/Google registration/sign-in.
   After email confirmation when required → retry-safe provision of the
   **ACG Trader-owned $100,000 USD virtual demo**, then enter V4 with
   that account selected. Subsequent logins return to the same demo.
3. **For Businesses** → separate B2B organization inquiry/onboarding,
   tenant configuration and technical integration. Never mix with the
   personal demo signup.

Don't label these entry buttons as the generic Sign in / Get started
flow in the final product. Public marketing claims should distinguish
available simulated markets from chart-only and future products.

## Terminal account management

- The account switcher may provide **ACG Trader Demo** and
  **Connect Prop** entry points, but connection changes authentication
  context; it does not join tenant and personal positions, balances,
  history, permissions, or identities in one trading session.
- Reuse current tenant account selection and Connect Prop logic.
- Additional personal demo accounts are a later, separately approved
  capability; do not create unlimited accounts by clicking repeatedly.
- Switching back to ACG Trader Demo requires an authorized personal
  session, not reuse of a tenant credential or account-grant token.

## Standalone demo provisioning: required backend behavior

- The provisioner owns all authoritative account, balance and ledger
  operations. **Never** hardcode `100000` into the terminal as balance.
- Use an idempotent unique creation key tied to the ACG Trader user
  and the default-demo product. Concurrent signup/callback retries
  resolve to the **same** account; do not double-credit opening equity.
- Failure leaves a recoverable `SETUP_PENDING` / `SETUP_FAILED`
  state, not a broken identity or a ghost account. Retry via a safe
  provisioner reconciliation path.
- Currency USD; opening practice balance $100,000 virtual.
  No real-capital execution, challenge fees, or partner restrictions.
- Trade only instruments supported by the platform's current
  simulated execution contracts and applicable risk policy.

## Security and acceptance

- Explicit trust boundaries, no cross-firm account leakage, no
  email-driven automatic linking, no personal→tenant permission escalation.
- Signed Supabase identity can authorize **only** ACG Trader personal
  account permissions in the standalone journey.
- Tenant credentials authorize **only** the selected tenant context.
- Verify signup, confirmation, Google PKCE, session restoration,
  demo exactly-once provisioning and ledger consistency, replay/retry
  after failure, logout, revoked tenant access, multi-tab sessions,
  mobile/desktop entry points, and ACG Funded compatibility.
- No production deployment or public signup until isolated staging
  proves both journeys and the owner separately approves release.

## Impact on existing draft PRs

- Backend #81: retain separate global identity foundation where it
  serves ACG Trader; do not automatically map it to partner accounts.
- Backend #82: the Supabase→arbitrary-tenant organization discovery,
  tenant-scoped trader-session exchange and partner grant linking are
  **not the approved standalone demo entry journey**. Keep any useful
  security improvements but redesign or separate the coupling before
  merge. Existing tenant credentials/federation remain authoritative.
- Landing #124: approved V6 visuals remain source of truth.
- Frontend #125: currently routes generic Sign in/Get started to Supabase
  then selects partner tenants; **this does not satisfy the approved
  Start Trading / Try Demo split**. Update routes, copy, account flows
  and tests before treating #125 as release-ready.
- Automatic personal $100K demo provisioning is still missing and is
  a launch blocker for the Try Demo promise.

### Change control

This document freezes the **approved product behavior**, not a
declaration that the implementation or staging acceptance is complete.
Technical implementation changes to PRs remain draft/reviewable and
must not alter production without separate rollout authorization.
