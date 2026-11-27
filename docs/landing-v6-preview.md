# ACG Trader public landing — approved V6

The approved, self-contained landing-page V6 HTML is copied into
`public/acg-landing-v6.html` with a separate top-nav **Explore Markets** discovery CTA that points to
`/terminal`, and a distinct **Log in** control that continues to point to the
existing authenticated terminal login route.

## Preview workflow

- Local: `http://localhost:5174/?acg_landing_audit=1`
- Hosted (after a reviewed deployment): `https://acg-trader.web.app/?acg_landing_audit=1`
- Direct HTML: `/acg-landing-v6.html`

The preview query redirects to the static landing HTML. Normal `/` loads
the existing AuthProvider, SessionGate and V4 terminal as before.
Federation tickets, existing V4/mobile audit params and explicit
`?acg_login=1` are never redirected to marketing.

The navbar **Explore Markets** now routes signed-out visitors to a
**separate sample-data guest chart workspace**, which reuses ACG's real
chart, drawing and indicator UI without issuing market/trading API requests,
opening account sessions, subscribing to trading WebSockets or submitting
orders. It offers three explicitly labeled **synthetic candle examples**
(EUR/USD, gold, Bitcoin), not actual historical or live market prices.
Guest drawings are stored locally in a separate `GUEST_` namespace.
Guest indicators persist as local IDs only; full settings and cloud
synchronization are not yet supported for anonymous users.

For signed-in sessions `/terminal` still opens the authorized normal terminal.
Explicit `?acg_login=1`, Connect Prop / tenant, federation tickets and
audit links continue to use their existing security boundaries. The navbar
**Log in** and hero **Start Trading** still open authorized account access.
Start Demo routes to the existing auth/signup experience, whose availability
depends on the independently accepted onboarding configuration.

**Release gate:** The guest chart is an honest product preview, *not a live
market browsing service*. Do not represent it as live or remove the sample
data banner until the appropriate market data public-display rights,
rate-limited shared feed, licensing/entitlement checks and dedicated
security acceptance are completed.
The existing ACG Funded terminal gate
remains reachable at `/?acg_login=1`. Onboarding is visually reviewable in
preview, but provider calls remain disabled until a dedicated build has
`VITE_ACG_SUPABASE_AUTH_ENABLED=true` and the backend identity/session
flags plus tenant authorization are enabled in an isolated test environment. We intentionally do
**not** claim that Supabase signup, practice account provisioning or
Cloud onboarding is available: backend PRs #81/#82 are separate and
unmerged. The unchanged terminal illustration remains available in the hero; no
illustrative figures have been modified.

Marketing screenshots contain illustrative values. No live trading,
sessions, tokens, financial calculations or market data calls occur in
the HTML page.

## Planned subsequent change (requires separate acceptance)

After AUTH-0/1, standalone registration, email/Google sign-in, tenant
selection and retry-safe demo provisioning pass staging acceptance,
update sign-in/get-started routing to that working onboarding experience.
Do not replace ACG Funded federation or activate frontend auth changes
from this landing-only milestone.

## Deployment

No deployment, merge or change to production is authorized by the PR.

### Tenant login contract

The current backend `/v1/auth/login` resolves the tenant by its configured **slug**, rather than by the MongoDB ObjectId. The Connect Prop audit field accepts that identifier and routes to the existing password-based login, without adding a new authentication provider. Validate whether the business-facing 'Tenant ID' maps to this slug before expanding public Connect Prop.
