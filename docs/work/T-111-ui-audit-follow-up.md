# T-111 — UI audit follow-up: what the U tasks changed

**Source:** [`../../reports/audits/ui-audit.md`](../../reports/audits/ui-audit.md); the closing instruction of [`../archive/ui-fixes/README.md`](../archive/ui-fixes/README.md) ("When all eight are done …") · **Size:** S · **Needs:** U-02, U-04, U-05, U-07 · **Status:** open

## Why

The UI fixes plan ends with a follow-up: once all eight U tasks are done, record which audit item each one closed, and walk through the game again. An audit is never updated, so the follow-up is a new report and not an edit of `ui-audit.md`.

## What to do

1. Write a new dated report, `reports/audits/<YYYY-MM-DD>-ui-audit-follow-up.md`, with:
   - a table: audit item (the audit's own ids: issues 1–10, Q1 … Q14, M1 … M12, S1 … S9, § 4.x, § 5.x) → task (U-01 … U-08) → commit → state (fixed, partly fixed, open);
   - the hands-on walkthrough of the audit's § 2 ("A new player's first 20 minutes"), run again on the current build, saying what changed and what is still wrong.
2. For every item that is still open or only partly fixed, add a `T-1nn` row to [`../backlog.md`](../backlog.md) with the new report as its source.
3. Do not edit `reports/audits/ui-audit.md`.

## Done

- The report exists, and every audit item appears in its table exactly once.
- The verification commands of [`../process/agent-workflow.md`](../process/agent-workflow.md) are green.

## Draft: mechanical closure record (part 1 only)

Code snapshot: `c2b8ca8`, 2026-10-08. This is a source-and-history record against the frozen `ui-audit.md` at `134ff43`. "Fixed" means the cited implementation covers that item's stated behavior; "partly fixed" names the remaining code gap. These states do not certify the current UX. The hands-on walkthrough of section 2, the dated follow-up report and filing follow-up tasks remain to be done. T-111 stays open.

The audit's numbered issues, Q/M/S recommendations and sections 4.x/5.x each appear once below. Its unnumbered repetitive-task table and spec-mismatch table also appear once each, using local identifiers R1-R14 and 7.1-7.19 in their original row order. Repeated findings retain their own audit identities and cross-reference the same implementation commits. Section 2 is the pending walkthrough, not a second mechanical finding list; the appendix records the original audit method.

### Implementation commits used

| Task | Implementation commits |
|---|---|
| U-01 | `0d7199b` failures/log; `cc8c064` no-op messages/names; `0b124b1` embark/safe defaults/input keys; `a8e0a26` hostiles/glyphs/build list/list height/help/hints |
| U-02 | `fac58ce` immediate paused command phase/save-load/replay |
| U-03 | `42b1f7a` order picker/count/repeat/status and panel-key precedence/confirmations |
| U-04 | `5d9759f` drag placement and out-of-stock order prompt |
| U-05 | `3b06f7b` building controls |
| U-06 | `9d92c17` labor manager/unit and squad controls; `38604ca` corresponding spec; `8e0985e` e2e coverage |
| U-07 | `0e875a7` stockpile editor and room diagnostics/owner |
| U-08 | `42c623d` clipped-label tooltips/palette distances/ghost glyphs |
| Later/pre-existing | `5bb5581` T-121 Settings conflict localization; `542e51b` Load thumbnails already predating the U work; `4b8ef2f` trade quantities already predating the U work; `c38d1d8` single-batch Undo already predating the U work |

Progress-only and merge commits are not counted as implementations. File:line references below identify the snapshot's code, not the audit's older line numbers. Commit attribution is to the change introducing the path, rather than a later merge containing it.

### Top ten issues

| Item | Task / commit | State from code | Evidence and remaining scope |
|---|---|---|---|
| Issue 1: empty initial embark | U-01 `0b124b1` | fixed | `src/ui/screens/embark.ts:163,263`: Balanced applied initially; unsafe embark asks a default-No confirmation. |
| Issue 2: paused commands invisible | U-02 `fac58ce` | fixed | `src/app/sim-host.ts:192,199`: submit runs the command phase while paused without stepping time; recorded replay and save/load tests accompany the commit. |
| Issue 3: order quantity cannot change | U-03 `42b1f7a` | fixed | `src/ui/panels/orders.ts:245,313,339,845`: typed quantity, +/- and list count controls; `src/ui/screens/fortress.ts:1084` routes picker input. |
| Issue 4: accelerators swallow panel keys | U-03 `42b1f7a` | fixed | `src/ui/screens/fortress.ts:1146,1148`: global panel keys precede panel actions; `src/ui/keymap.ts` reserves panel letters and provides Shift accelerators. Destructive paths use `confirmThen`. |
| Issue 5: catalog commands lack UI | U-05 `3b06f7b`, U-06 `9d92c17`, U-07 `0e875a7`, U-01 `a8e0a26` | partly fixed | Building modes/links/owners, labors/titles/schedules/squad controls, stockpile containers and Harvest have emitters. `TrainAnimal` and `RenameFortress` still have no UI emitter; see 5.4. |
| Issue 6: failures and waiting reasons unclear | U-01 `0d7199b`,`cc8c064`,`a8e0a26`, U-03 `42b1f7a` | fixed | `src/ui/messages.ts:242,345,379`, `src/ui/panels/jobs.ts:95`, `src/ui/panels/orders.ts:625`, `src/ui/screens/fortress.ts:300`: named inputs, order status, no-op feedback and persistent rejection log cover this summary's enumerated cases. Wider proposals remain under 4.x. |
| Issue 7: ids/codes leak | U-01 `cc8c064`,`a8e0a26` | fixed | `src/ui/messages.ts:89,100,120`, `src/ui/announcements.ts:174,180,222`, `src/app/game.ts:527,633`, `src/ui/screens/settings.ts:141`: names/ordinals, friendly reasons/dates, context labels; milestone placeholders removed. |
| Issue 8: labor/military lists fail at scale | U-01 `a8e0a26`, U-06 `9d92c17` | fixed | `src/ui/panels/labors.ts:100,128`, `src/ui/screens/labor_manager.ts:289,316,545`, `src/ui/panels/military.ts:443`: row scrolling, full labor names, templates/priority controls and header-inclusive squad height. |
| Issue 9: sealed hostiles counted | U-01 `a8e0a26` | fixed | `src/ui/status.ts:63` counts discovered/spotted hostiles instead of all sealed cavern creatures. |
| Issue 10: truncation and missing glyphs | U-01 `a8e0a26`, U-08 `42c623d` | partly fixed | `src/ui/surface.ts:67,220`, `src/ui/widgets/label.ts:24,55`, `src/ui/panels/build.ts:58,464`: glyph aliases, clipped-label tooltips and named build rows. `src/ui/screens/trade_session.ts:177,178` still draws the two headers without clipping to their columns. |

### Quick recommendations

| Item | Task / commit | State from code | Evidence and remaining scope |
|---|---|---|---|
| Q1 Balanced and unsafe-loadout warning | U-01 `0b124b1` | partly fixed | `src/ui/screens/embark.ts:163,267,268`: Balanced and pick/food/drink confirmation implemented. The audit's additional axe warning was not adopted by the accepted U decision. |
| Q2 selected order count keys | U-03 `42b1f7a` | fixed | `src/ui/panels/orders.ts:845`, `src/ui/screens/fortress.ts:1084`: count input wins; new order uses Shift+N under the accepted reserved-panel-letter rule. |
| Q3 friendly reasons/titles/settings | U-01 `0d7199b`,`cc8c064`,`a8e0a26` | fixed | `src/ui/messages.ts:89,242,345`, `src/ui/announcements.ts:174,180`, `src/app/game.ts:527,633`, `src/ui/screens/settings.ts:141`; no-op/milestone labels removed. |
| Q4 missing input and blocked summary | U-01 `0d7199b`,`cc8c064` | fixed | `src/ui/messages.ts:345,353,379`, `src/ui/panels/jobs.ts:95,127`: named quantities, registered reason text and per-reason breakdown. |
| Q5 rejections logged for four seconds | U-01 `0d7199b` | fixed | `src/ui/screens/fortress.ts:300,308`, `src/ui/constants.ts:20`: alert log with focus plus four-second status. |
| Q6 silent no-ops | U-01 `cc8c064` | fixed | `src/ui/screens/fortress.ts:807,939,1531`, `src/ui/screens/trade_session.ts:122,127`, `src/ui/panels/military.ts:365`: trade, empty drags, target misses, offer/gift and squad-limit messages. |
| Q7 aliases and readable build rows | U-01 `a8e0a26` | fixed | `src/ui/surface.ts:67`, `src/ui/panels/build.ts:46,58,464`: aliases and content names with name column first. |
| Q8 visible-hostile counter | U-01 `a8e0a26` | fixed | `src/ui/status.ts:63`: discovered/spotted predicate. |
| Q9 Harvest | U-01 `a8e0a26` | fixed | `src/ui/panels/designate.ts:153,182`: available tool and `DesignateHarvest` command. |
| Q10 paused speed, save menu, browser keys | U-01 `0b124b1` | fixed | `src/ui/screens/fortress.ts:1055,1103,1106,1118`, `src/platform/input.ts:112,156,180`: paused speed retention, save-menu path and swallowed Ctrl+S/Ctrl+wheel. |
| Q11 seed-field controls/hint | U-01 `0b124b1` | fixed | `src/ui/screens/world_gen.ts:190,194`: Enter/Tab finish editing and generation accelerator when untouched; focused hint supplied. |
| Q12 fuel/farm hints | U-01 `a8e0a26` | fixed | `src/ui/hints.ts:53,59,112,118`, `src/ui/screens/fortress.ts:829`: recognized fuel input shortage and refused/empty farm placement feedback. |
| Q13 list heights and labor rows | U-01 `a8e0a26` | fixed | `src/ui/panels/military.ts:443`, `src/ui/panels/labors.ts:28,100`: header included and first visible row clamped. |
| Q14 grouped contextual Help | U-01 `a8e0a26` | fixed | `src/ui/panels/help.ts:123,126,140,180,187`: panel keys first, grouped keys and context-aware wording. |

### Medium recommendations

| Item | Task / commit | State from code | Evidence |
|---|---|---|---|
| M1 immediate paused input | U-02 `fac58ce` | fixed | `src/app/sim-host.ts:199`: zero-time command phase. |
| M2 order picker/count/mode/material/status/repeat | U-03 `42b1f7a` | fixed | `src/ui/panels/orders.ts:184,201,245,313,318,339,386,625`: recent/groups, quantity/mode/material, repeat and status. |
| M3 panel precedence and destructive confirmations | U-03 `42b1f7a` | fixed | `src/ui/screens/fortress.ts:1146`, `src/ui/keymap.ts`, `src/ui/panels/context.ts` `confirmThen`; hotkey-table regression covers panel states. |
| M4 building panel controls | U-05 `3b06f7b` | fixed | `src/ui/panels/building.ts:144,145,147,217,242,264,315,322,371,375,392`: modes, mechanism links, plates, cages, coffin/owner and priority. |
| M5 labor manager | U-06 `9d92c17`,`38604ca`,`8e0985e` | fixed | `src/ui/screens/labor_manager.ts:235,252,289,316,545`: templates, priority row, scrolling and named columns; UI tests/e2e in the task commits. |
| M6 drag placement and order prompt | U-04 `5d9759f` | fixed | `src/ui/panels/build.ts:314,392,434,468`: valid-tile batch, count, out-of-stock offer and mouse path. |
| M7 editable stockpile controls | U-07 `0e875a7` | fixed | `src/ui/panels/stockpile-editor.ts:48,58,65,78,88,92,99,144,209,232,238`: preset/tree/material/container/priority/quality keyboard and mouse paths. Links were outside M7's listed scope; see 7.8. |
| M8 truncated-cell tooltips | U-08 `42c623d` | fixed | `src/ui/widgets/label.ts:24,55`, `src/ui/surface.ts:220,224`, `src/ui/screens/fortress.ts:439,626`: full clipped text on hover, including the retained 36-column sidebar. |
| M9 room diagnostics and owner | U-07 `0e875a7` | fixed | `src/ui/panels/zones.ts:126,139,142,363,374,376,381`, `src/ui/screens/fortress.ts:483`: missing requirements, open-border count/highlight and owner picker. |
| M10 unit marks/mood/title/rename | U-06 `9d92c17` | fixed | `src/ui/panels/units.ts:85,97,157,163,177,372`: multi-selection, mood and title/rename actions. |
| M11 squad marks/leader/barracks | U-06 `9d92c17` | fixed | `src/ui/panels/military.ts:257,264,271`, `src/ui/panels/units.ts:207`: leader, barracks and marked-member assignment. |
| M12 perceptual palette and ghost states | U-08 `42c623d` | fixed | `src/render/palette.ts:87,102,263`, `src/ui/screens/fortress.ts:513`, `test/unit/render/accessibility.test.ts`: bright ghost roles/glyph differences and CIEDE2000 minimum-distance checks in both palettes. |

### Spec recommendations

| Item | Task / commit | State from code/spec | Evidence |
|---|---|---|---|
| S1 initial Balanced and safe warning | U-01 `0b124b1` | fixed | `docs/02-systems/02-embark-and-loadout.md` Presets/Player-facing behavior and `src/ui/screens/embark.ts:163,263`. |
| S2 paused command phase | U-02 `fac58ce` | fixed | `docs/01-architecture/simulation-core.md` Commands and `src/app/sim-host.ts:199`. |
| S3 Add order wireframe | U-03 `42b1f7a` | fixed | `docs/04-implementation/ui-screens/panels.md` Orders and `src/ui/panels/orders.ts:245`. |
| S4 globally reserved panel letters | U-03 `42b1f7a` | fixed | `docs/03-content/ui-keymap-and-screens.md` Panels and `src/ui/keymap.ts` `accel`/`panelLetters`; `src/ui/screens/fortress.ts:1146`. |
| S5 stockpile removal defaults No | U-01 `0b124b1` | fixed | `docs/03-content/ui-keymap-and-screens.md` `c_remove_stockpile_items` and its mirrored JSON default; `src/ui/panels/context.ts` routes the confirmation. |
| S6 discovered/spotted hostiles | U-01 `a8e0a26` | fixed | `docs/04-implementation/ui-screens/fortress-screen.md` status and `src/ui/status.ts:63`. |
| S7 named input quantities | U-01 `0d7199b`,`cc8c064` | fixed | `docs/02-systems/11-jobs-and-labor.md` Player-facing behavior and `src/ui/messages.ts:379`. |
| S8 rejection log and focus | U-01 `0d7199b` | fixed | `docs/02-systems/24-ui-and-input.md` Announcements and `src/ui/screens/fortress.ts:300`. |
| S9 1x1 drag placement | U-04 `5d9759f` | fixed | `docs/02-systems/14-buildings-and-rooms.md` Player-facing behavior and `src/ui/panels/build.ts:314`. |

### Errors/warnings and clarity/layout sections

| Item | Task / commit | State from code | Evidence and remaining scope |
|---|---|---|---|
| 4.1 command rejections | U-01 `0d7199b`,`cc8c064`, U-02 `fac58ce` | partly fixed | `src/ui/messages.ts:242,251,255,265`, `src/ui/screens/fortress.ts:300`: immediate named/focused/logged rejections and repeated placement rules. Generic `precondition_failed` remains for cases without specific detail; Undo does not report the proposed kept-designation count. |
| 4.2 silent no-ops | U-01 `cc8c064`,`0b124b1` | fixed | `src/ui/screens/fortress.ts:807,939,954,1055,1118,1531`, `src/ui/screens/trade_session.ts:122,127`, `src/ui/panels/military.ts:365`: messages/guards for the listed cases. |
| 4.3 blocked/waiting work | U-01 `0d7199b`,`cc8c064`, U-03 `42b1f7a` | partly fixed | `src/ui/messages.ts:345,353,359,364,379`, `src/ui/panels/orders.ts:625`, `src/ui/panels/jobs.ts:95`: named inputs/reasons/status/breakdown. `src/systems/workshops/index.ts:40` still registers only `no_magma` for the proposed once-per-cause workshop alert. |
| 4.4 room/zone/stockpile state | U-07 `0e875a7`, U-01 `cc8c064` | partly fixed | `src/ui/panels/zones.ts:363,374,376`, `src/ui/messages.ts:120`, `src/ui/announcements.ts:227`: room diagnostics and focused named stockpile-full note. Farm-needs-seeds text still lacks the proposed plot number (`src/ui/strings.ts:961`). |
| 4.5 trade/military/saves/announcements | U-01 `cc8c064` | fixed | `src/ui/announcements.ts:174,180,222`, `src/app/game.ts:527,633,728`: friendly immigration/reputation, omitted zero-child clause, friendly save and separate load failure. Quota and combat log were already marked OK in the audit; no U closure claimed for them. |
| 4.6 dead/missing hints | U-01 `a8e0a26` | partly fixed | `src/ui/hints.ts:53,59,112,118`: fuel and farm triggers repaired. Global "no mining enabled" and "jobs blocked: no path" hints still lack emitters; `src/systems/jobs/constants.ts:19` `IDLE_HAULER_WARNING` remains unused. |
| 5.1 hierarchy/truncation | U-01 `0d7199b`,`cc8c064`,`a8e0a26`, U-08 `42c623d` | partly fixed | Named panels, correct hostiles, logged failures and hover tooltips implemented (`src/ui/status.ts:63`, `src/ui/screens/fortress.ts:300,439`, `src/ui/messages.ts:89`). `src/ui/status.ts:36,78` has no caravan `$` field; `src/ui/screens/fortress.ts:596,613` draws finite-width status/hotkey rows. No layout judgement made. |
| 5.2 glyphs/colors | U-01 `a8e0a26`, U-08 `42c623d` | partly fixed | Aliases, distinct ghost glyphs and perceptual palette checks (`src/ui/surface.ts:67`, `src/ui/screens/fortress.ts:513`, `src/render/palette.ts:263`). Zone qualification and room open-border overlay still change background alone (`src/ui/screens/fortress.ts:483,498`). |
| 5.3 keys/help/discoverability | U-01 `0b124b1`,`a8e0a26`, U-03 `42b1f7a` | partly fixed | Global panel precedence, Shift accelerators, contextual grouped Help, localized bindings and paused speed keys exist. The open panel's own key still toggles it closed (`src/ui/screens/fortress.ts:1275`), as retained by the accepted U-03 decision; the audit's toggle-surprise proposal was not adopted. |
| 5.4 missing command UI | U-01 `a8e0a26`, U-05 `3b06f7b`, U-06 `9d92c17`, U-07 `0e875a7` | partly fixed | Emitters now cover the listed building/room/coffin/title/mechanism/mode/plate/trap/cage/taming/labor/build/designation/squad/schedule/container/Harvest/barracks controls (`src/ui/panels/building.ts`, `zones.ts`, `units.ts`, `military.ts`, `designate.ts`, `stockpile-editor.ts`, `src/ui/screens/labor_manager.ts`). `ReleaseCage` covers that alias pair; `TrainAnimal` and `RenameFortress` remain without UI emitters. |
| 5.5 empty states/confirmations | U-01 `cc8c064`,`0b124b1`, U-03 `42b1f7a` | fixed | Jobs/Orders/Military empty hints (`src/ui/panels/jobs.ts:123`, `orders.ts:817`, `military.ts:444`), destructive `confirmThen` paths, default No and unsafe-embark confirmation (`src/ui/screens/embark.ts:263`). Stocks was already OK. |

### Repetitive-task table (local row ids)

| Item | Task / commit | State from code | Evidence and remaining scope |
|---|---|---|---|
| R1 craft five | U-03 `42b1f7a` | fixed | `src/ui/panels/orders.ts:245,313,339`: one quantity-selected order. |
| R2 make ten beds | U-03 `42b1f7a` | fixed | Same quantity picker, with once/maintain mode rather than a forced stock threshold. |
| R3 repeat an order | U-03 `42b1f7a` | fixed | `src/ui/panels/orders.ts:184,386,856`: recent recipes and repeat action. |
| R4 build five doors/beds | U-04 `5d9759f` | fixed | `src/ui/panels/build.ts:314,434,468`: drag batch/count and order missing inputs. |
| R5 several rooms | U-07 `0e875a7`, U-01 `cc8c064` | fixed | `src/ui/panels/zones.ts:139,142`, `src/ui/screens/fortress.ts:939`: owner picker and empty-drag message. |
| R6 configure stockpile | U-07 `0e875a7` | fixed | `src/ui/panels/stockpile-editor.ts:144,209,232,238`: dropdown, tree navigation and editable fields through keyboard/mouse. |
| R7 mass labors | U-06 `9d92c17`, U-01 `a8e0a26` | fixed | `src/ui/screens/labor_manager.ts:235,289,316,545`: multi-select templates, readable headers and row scrolling. |
| R8 labor priority | U-06 `9d92c17` | fixed | `src/ui/screens/labor_manager.ts:252`: editable priority row. |
| R9 six squad members | U-06 `9d92c17` | fixed | `src/ui/panels/military.ts:271`, `src/ui/panels/units.ts:97,207`: marked members and marked-unit assignment. |
| R10 multi-select units | U-06 `9d92c17` | fixed | `src/ui/panels/units.ts:97`: mark rows then selection actions. |
| R11 undo stack | Pre-existing `c38d1d8` | open | `src/ui/panels/designate.ts` keeps the single-batch Undo path; the proposed ten-batch stack has no U implementation. |
| R12 typed/decrementable breeding cap | None | open | `src/ui/panels/animals.ts:55,58`: cap still increments by one and wraps modulo 101. |
| R13 forbid/dump item selection | U-03 `42b1f7a` (collision/confirmation repair) | fixed | Existing selection paths retained; Stocks destructive actions use Shift accelerators and confirmations. |
| R14 trade quantities | Pre-existing `4b8ef2f` | fixed | `src/ui/screens/trade_session.ts:105,157,158,194`: +/- quantities, Shift step and Home/End. Already marked good by the audit. |

### Spec-mismatch table (local row ids)

| Item | Task / commit | State from code | Evidence and remaining scope |
|---|---|---|---|
| 7.1 caravan `$` status | None | open | `src/ui/status.ts:36,56`: no caravan status field. |
| 7.2 unit mood/title/rename | U-06 `9d92c17` | fixed | `src/ui/panels/units.ts:85,157,163,177,372`. |
| 7.3 Jobs filters and named reasons | U-01 `0d7199b`,`cc8c064` | partly fixed | `src/ui/panels/jobs.ts:27,127`: named reasons, but list still unfiltered; labor/state/text filter controls absent. |
| 7.4 labor priority and blocked breakdown | U-06 `9d92c17`, U-01 `cc8c064` | fixed | `src/ui/screens/labor_manager.ts:252`, `src/ui/panels/jobs.ts:95`. |
| 7.5 order waiting status | U-03 `42b1f7a`, U-01 `0d7199b` | fixed | `src/ui/panels/orders.ts:625,642,945`: list status and friendly workshop waiting text. |
| 7.6 workshop recipe grouping | U-03 `42b1f7a`, U-01 `a8e0a26` | partly fixed | Picker groups output categories (`src/ui/panels/orders.ts:201`); finished workshop list still uses flat `recipesFor` rows (`orders.ts:924,926`) though its makeability glyph has an alias. |
| 7.7 selected order count | U-03 `42b1f7a` | fixed | `src/ui/panels/orders.ts:845`: count edits; new order uses the reserved-letter-compliant accelerator. |
| 7.8 stockpile fields and links | U-07 `0e875a7` | partly fixed | Editable fields and real dropdown implemented. `src/ui/panels/stockpile-editor.ts:250` displays link count only; no `LinkStockpile`/`UnlinkStockpile` UI emitters. |
| 7.9 military gear dropdown/list | U-01 `a8e0a26`, U-06 `9d92c17` | partly fixed | Squad list includes header (`src/ui/panels/military.ts:443`); gear still cycles via keys/clicks (`military.ts:144,150,525,531`) rather than a dropdown. |
| 7.10 animal training | U-01 `cc8c064` (placeholder removal) | open | Milestone placeholders removed; `src/ui/panels/animals.ts` still has no `TrainAnimal` emitter. |
| 7.11 Harvest | U-01 `a8e0a26` | fixed | `src/ui/panels/designate.ts:153,182`. |
| 7.12 building panel | U-05 `3b06f7b` | fixed | `src/ui/panels/building.ts`: state/modes/links/owners/confirmation-driven deconstruction. |
| 7.13 Ctrl+S | U-01 `0b124b1` | fixed | `src/platform/input.ts:112`, `src/ui/screens/fortress.ts:1118`. |
| 7.14 tooltips and input parity | U-08 `42c623d`, U-07 `0e875a7`, U-06 `9d92c17` | fixed | `src/ui/widgets/label.ts:24,55`, `src/ui/panels/stockpile-editor.ts:144,232`, `src/ui/screens/labor_manager.ts`: tooltip and keyboard/mouse paths for the audit's named examples. This does not claim a fresh audit of every action. |
| 7.15 color-only state | U-01 `a8e0a26`, U-08 `42c623d` | partly fixed | Recipe glyph and ghost glyph repaired. Zone qualification still changes background only (`src/ui/screens/fortress.ts:498`). |
| 7.16 Load thumbnails | Pre-existing `542e51b` | fixed | `src/ui/screens/load.ts:123,132`: conditional thumbnail rendering when the save contains one and space permits. Missing image in the old golden is not evidence of a missing code path. |
| 7.17 keybinding labels | U-01 `a8e0a26`; later T-121 `5bb5581` | fixed | `src/ui/screens/settings.ts:141`: contextual action text; `settings.ts:77` also localizes conflict names. |
| 7.18 fuel/farm hints | U-01 `a8e0a26` | fixed | `src/ui/hints.ts:53,59,112,118`. |
| 7.19 global job hints | None | open | `src/ui/hints.ts` has no mining-disabled/path-blocked global hint; `src/systems/jobs/constants.ts:19` warning remains unused. |

Part 2 must exercise the original section-2 walkthrough on the current build, reassess these draft states against observed behavior, write the immutable dated report, and file its remaining findings. This draft neither files UX findings nor closes T-111.
