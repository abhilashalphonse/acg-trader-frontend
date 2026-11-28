# Phase 8A — chart action foundation

ACG AI remains read-only with respect to accounts and execution. Chart actions are a separate local UI capability. Model text is never parsed as a command or given a direct store mutation capability.

Current terminal audit: ChartArea renders DrawingLayer; DrawingLayer uses the existing symbol-scoped drawingStore and commitDrawings/undoDrawings. TradingChart coordinates use Unix seconds. TradingTerminalV2 owns timeframe and indicator state. Reuse those paths, not a parallel persistence system.

Phase 8A adds an unmounted proposal/confirmation primitive for horizontal lines and rectangles only. A later trusted adapter must derive exact geometry from validated market references or explicitly provided user values; the new primitive validates geometry and workspace scope, not evidence truth. Apply must receive current chart identity, symbol, timeframe, unexpired same-process proposal, exact drawing revision, and separate user confirmation. Multi-drawing proposals append as a single undoable drawing-store transaction. No order actions, account access, provider calls or automatic model execution.

Next: wire verified server-owned evidence references to proposal construction, preview/confirmation UI in StaffWorkspaceChat and current chart adapter (desktop/mobile), with chart lifecycle and stale-reference tests. Add timeframe/indicator actions separately through existing terminal state. Do not release chart mutations until end-to-end verification, including chart changes, editing/undo, duplicate prevention and no trading side effects.
