# T-NEW — UI words still drawn past the strings rows, and the single-word scan's blind spots

**Source:** T-721, found while teaching `strings:check` to find drawn single words · **Size:** S · **Needs:** — · **Status:** open

## Why

T-721 moved the drawn single words the scan's new rule (`drawnWord` of `scripts/strings-check.mjs`) finds into strings keys, and made the list helpers of `messages.ts` take the game's strings. Left as they were:

- **Default-table fallbacks outside the list helpers.** A `strings.json` row does not reach a text drawn through `new Strings()`: `announcements.ts`'s `lineText` (`PLAIN`, the folded `ui.legend.folded` line of the strip and the log), and the optional `strings = new Strings()` / `DEFAULT_STRINGS` parameters of `panels/help.ts` (`treeLegendRows`, `keysLabel`, `actionText`, `contextTitle`), `panels/population.ts` (`eligibilityText`), `panels/threats.ts` (`deepQuote`), `panels/overlays.ts` (`drawOverlaysPanel`), `screens/legend.ts` (`legendLines`, `LEGEND_TESTING_NOTE`), `screens/game_menu.ts`, `screens/fortress.ts` (`UI_PANELS` titles) and `panels/military.ts` (`SQUAD_PRESET_NAMES`).
- **A system's English that the UI draws.** 18 emits `ThreatWarning`'s `edge` as English (`'the northern edge'`), which `announce.threat_warning` draws as `{edge}`; the event could carry the edge id (`n`) and the UI word it through `ui.edge.*`, as the Threats panel's Coming line does.
- **Words the rule cannot see.** It looks at where a one-word literal stands, not where a value flows: the `?? 'goods'` fallback of `panels/depot.ts` and `screens/trade_session.ts` (an item type with no row), and `filterText`'s `category` and `tag` filters, drawn as their ids with `_` read as spaces (`food/prepared` → "prepared").

## What to do

- Make the strings argument required in those helpers and pass the game's strings; draw `lineText` with the log's strings.
- Give `ThreatWarning` the edge id and word it in the announcement (18 § Arrival and warning, the announcement's placeholder).
- Move the `goods` fallback to a key; name a category or tag filter through a key per category and tag (`ui.item.category.*`), falling back to the id.

## Done

- [ ] A `strings.json` row reaches each of those lines; a test shows it for one per file.
- [ ] The panels' and screens' existing tests pass unchanged. UI only: no world hash moves.
