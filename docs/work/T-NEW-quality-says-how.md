# T-NEW — The screen says how quality is made, and the workshop's worker is chosen by skill

**Source:** playtest 9 ([report](../../reports/data/2026-11-26-playtest-9.md), finding 3) · **Size:** S · **Needs:** — · **Status:** open

## Why

Quality follows one rule: `skill × 5 + rng.int(0, 40)`. Fine starts at 55, superior at 75, exceptional at 90 and masterwork at 105, so masterwork is impossible below level 13 (12 § Quality). The game never tells the player this rule:

- **No hint, help line or panel text mentions it.** The only strings that name "masterwork" are the quality words and three thoughts. `hints.json` has no row about quality, statues or engraving.
- **The skill line does not say what a level makes.** A dwarf's view reads "Crafting 6 (Competent) ▓▓░░░" ([03-crafter-view.png](../../reports/data/2026-11-26-playtest-9/03-crafter-view.png)). Nothing says that a Competent crafter makes common and fine goods, or that a masterwork needs Talented (13).
- **The workshop's [w] cycles blind.** It steps to the next dwarf with a labor the workshop uses, in list order, with no skill shown (`nextWorker`, `ui/panels/orders.ts:814-825`). Each press also cancels the current job (12 § Operation). In playtest 7's Year 7 fortress (80 dwarves), one press replaced the best crafter, Runa Stormhold (crafting 8), with Kettil Frosthammer, a soldier. In fortress A it replaced Frode Brightward (crafting 7) with Steinn Bronzecloak ([07-worker-key-cycles-blind.png](../../reports/data/2026-11-26-playtest-9/07-worker-key-cycles-blind.png)). Finding the best crafter means pressing [w] through up to 80 names, without seeing their skill.
- **Engraving trains a craft too, unseen.** The `engrave` job uses the `crafts` labor (`jobTypes.json`), so a dedicated crafter also takes engraving jobs. In fortress A the crafter rose from engraving 0 to 3 in 15 days while his crafting stood still.

## What to do

Decisions taken here:

- **The skill line names what it makes.** In a dwarf's view, a skill whose recipes have quality shows its best tier and its chance of the next one: "Crafting 6 (Competent) · fine 2 in 5" (rolls 30–70: fine from 55). At 13 and above it reads "masterwork 1 in N".
- **[w] opens a picker,** as the sanctum's apprentice picker does. It lists the dwarves with the workshop's labor, sorted by the workshop's skill, as "Frode Brightward · Crafting 8 · Thane". The first row is "Anyone". It shows where each dwarf is busy (squad, title). Choosing cancels the job as before.
- **A hint the first time a fine or better item is made:** "{dwarf} made a fine {item}. Quality comes from skill: a dwarf who works one craft gets better at it, and from Talented (13) can make a masterwork. Give a workshop one worker [w]." (`hint_quality`.)
- **A masterwork engraving is told.** An engraving rolls quality like an item (03, `terrain/producer.ts:358`), but only `ItemCrafted` emits `MasterworkCreated` (`workshops/operate.ts:1093`). An engraver who rolls a masterwork gets no thought and no line. Engraving needs no input, so it is the likeliest first masterwork. It emits `MasterworkCreated` with the tile, gives `made_masterwork`, and is announced: "Olav Amberhand has engraved a masterwork in Hearth hall #1."
- 03 § Digging, which says engraving needs an `engraving` labor, is corrected: it uses `crafts`, as `skills-and-professions.md` already says.

## Done

- [ ] The skill line's tier text; a UI test at levels 0, 6 and 13.
- [ ] The worker picker, sorted by skill; a UI test.
- [ ] `hint_quality` with its trigger; `ui-keymap-and-screens.md` § Hints and row-order updated.
- [ ] The engraved masterwork's event, thought and line; a test.
- [ ] 03 § Digging labor wording; 24 § Panels and `panels.md` § Workshop updated.
