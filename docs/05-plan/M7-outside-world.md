# M7 — The Outside World

**Goal:** caravans and trade, immigration, reputation, the legend, settings, keybindings, milestones; the complete game. **Gate:** `td_*`, `im_*`, `ui_*`, e2e `trade-session`, `save-load-settings`.

Spec: [`20`](../02-systems/20-trade-and-caravans.md), [`21`](../02-systems/21-immigration.md), [`24`](../02-systems/24-ui-and-input.md), algorithms `economy.md` § Trade, § Immigration, `creature-brains.md` § Caravan AI; content `caravan-goods.md`, `ui-keymap-and-screens.md`.

## T-M7-01 Trade: schedule, caravan parties, goods generation, arrival, depot, departure (L)

Needs: M6. Produces: `src/systems/trade/{index,state,reader,schedule,caravan,goods}.ts`: per-civ schedule with bans and weather skips, party spawn with merchants/guards/pack animals and gear, goods generation with requests share, caravan AI states, `CaravanArrived/Waiting/AtDepot/Departed/Lost/Attacked`, depot reachability check, unloading into the depot container, guards fighting through factions.
Spec: `20` § Schedule, § Party, § Movement; `caravan-goods.md` § Budget and the three lists.
Tests: scenarios `td_schedule`, `td_no_depot`, `td_attack`; unit: budget formula; requests spend first; skip rule at temper 4; rare entries only at reputation ≥ 50.

## T-M7-02 Trade: moving goods, the session, valuation, offers, gifts, reputation (M)

Needs: 01. Produces: `MoveToDepot/RemoveFromDepot` haul jobs and `AtDepot` flag, `TradeOpen` job and modal state, `TradeOffer/TradeCancel`, valuation and margin, wood penalty, gifts, reputation log and yearly drift, `SetRequests`, Broker skill use, trading xp.
Spec: `20` § Moving goods, § The session, § Valuation, § Requests, § Reputation effects; `caravan-goods.md` § Preferences, § Reputation events.
Tests: scenarios `td_offer`, `td_wood_penalty`, `td_requests`; unit: preference key resolution order; margin formula bounds; gift cap per caravan.

## T-M7-03 Trade session screen, civilizations panel, depot panel (M)

Needs: 02, M6-16. Produces: `screens/trade_session.ts` (two columns, quantities, footer arithmetic, merchant lines, keyboard and mouse per the wireframe), `panels/civilizations.ts`, depot panel with "move goods" selection mode in the stocks tree.
Spec: `ui-screens/trade-session.md`, `ui-screens/panels.md` § Civilizations.
Tests: unit golden buffers; footer arithmetic; e2e `trade-session`: fast-forward to the Hillfolk arrival (through the hook: `step` until `CaravanAtDepot`), move 20 meals to the depot, open trade, select cloth, offer, assert `TradeCompleted` and reputation change in the panel text.

## T-M7-04 Immigration (M)

Needs: M6, M4-13. Produces: `src/systems/immigration/{index,state,reader,waves}.ts`: seasonal evaluation with deferral during raids, guaranteed waves, eligibility reasons, size formula, composition with coverage weights, families and pets, equipment and tools, arrival trickle, `ImmigrantsArrived/ImmigrationSkipped`, `SetPopulationCap`, Mountainhome reputation bonus.
Spec: `21` (all); algorithm `economy.md` § Immigration wave.
Tests: scenarios `im_guaranteed`, `im_threshold`, `im_cap`, `im_composition`; unit: size clamp; winter halving; names unique; children arrive as children.

## T-M7-05 Population panel; renown and reputation readers in threats (S)

Needs: 04, 02. Produces: `panels/population.ts`; 18 reads Hillfolk reputation for bandits and caravan guard counts read peril and `twilight_pass`.
Tests: unit golden; bandits suppressed at reputation ≥ 50.

## T-M7-06 Legend record and screen; retire; final saves (M)

Needs: 04, M6-14. Produces: milestone registry (`register.milestone`) with the fifteen milestones and their triggers, kill records of note, the legend record on fortress end (all dead or retired), `final-<slug>` save (view-only load: commands rejected), Legends list in the main menu, `screens/legend.ts`, `RetireFortress` with confirmation, "The hall falls silent" flow.
Spec: `24` § The legend record, § Game menu; `persistence.md` § Legends; `ui-keymap-and-screens.md` § Milestones.
Tests: unit: each milestone trigger from an event fixture; legend text composition; view-only rejects `Designate`. Scenario: all dwarves killed by script → legend written with cause text.

## T-M7-07 Settings screen, keybinding remap, colorblind toggle, auto-pause toggles, autosave toggle (M)

Needs: M2-11. Produces: `screens/settings.ts` and the settings store, keymap overrides with conflict display, palette swap, `STATUS_HINT_SECONDS` rejection display, edge scrolling setting.
Spec: `ui-screens/menus-and-world.md` § Settings; `24` § Settings, § Accessibility; `glyphs-and-colors.md` alternates.
Tests: unit: rebind conflict detection; settings persist across reload (storage adapter); e2e `save-load-settings`: change zoom and a keybinding, reload the page, assert both persisted; save, load, hash equal.

## T-M7-08 Help screen, legend of glyphs, overlays panel complete, debug panel (S)

Needs: 07. Produces: `panels/help.ts` (keys from the live keymap; glyph legend generated from content), `panels/overlays.ts` with debug overlays (connectivity, paths, chunks), `panels/debug.ts` with timings from `host.stats()`, counts, seed, `dump save`, `hash world`, `replay season log`.
Spec: `ui-screens/panels.md` § Overlays, § Help, § Debug; `performance-budget.md` § Measurement.
Tests: unit: help lists every keymap row; debug timings table non-empty after ticks.

## T-M7-09 Game menu, main menu Continue, confirmations complete (S)

Needs: 06, 07. Produces: the Esc chain (tool → panel → menu), every confirmation dialog of `ui-keymap-and-screens.md` § Confirmations wired, `c_main_menu` unsaved check, `Continue` semantics.
Tests: unit: Esc chain state machine; each confirmation's default; e2e: Esc opens the menu, Resume returns.

## T-M7-10 Announcement registry complete; strings table audit (S)

Needs: 01–09. Produces: every `ui` row of `event-catalog.md` has an announcement spec with the severity named in its system document; `strings.json` complete; `scripts/strings-check.mjs` fails on a missing key or an unused key.
Tests: unit: a table-driven test iterates the event catalog (parsed) and asserts a registration exists for each `ui` row.

## T-M7-11 Full-year headless scenario and the balance table (M)

Needs: all above. Produces: `test/scenarios/year_one.scenario.ts` upgraded to a full year with caravans and immigration: asserts the year-one expectation rows of `balance.md` that are deterministic (caravan windows, guaranteed waves, first raid absent at peril 2 before autumn year 1 … ) and reports the rest.
Tests: the scenario itself; the gate report includes its table.

## T-M7-12 Gate M7 (S)

Needs: all. `reports/M7-gate.md`; `current-milestone: 8`; property generator extended with trade, requests, population cap and settings-free commands (settings are app-level).
