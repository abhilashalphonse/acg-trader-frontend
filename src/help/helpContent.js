// Curated support content. Revalidate when execution behavior or policies change.
export const HELP_SECTIONS = Object.freeze([
  { id: 'start', label: 'Getting Started', icon: 'rocket' },
  { id: 'guides', label: 'Feature Guides', icon: 'book-open' },
  { id: 'faq', label: 'FAQs', icon: 'circle-help' },
  { id: 'troubleshooting', label: 'Troubleshooting', icon: 'wrench' },
]);

export const HELP_ARTICLES = [
  {
    "id": "welcome",
    "section": "start",
    "title": "Welcome to ACG Trader",
    "summary": "ACG Trader is a trading terminal for exploring markets, placing and managing trades, and monitoring your account. The chart is your workspace; Markets, Trade, Positions and History let you move between instruments and actions.",
    "steps": [
      "Choose a trading account from the account selector.",
      "Select an instrument from Markets or your watchlist.",
      "Review the chart and the order ticket before trading.",
      "Use Positions and History to review results."
    ],
    "note": "Your active account determines which symbols, permissions and limits apply.",
    "keywords": []
  },
  {
    "id": "accounts",
    "section": "start",
    "title": "Understand your trading account",
    "summary": "You can switch between authorized ACG Trader accounts. Each account carries its own balance, equity, trading permissions, trading objectives and restrictions.",
    "steps": [
      "Open your account selector or mobile Account screen.",
      "Confirm the account code and account type.",
      "Wait for account, positions, orders and risk data to synchronize before placing an order.",
      "Open Account Health to review live limits."
    ],
    "note": "A Free Trial is not a Funded account. Account terms are determined by your specific ACG Funded configuration.",
    "keywords": []
  },
  {
    "id": "markets",
    "section": "start",
    "title": "Find markets and create a watchlist",
    "summary": "The Markets panel groups available instruments by asset class. Instruments may have different hours, quote availability and trading permissions.",
    "steps": [
      "Open Markets and search a symbol or instrument name.",
      "Check the symbol and live/closed status.",
      "Select an instrument to load its chart.",
      "Use the star/watchlist control for quicker access later."
    ],
    "note": "Availability and execution permissions can differ by instrument and account.",
    "keywords": []
  },
  {
    "id": "first-trade",
    "section": "start",
    "title": "Place your first trade",
    "summary": "Choose an instrument and order size before submitting Buy or Sell. The order ticket can use manual lots or a risk-based calculation.",
    "steps": [
      "Select an instrument with an executable BID/ASK quote.",
      "Set manual lot size, or choose risk % with a valid stop-loss price.",
      "Choose Market for immediate execution or configure a pending entry.",
      "Review expected margin and the order preview, then submit once.",
      "Confirm the result in Positions, Pending Orders or History."
    ],
    "note": "Do not resubmit an order whose status is still 'Confirming execution' until you have checked the actual order state.",
    "keywords": []
  },
  {
    "id": "first-position",
    "section": "start",
    "title": "Manage your first open position",
    "summary": "Your Positions area displays running trades, price, size and live P&L. Position actions include updating protection and reducing or closing a position.",
    "steps": [
      "Open Positions and select the position.",
      "Review entry price, current price, P&L and volume.",
      "Use the available action to edit SL/TP, break-even, trailing stop or close.",
      "Check the updated position and History after execution."
    ],
    "note": "Position closing requires an available market session and executable quote.",
    "keywords": []
  },
  {
    "id": "order-types",
    "section": "guides",
    "title": "Market, Limit, Stop and Stop-Limit orders",
    "summary": "Market orders request execution at an available executable price. Pending orders wait for their specified price conditions and can be cancelled or edited before filling.",
    "steps": [
      "In the order ticket select Market or a pending order type.",
      "For pending orders set the trigger/entry price; Stop-Limit uses a trigger and a limit price.",
      "Review side, size, price, SL/TP and the projected order.",
      "Submit and check the Pending Orders tab until the order fills, is cancelled or expires."
    ],
    "note": "A pending order is not a filled position. Exact fill price is not guaranteed.",
    "keywords": []
  },
  {
    "id": "position-sizing",
    "section": "guides",
    "title": "Manual lots and risk-percent sizing",
    "summary": "Manual lots let you choose trading volume directly. Risk % uses the selected stop distance and account context to calculate position size; it requires a valid stop loss.",
    "steps": [
      "Choose Lots to enter a volume manually or Risk to enter a target percentage.",
      "For Risk mode specify entry and stop-loss levels.",
      "Check the calculated volume, estimated opening margin and risk projection.",
      "Review any warning that risk sizing is unavailable for the instrument or account."
    ],
    "note": "Some account policies require an SL even for manual lots; SL-optional V2 behavior is enabled only when confirmed for your account.",
    "keywords": []
  },
  {
    "id": "protection",
    "section": "guides",
    "title": "Set or edit Stop Loss and Take Profit",
    "summary": "SL and TP are protection/exit instructions at defined price levels. A position's protection can be edited from its detail view or supported chart controls.",
    "steps": [
      "Open the order planner to place an SL/TP before entry, or select an open position.",
      "Choose the SL or TP field and edit the price.",
      "Review the projected exit amount and confirm Apply.",
      "Verify the saved level on the position."
    ],
    "note": "Price gaps, execution availability and spreads can affect actual closing price.",
    "keywords": []
  },
  {
    "id": "managing-positions",
    "section": "guides",
    "title": "Partial close, break-even and trailing stop",
    "summary": "You can reduce the size of an existing position, move a stop to its entry price when allowed, or configure a trailing stop.",
    "steps": [
      "Select the relevant position from Positions.",
      "For partial close choose a supported percentage or amount; check the remaining volume.",
      "Use BE only when enabled for the current price; it updates the stop toward entry.",
      "For trailing stop choose a supported distance and confirm the setting.",
      "Check the final state and fills in History."
    ],
    "note": "Closing or modifying a position can be temporarily restricted when an executable quote is unavailable.",
    "keywords": []
  },
  {
    "id": "charts",
    "section": "guides",
    "title": "Candles, timeframes and chart tools",
    "summary": "Switch between candlestick and line charts, adjust timeframes, use drawing tools and explore indicator studies. Candle data may differ from executable BID/ASK quotes.",
    "steps": [
      "Select a supported timeframe from the chart toolbar.",
      "Switch chart style using the chart controls.",
      "Open Indicators to add, hide or configure a study.",
      "Select a drawing tool, place it on the chart and adjust its properties."
    ],
    "note": "An indicator or drawing is analytical only; it does not place an order unless you explicitly use an order action.",
    "keywords": []
  },
  {
    "id": "risk",
    "section": "guides",
    "title": "Understand account risk and margin",
    "summary": "Account Health shows equity, remaining loss limits, profit targets where applicable, free margin and margin level. These values depend on your specific account policy and live valuation.",
    "steps": [
      "Open the Account or Account Health section.",
      "Review Balance, Equity, Used Margin and Free Margin.",
      "Check remaining daily and maximum loss room when live and available.",
      "Look for valuation or exposure warnings before submitting new orders."
    ],
    "note": "Remaining risk should not be treated as available when valuation or policy status is unresolved.",
    "keywords": []
  },
  {
    "id": "buy-sell",
    "section": "faq",
    "title": "How do I place a Buy or Sell?",
    "summary": "Select an instrument, size the trade, then choose Buy or Sell in the order ticket. Review the execution status and confirm the position or pending order afterward.",
    "steps": [],
    "note": "",
    "keywords": [
      "buy sell"
    ]
  },
  {
    "id": "pending-types",
    "section": "faq",
    "title": "What's the difference between Market, Limit, Stop and Stop-Limit?",
    "summary": "Market requests immediate execution. Limit sets a maximum buy/minimum sell price; Stop triggers on price reaching a level; Stop-Limit adds a separate limit constraint after triggering.",
    "steps": [],
    "note": "",
    "keywords": [
      "pending types"
    ]
  },
  {
    "id": "sl-optional",
    "section": "faq",
    "title": "Can I place a trade without a Stop Loss?",
    "summary": "Risk-percent sizing always requires a Stop Loss. Manual-lot entries may omit it only if your account's confirmed V2 capabilities allow that behavior.",
    "steps": [],
    "note": "",
    "keywords": [
      "sl optional"
    ]
  },
  {
    "id": "change-sl",
    "section": "faq",
    "title": "Can I change Stop Loss or Take Profit later?",
    "summary": "Yes, for supported active positions select the SL/TP field in Positions or the position manager, enter a valid price and apply the change.",
    "steps": [],
    "note": "",
    "keywords": [
      "change sl"
    ]
  },
  {
    "id": "partial-close",
    "section": "faq",
    "title": "How do I partially close a position?",
    "summary": "Open Positions, select the trade and use Reduce or a supported partial-close percentage. Confirm the remaining volume after the order completes.",
    "steps": [],
    "note": "",
    "keywords": [
      "partial close"
    ]
  },
  {
    "id": "rejected",
    "section": "faq",
    "title": "Why was my order rejected?",
    "summary": "Possible causes include insufficient margin, invalid price/volume, stale market data, closed markets, unavailable exposure or account restrictions. Read the execution message for the actual reason.",
    "steps": [],
    "note": "",
    "keywords": [
      "rejected"
    ]
  },
  {
    "id": "execution-states",
    "section": "faq",
    "title": "What do Submitting, Accepted, Filled and Confirming mean?",
    "summary": "Submitting means an order request is in progress; Accepted is not necessarily Filled; Filled means an execution was confirmed; Confirming means the final state is unknown and must be reconciled before retrying.",
    "steps": [],
    "note": "",
    "keywords": [
      "execution states"
    ]
  },
  {
    "id": "chart-v-bidask",
    "section": "faq",
    "title": "Why is the chart price different from BID and ASK?",
    "summary": "Candles may reflect a provider's chart price stream, while execution uses the current BID for selling/closing buys and ASK for buying/closing sells. The two streams are not interchangeable.",
    "steps": [],
    "note": "",
    "keywords": [
      "chart v bidask"
    ]
  },
  {
    "id": "negative-pnl",
    "section": "faq",
    "title": "Why does a trade initially show negative P&L?",
    "summary": "A new trade must be valued at its executable closing side, so the BID/ASK spread can cause an immediate unrealized loss. Applicable commission and other trading costs can affect the result.",
    "steps": [],
    "note": "",
    "keywords": [
      "negative pnl"
    ]
  },
  {
    "id": "candles-stuck",
    "section": "faq",
    "title": "Why are candles not updating?",
    "summary": "The instrument may be outside its session, its candle feed may be delayed, or the connection may be stale. Check the market status and whether other symbols are updating.",
    "steps": [],
    "note": "",
    "keywords": [
      "candles stuck"
    ]
  },
  {
    "id": "tradingview-diff",
    "section": "faq",
    "title": "Why does TradingView show different candles?",
    "summary": "Providers can use different feeds, session cutoffs, candle aggregation methods and price references. Comparing identical symbols, markets and timeframes helps, but exact equality is not guaranteed.",
    "steps": [],
    "note": "",
    "keywords": [
      "tradingview diff"
    ]
  },
  {
    "id": "market-status",
    "section": "faq",
    "title": "What do LIVE, STALE, CLOSED and DISCONNECTED mean?",
    "summary": "LIVE indicates usable current market information; STALE means the last quote is too old; CLOSED means the session is shut; DISCONNECTED means data connectivity is unavailable. Execution can be disabled when quotes are not usable.",
    "steps": [],
    "note": "",
    "keywords": [
      "market status"
    ]
  },
  {
    "id": "indicators",
    "section": "faq",
    "title": "How do I add and customize indicators?",
    "summary": "Open Indicators, select a study, then configure its inputs, style and timeframe visibility. Supported studies include EMA, SMA, VWAP, RSI, MACD and Volume.",
    "steps": [],
    "note": "",
    "keywords": [
      "indicators"
    ]
  },
  {
    "id": "pnl",
    "section": "faq",
    "title": "How is profit or loss calculated?",
    "summary": "Floating P&L changes as executable valuation prices move. Realized P&L is recorded when trades are closed. Contract size, commission, spreads and currency conversion may affect account-currency totals.",
    "steps": [],
    "note": "",
    "keywords": [
      "pnl"
    ]
  },
  {
    "id": "balance-equity",
    "section": "faq",
    "title": "What's the difference between Balance and Equity?",
    "summary": "Balance reflects posted account value from realized activity. Equity also incorporates open-position valuation and other applicable charges; it can change while positions are open.",
    "steps": [],
    "note": "",
    "keywords": [
      "balance equity"
    ]
  },
  {
    "id": "margin-values",
    "section": "faq",
    "title": "What are Used Margin, Free Margin and Margin Level?",
    "summary": "Used Margin backs open exposure; Free Margin is capital not currently reserved as margin; Margin Level compares equity against used margin, typically as a percentage.",
    "steps": [],
    "note": "",
    "keywords": [
      "margin values"
    ]
  },
  {
    "id": "loss-limits",
    "section": "faq",
    "title": "What happens if I reach a loss limit?",
    "summary": "ACG Funded challenge policies can breach the account when equity reaches a configured daily or maximum loss threshold. Consult Account Health for the exact live values and your purchased rules.",
    "steps": [],
    "note": "",
    "keywords": [
      "loss limits"
    ]
  },
  {
    "id": "stop-out",
    "section": "faq",
    "title": "What is margin stop-out?",
    "summary": "The stop-out engine can reduce exposure when margin level reaches its configured threshold, commonly 50% on V2 accounts. Stop-out alone does not automatically mean a funded challenge breach.",
    "steps": [],
    "note": "",
    "keywords": [
      "stop out"
    ]
  },
  {
    "id": "risk-percent",
    "section": "faq",
    "title": "How does risk-% sizing work?",
    "summary": "The order planner estimates size from account equity, chosen risk percentage and entry-to-stop distance. Valid prices, conversion data and instrument specifications are needed.",
    "steps": [],
    "note": "",
    "keywords": [
      "risk percent"
    ]
  },
  {
    "id": "account-switch",
    "section": "faq",
    "title": "How do I switch trading accounts safely?",
    "summary": "Choose another authorized account from the selector. Wait until positions, pending orders, history and account risk synchronize before placing new trades.",
    "steps": [],
    "note": "",
    "keywords": [
      "account switch"
    ]
  },
  {
    "id": "asset-classes",
    "section": "faq",
    "title": "Which markets can I trade?",
    "summary": "Use Markets to see currently available Forex, metals, commodities, indices, crypto and any enabled regional instruments. Visibility and trade permissions may differ by account or rollout.",
    "steps": [],
    "note": "",
    "keywords": [
      "asset classes"
    ]
  },
  {
    "id": "instrument-unavailable",
    "section": "faq",
    "title": "Why is an instrument marked CLOSED or unavailable?",
    "summary": "The venue may be outside trading hours, its feed may be unavailable, or its symbol may be chart-only or otherwise not executable. Review the status near the quote/order ticket.",
    "steps": [],
    "note": "",
    "keywords": [
      "instrument unavailable"
    ]
  },
  {
    "id": "market-closes",
    "section": "faq",
    "title": "What happens to an open position after market close?",
    "summary": "An existing position may remain open across a session boundary subject to account rules. Closing or opening usually requires an executable market session and live quote; valuations may rely on permitted last-known data.",
    "steps": [],
    "note": "",
    "keywords": [
      "market closes"
    ]
  },
  {
    "id": "history",
    "section": "faq",
    "title": "Where can I view my executed orders and deals?",
    "summary": "Open History, then browse Deals, Orders and Session activity. Use the available filters to narrow by symbol or period.",
    "steps": [],
    "note": "",
    "keywords": [
      "history"
    ]
  },
  {
    "id": "devices",
    "section": "faq",
    "title": "Can I use ACG Trader on desktop and mobile?",
    "summary": "Yes. Both interfaces support trading workflows with device-specific navigation. Desktop also offers an expanded positions dock and multi-chart workspace.",
    "steps": [],
    "note": "",
    "keywords": [
      "devices"
    ]
  },
  {
    "id": "chart-loading",
    "section": "troubleshooting",
    "title": "Chart loading or blank screen",
    "summary": "A blank chart can result from feed initialization, an unsupported instrument session or candle-history requests that did not complete.",
    "steps": [
      "Confirm the symbol and selected timeframe.",
      "Wait briefly for initial candle history, then retry once.",
      "Try a major live symbol to isolate symbol-specific issues.",
      "If the chart stays blank, report the symbol, timeframe, UTC time and any visible error."
    ],
    "note": "Do not assume the quote used for execution is live merely because old candles are visible.",
    "keywords": []
  },
  {
    "id": "candle-timeout",
    "section": "troubleshooting",
    "title": "Candle history request timed out",
    "summary": "Older candle requests can time out when the provider or network is slow. A timeout does not necessarily mean the trading account is disconnected.",
    "steps": [
      "Check whether current BID/ASK values update.",
      "Switch temporarily to a shorter history/timeframe.",
      "Retry once; avoid repeated rapid requests.",
      "Report repeated failures with the symbol, timeframe and approximate UTC time."
    ],
    "note": "",
    "keywords": []
  },
  {
    "id": "stale-quotes",
    "section": "troubleshooting",
    "title": "Market prices stopped updating",
    "summary": "Price updates can pause due to closed sessions, a stale feed or loss of network connectivity.",
    "steps": [
      "Check the instrument's LIVE/STALE/CLOSED indicator.",
      "Check your internet connection and another symbol.",
      "Avoid placing new orders until executable quotes recover.",
      "Report prolonged stale data during an expected open session."
    ],
    "note": "",
    "keywords": []
  },
  {
    "id": "trading-disabled",
    "section": "troubleshooting",
    "title": "Buy and Sell are disabled",
    "summary": "The terminal blocks new exposure when required information or account permissions are not ready.",
    "steps": [
      "Check the execution warning message.",
      "Verify session status and BID/ASK validity.",
      "Review the account's risk and trading-permission state.",
      "Wait for account reconciliation if a switch or risk update is pending."
    ],
    "note": "Do not bypass blocked execution using a different order route.",
    "keywords": []
  },
  {
    "id": "order-failed",
    "section": "troubleshooting",
    "title": "Order rejected or not confirmed",
    "summary": "An order may be rejected for price, risk, volume, margin or market reasons. A pending confirmation is different from an explicit rejection.",
    "steps": [
      "Read the execution-state message.",
      "Check Positions, Pending and History for a resulting order.",
      "Correct an explicit rejection if it identifies a valid fix.",
      "If confirmation remains unknown, contact support before trying the same order again."
    ],
    "note": "Repeated submission during unknown execution status can create unintended exposure.",
    "keywords": []
  },
  {
    "id": "cant-close",
    "section": "troubleshooting",
    "title": "Position cannot be closed",
    "summary": "Closing needs a live executable quote for the position's instrument. Closed sessions and stale data may block closure.",
    "steps": [
      "Check the position's market session.",
      "Confirm BID and ASK are available and fresh.",
      "Read any disable reason beside Close.",
      "If the session is open and closure continues to fail, report the order/position reference securely."
    ],
    "note": "",
    "keywords": []
  },
  {
    "id": "pnl-question",
    "section": "troubleshooting",
    "title": "P&L looks incorrect",
    "summary": "Check whether you are comparing chart price against executable BID/ASK, and whether spread, commission or account-currency conversion is involved.",
    "steps": [
      "Compare entry with the correct executable closing price.",
      "Check contract size, position volume and account currency.",
      "Review realized deal entries in History.",
      "Report an unexplained discrepancy with the relevant timestamp and transaction reference."
    ],
    "note": "",
    "keywords": []
  },
  {
    "id": "switching",
    "section": "troubleshooting",
    "title": "Account switching seems stuck",
    "summary": "The terminal can hold execution until account grants, positions, orders, history and risk state finish loading.",
    "steps": [
      "Wait for synchronization and check for a visible error.",
      "Verify you selected an authorized account.",
      "If a retry prompt appears, follow it once.",
      "Contact support if the account never becomes ready."
    ],
    "note": "",
    "keywords": []
  },
  {
    "id": "missing-market",
    "section": "troubleshooting",
    "title": "A market or instrument is missing",
    "summary": "An instrument might be unavailable from the provider, filtered by the current market view, or not enabled for execution.",
    "steps": [
      "Clear the Markets search and category filters.",
      "Search the exact symbol as well as its description.",
      "Check whether the instrument is hidden as unavailable.",
      "Send feedback if a useful supported market is absent."
    ],
    "note": "",
    "keywords": []
  }
];

export function findHelpArticles(query, section = null) {
  const needle = String(query || '').trim().toLowerCase();
  const terms = needle.split(/\s+/).filter(Boolean);
  return HELP_ARTICLES.filter(article => (!section || article.section === section)
    && terms.every(term => [article.title, article.summary, ...article.steps, article.note, ...article.keywords].join(' ').toLowerCase().includes(term)));
}
export function getHelpArticle(id) { return HELP_ARTICLES.find(article => article.id === id) || null; }
