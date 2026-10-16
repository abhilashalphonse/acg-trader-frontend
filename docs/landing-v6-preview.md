# ACG Trader public landing — approved V6

The approved, self-contained landing-page V6 HTML is copied into
`public/acg-landing-v6.html` with **only its existing nav CTA**
pointing to the current ACG Trader login route.

## Preview workflow

- Local: `http://localhost:5174/?acg_landing_audit=1`
- Hosted (after a reviewed deployment): `https://acg-trader.web.app/?acg_landing_audit=1`
- Direct HTML: `/acg-landing-v6.html`

The preview query redirects to the static landing HTML. Normal `/` loads
the existing AuthProvider, SessionGate and V4 terminal as before.
Federation tickets, existing V4/mobile audit params and explicit
`?acg_login=1` are never redirected to marketing.

The navbar **Sign in** link routes to `/?acg_login=1`, which currently
shows the existing trading-account credential gate. We intentionally do
**not** claim that Supabase signup, practice account provisioning or
Cloud onboarding is available: backend PRs #81/#82 are separate and
unmerged. The hero's 'Explore the terminal' continues scrolling to
the approved illustrative terminal showcase.

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
