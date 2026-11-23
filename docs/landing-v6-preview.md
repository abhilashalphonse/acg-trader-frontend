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

The navbar **Explore Markets** is reserved for the forthcoming public guest
chart workspace. This *landing-only* branch does not bypass the terminal
`SessionGate`; until a licensed, read-only guest implementation is accepted,
visitors who follow the CTA still encounter authorized-account login.
Do not merge this CTA change independently of the guest release. The
navbar **Log in** still opens the existing native trading-account sign-in,
and the hero's **Start Trading** still opens the authorized account login.
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
