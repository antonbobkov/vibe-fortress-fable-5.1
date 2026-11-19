# Audit: a new player's first year

**Task:** T-618 · **Date:** 2026-11-18 · **Commit examined:** master `493d7635`, and the T-618 branch for the fixes · **Kind:** a UI and UX pass played as a new player, with the small fixes · **Source:** [the T-618 work file](../../docs/work/T-618-first-year-ux.md), after [T-605's first hour](2026-11-18-t605-first-hour-ux.md)

## The answer

- **No fortress of the audit lived to see autumn.** The starting food is meals and raw food that rot in 6 to 20 days. In the Balanced fortress it was gone by Spring 14; dwarves were "starving" from Summer 11 and three were dead by Summer 21. A testing fortress, with ten times the food, fell on Summer 23 with every dwarf starved. Nothing on screen says food rots until it is refuse, and the rotten stockpile then fills the log with "Miasma spreads" (findings 1–3; a first hint is added here, the rest filed). So the first winter and the judging of the Thane's first whim could not be reached in play.
- **The military can be set up without a weapon and nothing says so.** The Balanced loadout's axe is a tool and its crossbow the hunter's, so the first squad trained unarmed; no panel shows what a soldier holds, and the creature inspector shows no needs, equipment or profession at all (4–7, filed).
- **The first caravan cannot reach a depot across the river, and is said to be waiting "for a trade depot"** that stands built (8–11, filed). Trading itself works once it arrives.
- **The Hearth alert, which the predator hint asks for on Spring 3, stops all work when there is no shelter yet,** and a squad set to Train with no barracks trains nothing, without a word (12–15, filed).
- **Ten small ones are fixed here**, among them content ids in log lines ("A glow_beetle has arrived.", "from hillfolk"), a wounded dwarf "admitted to the hospital" when there is none, the previous fortress's log and finished orders appearing in a new one, an order picker that silently switched recipes and placed four wrong orders, and a raw float in the health lines (25–34).
- The hospital and medic flow reads well ("Care: bone setting by Hrolf Stonehold."), and the trade session works by keyboard.

## How it was examined

A Vite dev server in test mode and a headless Chromium at 1280 × 800 (80 × 50 cells), driven by small Playwright scripts through the real keyboard and mouse as the e2e tests drive them; the screen's text came from the test hook (`window.__deepholm.text()`) and the pictures from Playwright. Time was passed with the hook's `step`, a few hundred ticks at a time.

1. **A Balanced fortress** (world `t618-year`, Mossrun: temperate forest, river, peril 0, temper 0), from embark to Summer 21 of year 1: a stair shaft and two dug levels, workshops (carpenter, still, mason, craftsdwarf, kitchen), stockpiles with presets, a farm plot, a hearth hall, a barracks, a squad of three with training, the Hearth alert, chopping and gathering, a fishing zone, work orders, a trade depot, a bridge, the first caravan and a trade, the first immigrants, the Thane's first whim, a wounded dwarf (a wound applied through the hook, `DamageDealt`), the menu save, the Load screen and a quick load.
2. **Two testing fortresses** (the Testing preset at Cloudhowe, temperate hills) for the military with gear, a hospital with a medic treating a wound applied through the hook, the Making Do things (kiln, candle stand, straw pallet, stone bed, the pot and brick recipes), a kill order, and a long run toward winter. The second was given 600 cured meat beside the wagon through the hook (`services.spawn.item`) to last the run; it starved on the same day as the first, which was not investigated further (finding 1).

The screenshots (named below, `NN-name.png`) were kept outside the repository. Severity: **blocks** (the player cannot get the thing done without knowledge the game does not give), **confuses** (the player is misled or stuck for a while), **polish**.

## Findings

| # | Where | What a new player sees | Why it confuses | Severity | Suggested fix | Shot | Outcome |
|---|---|---|---|---|---|---|---|
| 1 | Food, stocks, the log | Balanced: food 51 on Spring 16, 16 on Summer 11, 1 on Summer 20; "! Ivar Coaleye is starving." from Summer 19; deaths from Summer 21. Testing: 214 units of `rotten food` (turnips, dimcaps) in Stocks by Spring 28, the fortress fallen on Summer 23. The Stocks panel and Look show no rot; the food hint (Spring 14) says nothing of rot | Meals keep 14 days, raw plants 20, raw meat 6; barrels in a food stockpile slow it four times (13 § Rot), cooking, smoking and salting keep it. None of this is on screen until the food is refuse | blocks | Rot stage and days in Stocks and Look; an alert before food rots; a first hint (added); the Balanced food as an owner question | 40-death, 38-wounded-look | Hint fixed (`hint_rot`); rest filed: T-621-food-rot-unseen |
| 2 | Log | "! Miasma spreads. ×9" (Spring 8, again later) with a focus on the surface | It comes from the rotting food in the indoor stockpile; the line names neither the cause nor the place | confuses | Name the rotting thing and the zone | 21-miasma | Filed with 1 |
| 3 | Log › Alerts | One "! X is starving." line per dwarf per day: the Alerts tab is nothing else for a week | The deaths and the caravan drown in it | confuses | One line a day naming the starving | 40-death | Filed with 1 |
| 4 | Military, Balanced | A squad of three on Train, ranged on: a day later all three hold nothing. The panel lists members and preferences only | The Balanced axe is a tool and the crossbow is the hunter's; there is no weapon to claim, and no panel says a soldier is unarmed. (Balanced bringing no spear while the hints say iron spears is T-605 finding 29, an open owner decision.) | blocks | "Armed 0 of 3 · no spear in stock" on the squad | 26-weapon-list, 27-stocks-weapon | Filed: T-622-soldier-gear-and-dwarf-inspector |
| 5 | Military › weapon, armor lists | "any (current), axe, bow, mace, crossbow, …" | No count in stock; "axe" is offered while the fortress's axe is a tool no soldier takes | confuses | Count in stock per class | 26-weapon-list | Filed with 4 |
| 6 | Military › [S-a] add | "Add: 0 marked, 6 free", names only | Who is good at fighting? "6 free" counts places, not dwarves | polish | Best combat skill per row | 25-add-list | Filed with 4 |
| 7 | Look › a dwarf | Activity, skills, mood and thoughts, health | No needs (hunger, thirst, rest), profession, equipment, title or friends, all of which 10 § UI and the wireframe list; a player cannot see why a dwarf is hungry or what a soldier carries | confuses | The inspector's missing sections | 38-wounded-look, 46-patient-care | Filed with 4 |
| 8 | Log, depot, Civilizations | "! The hillfolk caravan waits at the edge for a trade depot." with a depot built 17 days before; `[S-t]`: "The Hillfolk caravan has not reached the depot yet." | The depot is on the east bank; the Hillfolk come from the west edge, across the river. The line asks for what exists and says nothing of the way | blocks | Name the depot, the edge and why; focus the depot | 32-civs-caravan, 33-depot-click | Filed: T-623-caravan-depot-unreachable |
| 9 | Build › Constructions › Floor | "Floor ×4 placed, 4 tiles skipped: needs a floor or supported open space", then one tile a drag | A bridge must be planned again after each tile is built | confuses | Plan a span held by planned neighbours | 34-bridge | Filed with 8 |
| 10 | Log, depot panel | No line when the caravan reaches the depot; the depot lists "1 barley straw" eleven times | The player must watch the `$`; the list is unreadable | polish | A note at the depot; group the rows | 35-depot-move | Filed with 8 |
| 11 | Trade session | "40 dungs", "50 flours", "70 salts"; "Broker: Torgeir Grimfoot" with no Broker named | Mass nouns; the line names a title nobody holds | polish | `plural` values in `items.md`; "Broker: none (… trades)" | 36-trade-session | Filed with 8 |
| 12 | Military, Spring 4 | `[3]` Hearth with no hall, hearth or door: all seven dwarves stand at the wagon, outdoors, "Idle"; 600 ticks dig nothing | 19's retreat finds no shelter; work stops and nobody is safer; nothing says so | confuses | "No shelter: … wait at the wagon" on the alert line; "Sheltering" activity | 11-hearth-no-hearth | Filed: T-624-alert-and-training-feedback |
| 13 | Log, Spring 3 | "☼ A beast that hunts dwarves is near. [m] then [3] raises the Hearth alert …" | It asks for the alert before there can be a shelter (12) | confuses | Say "once your hall has a door" while there is none | 08-log-predator | Filed with 12 |
| 14 | Military, Train | "Mode: train", "No barracks [S-b] assign" in the normal colour; soldiers "On duty", no training. After a barracks is zoned the line stays "No barracks" until a tick | Train needs a barracks (16) and the panel does not say so | confuses | The warning in the alert colour; read the zone at once | 24-new-squad | Filed with 12 |
| 15 | Units, hover line | "hunger", "thirst", "sleep", "social" beside "Dig" and "Craft (recipe)"; hover "No job" where Units says "Idle" | Need names read as states, not activities; a placeholder in a job name; two words for one thing | polish | Verbs ("Eating"); the recipe's name; one word | 29-units-whim | Filed with 12 |
| 16 | Log, legend | "!! Ivar Coaleye has died." | The event carries the cause (`bled_out`, `starvation`); 17's own example is "has bled to death" | confuses | A line per cause | 40-death | Filed: T-625-log-lines-that-explain |
| 17 | Log, Units | "! 3 dwarves have come to join the hall." | Who, and what can they do? Units shows no profession and Look none either | polish | Names with best skill | 30-labors-immigrants | Filed with 16 |
| 18 | Log, Threats, Spring 8 | "! A cavern has been breached." while digging a store two levels below the surface; the view centres on the cavern with nothing marked; "!4" stays on the status row | Where is the opening, and what now? | confuses | A first hint (added); mark the breach tile | 22-breach, 23-threats-breach | Hint fixed (`hint_breach`); rest filed with 16 |
| 19 | Log panel | Reopened a fortnight later, it shows the entry chosen then at the top, with every newer line above the window | The player sees old news first | polish | Open on the newest unless chosen since | — | Filed with 16 |
| 20 | Mood panel | "+5 Had a fi", "-4 Slept un" | Cut to ten letters with no `»`, where the wireframe wraps two rows | polish | Wrap or mark | 28-mood | Filed with 16 |
| 21 | Units, the Thane line | "The Thane wishes for fine meals for everyone: not yet" | "Everyone" is 20 fine meals; no count, no progress | confuses | "20 fine meals (3 in stock)" | 29-units-whim | Filed: T-626-whims-and-making-do-say-how |
| 22 | Build › Furniture › Straw pallet | "Straw pallet 3 fibers (0)"; placed: "0 fibers in stock: 1 will wait · build a farmer's workshop" while barley straw and reeds are in stock | The pallet takes fiber, straw or reed, and the hint says to build it from straw (T-605 finding 19, for the pallet the hint recommends) | confuses | Count and name every alternative | — | Filed with 21 |
| 23 | Candle stand, Add order | "Candles: 0 of 5", "No candle: dark"; "○ Tallow candles" with no reason | Where do candles come from? | polish | Name the workshop and input | 47-candle-stand | Filed with 21 |
| 24 | Add order | "Easy meal · no kitchen" with a kitchen placed and not yet built | Reads as if the placement failed | polish | "· kitchen not built yet" | — | Filed with 21 |
| 25 | Log | "A glow_beetle has arrived. ×6", "! A caravan has arrived from hillfolk.", "! The hillfolk caravan waits …", "A trade with hillfolk is complete." | Content ids in lines; the event's raw field was never replaced by the name | polish | Name species, plants and civilizations | — | **Fixed** |
| 26 | Civilizations | "Last brought: leather_piece, goa»" (32 entries, ids, repeats) | Content ids | polish | Names, each kind once with its count | 32-civs-caravan | **Fixed** |
| 27 | Trade session footer | "+14.95%: 0 ☼" after the first trade | A raw percentage | polish | Whole number | 37-trade-offer | **Fixed** |
| 28 | Log, Look | "Ivar Coaleye has been admitted to the hospital." while Look says "Care: no hospital. Make one in Zones [z] > Hospital." | The note names a hospital that does not exist | confuses | "… is wounded and needs care." | 38-wounded-look | **Fixed** |
| 29 | Orders › Finished | "x12 Table · done" for an order of 2 tables | The count of an earlier order, removed before it ran, was kept and given to the next table order | confuses | Forget a removed order | 18-orders | **Fixed** |
| 30 | Orders › Add order | Typing "blo" highlights "Brew draught of wyrmblood · no laboratory" (its category sorts first) over "Blocks"; `Backspace`, which edits Find, keeps the highlight's position on a new list. The audit placed "x12 Table" and three "Wooden bolts" orders meaning blocks, doors, beds and drink | The highlight jumps to another recipe with no sign but the `Where` line | confuses | Highlight the first recipe of the best rank on each filter change | 20-find-backspace, 18-orders | **Fixed** |
| 31 | A new fortress | After Main menu › New world, the new fortress's log holds the last one's deaths and starving lines, and Orders shows its finished orders and Recent recipes | The log and the order panel's memory were never cleared between fortresses | confuses | Clear them on a new or loaded fortress | 43-stale-log | **Fixed** |
| 32 | Look › health | "torso ▓▓▓░░ 40.80000000000001/»" and four "light wasting" lines | Wasting takes fractions of a hit point | polish | Whole numbers (fixed); group the wasting lines (report only) | — | **Fixed** (the number) |
| 33 | Zones › a room | "Not enclosed: 1 open border tiles" | Plural | polish | `{n\|tile\|tiles}` | 17-hearth | **Fixed** |
| 34 | Trade session | "3 leather bootss", "3 wool cloth bootss" | A name ending in s took another | polish | A name ending in s is its own plural | 36-trade-session | **Fixed** |
| 35 | Designate, the first stairs | "Stairs: 6 designated · no dwarf can reach it yet: open a side or a stair above." for a shaft on the far bank of a river | The reason is the water; the advice is for rock | polish | Name water when a walker label is cut by it | 04-stairs | Report only |
| 36 | Designate › `Ctrl+Z` | Three undos, no message; the fourth says "Nothing to undo." | Did it work? | polish | "Undone: Dig, 81 tiles." | — | Report only |
| 37 | Zones › farm plot | `[S-a] all seasons` on barley sets Spring and Summer, and a red note says summer barley cannot ripen; "[ barley ▼ ]10 see»" | The tool chose a season it then warns about; the seed count is cut | polish | Skip seasons whose crop cannot ripen; fit the count | 16-crop-list | Report only |
| 38 | Zones › a hearth hall | "Needs the hearth inside" | Which building, and where to find it (Build › Special)? | polish | "Needs a hearth: [b] Special" | 17-hearth | Report only |
| 39 | Zones › Fishing | Made on the bank three levels above the water ("51 left out: 51 not beside deep water"); its fish job waits "no path"; the inspector is empty | The zone is accepted where no dwarf can fish | confuses | Count reachability of the water's edge; say who fishes | — | Report only |
| 40 | Jobs | "hunt deer · no path" eight rows | Not batched like digs | polish | Batch jobs of one type and reason | — | Report only |
| 41 | Threats, Population | "Wealth and population draw atten»", "Eligible: no · hall spirit below»" | Cut lines in panels with room to wrap | polish | Wrap | 09-threats | Report only |
| 42 | Military | "Members Torgeir G., Asa F., Liv »"; a kill order clicked on an empty tile says "Click a creature to attack" where `Enter` says "No creature there." | Cut members; two wordings | polish | Wrap; one wording | 44-squad-testing | Report only |
| 43 | Log | "Torgeir Grimfoot is now the thane." | A title in lower case | polish | "the Thane" | — | Report only |
| 44 | Load screen, `F9` | Eleven identical "Embergate · Day … " Manual rows from `F5`; "Load the quick save?" names no date | T-605 finding 23 grows with every quick save | polish | One quick-save row, marked; the date in the question | 42-load-screen | Report only |
| 45 | Status row 1 | "≡ overcast 19°C … z 23 ║      [Esc]  [?] help" | `[Esc] menu` is shortened with six cells free | polish | Shorten only when needed | — | Report only |

## What changed on the branch

Findings 25–34 are fixed, and first hints for findings 1 and 18, with their tests in `test/unit/ui/t618-first-year.test.ts`:

- **Names in log lines:** an event's species or plant id reads as its name, and a civilization as the panels name it, "Hillfolk", after "the" in the three lines that want it ("A caravan has arrived from the Hillfolk.").
- **Last brought:** each kind once by name, with its count ("leather ×2, goat, dung").
- **Trade footer:** the margin is a whole number.
- **A wounded dwarf:** "Ivar Coaleye is wounded and needs care.", which names no hospital.
- **Finished orders:** a removed order is forgotten, so the next order of its recipe finishes with its own count.
- **Add order:** each change to the filter highlights the first listed recipe of the best rank.
- **A new or loaded fortress:** the log and the orders panel's finished and recent rows start empty (the loaded log with its saved lines).
- **Look:** a body part's hit points are whole numbers.
- **Plurals:** "1 open border tile"; a name ending in s is its own plural.
- **Two hints:** `hint_rot` when the first food item turns stale ("Food rots: meals and raw food keep two or three weeks. …") and `hint_breach` on the first cavern breach.

## Filed

Six work files, most severe first: `T-621-food-rot-unseen` (1–3), `T-622-soldier-gear-and-dwarf-inspector` (4–7), `T-623-caravan-depot-unreachable` (8–11), `T-624-alert-and-training-feedback` (12–15), `T-625-log-lines-that-explain` (16–20), `T-626-whims-and-making-do-say-how` (21–24). Findings 35–45 stay in this report.

## Not reached

The first winter and the judging of the first whim: every fortress starved in its first summer (finding 1). Winter was seen only in its hint ("Winter comes in 60 days …") and the farm plot's cold note. The second immigrant wave did not come (hall spirit below Content, which the Population panel said, cut, as "Eligible: no · hall spirit below»"). Work orders were followed for a season only in the Balanced fortress (blocks, doors, beds, brew, meals, barrels).
