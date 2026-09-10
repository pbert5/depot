# Wargear evaluator handoff

The core currently provides `parseWargearRules`, which returns rule IR and
diagnostics, but no evaluator or transition function. The web adapter in
`wargear-quantity-adapter.ts` is deliberately the only bridge used by the unit
editor: it derives controls for proven `quantity` and `choice-group` rules and
keeps every other entry on the existing toggle path.

When core exposes an evaluator, replace the adapter's parser-backed constraint
map and `transition` implementation with that API. Keep the adapter's return
shape (`controls` plus `transition`) stable so the React components remain
presentation-only. Do not infer legality from unsupported prose, prerequisites,
conflicts, replacements, or model scopes in the web layer.
