> **Audit revision — 2026-10-16:** Approved final entry points are Start Trading → native Connect Prop, Try Demo → standalone Supabase demo signup, and For Businesses → separate B2B onboarding. The Supabase-to-partner-tenant organization selection below is legacy prototype work and **not approved for live rollout**. Both Supabase auth flags remain OFF; automatic $100K virtual-demo provisioning is still missing. See `docs/onboarding-v1-approved-contract.md`.

# V6 landing → Supabase standalone onboarding

**Source of truth:** Approved V6 static HTML. Its layout, typography, market
claims, illustrations, business section and responsive rules are unchanged.
Only the existing nav and hero primary CTA are updated for the approved
paths: Start Trading to opt-in native Connect Prop and Try Demo to disabled-by-default Supabase signup.

## Routes

- `/?acg_landing_audit=1`: approved marketing preview.
- `/?acg_auth=signup&acg_onboarding_audit=1`: registration.
- `/?acg_auth=signin&acg_onboarding_audit=1`: sign-in.
- `/?acg_auth=recover&acg_onboarding_audit=1`: recovery.
- `/auth/callback`: Supabase Google OAuth PKCE / email confirmation / recovery.
- `/?acg_login=1`: original ACG Funded credential gate.
- `/?ticket=...` and `/?acg_ticket=...`: original federation exchange.
- Existing V4/mobile audit and the normal terminal root remain unaffected.

## Auth provider boundaries

Browser uses **only the dedicated ACG Trader Supabase publishable key**,
never a service-role credential. Provider API calls are restricted to the
fixed ACG Trader Supabase project; Google uses SHA-256 PKCE with a fresh
verifier scoped to browser sessionStorage, callback only on the same origin.
Email signup/recovery also request PKCE; callback claims are exchanged and
removed from the browser URL. Password tokens do not enter links.
Short-lived provider and refresh tokens are kept in sessionStorage for
onboarding; ACG Trader's existing trading session uses its own HttpOnly
rotating cookie. Provider tokens are not used to authorize trading.

After a verified login:
1. `POST /v1/identity/bootstrap` establishes the independent User/Identity.
2. `GET /v1/auth/supabase/organizations` lists only organizations with
   active, explicit `TRADE` grants for that identity.
3. If an organization is selected, `POST /v1/auth/supabase/exchange`
   issues a single-tenant opaque trading session. The terminal uses
   the original AuthProvider after redirect and refresh-cookie recovery.
4. No authorized accounts → truthful `setup required` state; no invented
   demo account, automatic partner linking or false onboarding completion.
   `VIEW`-only access does not authorize trading. Multi-tenant accounts
   remain individually scoped by backend grants.

## Rollout gates

`VITE_ACG_SUPABASE_AUTH_ENABLED` defaults to false; the new frontend UI
remains visible for visual preview but prevents **all** provider requests
until explicitly enabled in a staging build. The backend also requires
`SUPABASE_IDENTITY_BOOTSTRAP_ENABLED` and
`SUPABASE_TRADING_SESSIONS_ENABLED`, each default false, and each tenant
must opt into `SUPABASE` in its auth modes. No public signup is enabled
through this PR alone.

For functional testing in isolated staging:
- Configure the exact staging domain `/auth/callback` as a Supabase Auth
  redirect URL, with Google OAuth and email confirmation active.
- Point `VITE_ACG_TRADER_API_BASE` to the isolated staging backend built
  from backend PRs #81/#82; avoid production.
- Enable both backend flags and the frontend flag, and provision an
  explicit tenant `SUPABASE` auth mode and access grant using the
  tenant-scoped service API (no automatic email match).
- Verify Google/email signup, verification, recovery, context listing,
  cross-firm denial, grant revoke (HTTP and active WS), repeated onboarding,
  existing ACG Funded federation, and terminal state.
- Only then authorize a separate production merge/deployment.
  Backend PRs #81/#82 and landing PR #124 remain separate draft PRs.

**Known outstanding work:** automatic initial personal DEMO provisioning
and identity linking with proof of control. Both require separate
review and staging validation before general public onboarding.
