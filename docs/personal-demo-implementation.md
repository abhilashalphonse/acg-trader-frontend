# ACG Trader Try Demo — first-party onboarding (implementation)

Status: **Backend + frontend implementation, staged behind disabled flags**.
Approved source: `docs/onboarding-v1-approved-contract.md`.

## User journeys

- **Start Trading** → existing Connect Prop (tenant slug/ID + username + password);
  the original ACG Funded federation path and tenant permissions remain intact.
- **Try Demo** → independent Supabase email/Google sign-in and confirmation →
  `POST /v1/auth/personal/demo` → existing V4 terminal.
- **For Businesses** → separate business inquiry; no personal Supabase signup
  and no automatic tenant creation for a partner.

## Security/ownership

The personal-demo endpoint takes **no tenantId, accountId, amount or leverage
from the browser**. The backend validates the project's signed Supabase JWT,
checks the provider's authoritative email confirmation, bootstraps the global
identity by issuer/subject (never by email), and provisions exactly one
$100,000 USD DEMO for that user through the existing transactional account
provisioner. The unique `externalRef` and account code are deterministic
per user and default-demo product. The same retry returns the same account
and opening ledger; partial grant failures can heal without double-credit.
A revoked grant does **not** reactivate on a login retry.

The TradingAccount/ledger engine requires a tenantId as an **internal storage
namespace**. The reserved `acg-trader-personal` namespace can only be
created by the backend with a first-party marker and `SUPABASE` auth mode;
the browser cannot choose it and no partner uses its credentials. The
Supabase trader session is validated against this first-party marker on
every HTTP request/refresh and via the existing WebSocket grant recheck.
Existing partner native PASSWORD/FEDERATED authentication is unaffected.

Opening $100,000 virtual balance originates in the authoritative
`AccountControlService.provision` transaction, with immutable opening
ledger and lifecycle record, not from a frontend number.

## API contract

`POST /v1/auth/personal/demo`
- Authorization: `Bearer <signed Supabase JWT>`
- JSON: `{}` — extra properties rejected (no tenant/account/amount input).
- Response: existing opaque trading session response, plus
  `personalDemo: {id,accountType:'DEMO',currency:'USD',initialBalance:'100000'}`.
- HttpOnly refresh cookie issued by the existing backend session machinery.
- Replays are safe; the provider identity can return to the same
  personal demo without another credit.

## Feature gates and release

**All default OFF**: `SUPABASE_IDENTITY_BOOTSTRAP_ENABLED`,
`SUPABASE_TRADING_SESSIONS_ENABLED`, `ACG_PERSONAL_DEMO_ENABLED` (backend)
and `VITE_ACG_SUPABASE_AUTH_ENABLED` (frontend).
Backend additionally requires `SUPABASE_PROJECT_REF` and
`SUPABASE_PUBLIC_API_KEY` (public *publishable* key, never service_role).
Auth project must be the independent ACG Trader Supabase project, not
the ACG Funded project. Configure exact frontend origin and OAuth/email
redirects, backend CORS and secure refresh-cookie behavior.

### Staging acceptance

Use isolated staging backend + MongoDB replica set and exact candidate
builds. Test: email signup/confirmation, Google OAuth PKCE, recovery,
provider introspection fail closed, new demo single $100k opening ledger,
many simultaneous callbacks, crash/retry between account and grant,
returning login restores the same account and retains its trading P&L,
revocation on HTTP and active WebSocket, malformed foreign tenant requests,
Connect Prop and ACG Funded ticket regression, responsive mobile and
desktop terminal, market/risk policies.

Do **not** merge backend PRs, enable production signup, change default
production root or launch real demo until all acceptance gates pass and
the owner authorizes production rollout. The approved V6 page remains
identical apart from already approved button labels.
