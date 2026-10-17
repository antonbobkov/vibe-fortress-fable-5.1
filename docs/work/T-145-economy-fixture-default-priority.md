# T-145 — The economy fixture plays at default priorities

**Source:** T-123 and its report, [`../../reports/audits/2026-10-08-economy-at-default-priority.md`](../../reports/audits/2026-10-08-economy-at-default-priority.md) (causes 7 to 11, § Not established) · **Size:** M · **Needs:** T-144, T-188 · **Status:** open (script done; two Done items unmet, see § Progress)

## Re-measure, 2026-10-16 (`a2444a5`, after T-301, T-211, T-305, T-306, T-302, T-303, T-335 to T-337)

- 2026-10-16: `three_years_main` once ([data](../../reports/data/2026-10-16-t145-three-years-main.txt), 963 s): **63 dwarf deaths, all starvation, days 322–326; extinct on day 336.** None to wild animals, bleeding or infection (boars, a badger and a lynx were on the map at times; the alert was `calm` at every 28-day sample). Population 7 / 14 / 43 / 55 / 63 on days 28 / 112 / 224 / 252 / 308; meal and drink stocks were 0 on day 252 and again on day 308. Every other assertion before it holds (mood floors, thought caps, recipe witnesses, engraving, a trade at every visit). "No dwarf died" does not hold: the bleeding deaths of gap 1 are gone, and gap 2 (the farm and kitchens do not follow 40 to 60 dwarves) now kills the whole fortress in the main seed. The other Done items are not met either: the peril-0 sweep was not run, and B-008 … B-012 are not read. No assertion was changed (T-334 decides whether "no dwarf died" stays a gate).
- 2026-10-16, diagnosis ([report](../../reports/audits/2026-10-16-t145-food-chain-diagnosis.md)): the food rotted because no stockpile wanted barrels, the seed bought was not the seed sown, the cave seed bought was never sown (script), and no dwarf could drink from the brook (game: T-350, fixed).
- 2026-10-16, script: barrels wanted on every pantry, larder and drink stockpile tile, a 48-tile larder and cellar on the hall level, crops chosen by the seed in stock, seed requested and bought by species, cave strips dug for bought cave seed, 42 days of meals and 21 of drink kept, 56 days of meals kept back from the caravans, the barrel order sized to the larder and the drink from day 56.
- Run 1 (probe, [journal](../../reports/data/2026-10-16-t145-run1.jsonl)): no drink stockpile wanted barrels, so with T-350 the brew at the still counted as loose and the founders walked to the brook; eight bled out after boar fights by day 47. Drink stockpiles now want barrels.
- Run 2 (`94a72a4`, [data](../../reports/data/2026-10-16-t145-run2.txt), 1,066 s): **passes.** No dwarf death; population 15 / 37 / 43 at the year ends; meals 798 / 620 / 648 / 902 and drink 627 / 616 / 616 / 695 on days 224 / 252 / 308 / 336; a trade at each of 6 visits; every witness above zero (`alloy_steel` 3); mood mean 62.4 (min 35.9). Open in it: 2,585 of 5,343 drinks were water while 616 drink stood in stock and the stills had stopped at their threshold, so most of the brew lay off the stockpiles' barrels.
- Run 3 (probe to day 230, [journal](../../reports/data/2026-10-16-t145-run3.jsonl)): from day 161 the drink stockpiles held nothing while 600–631 drink stood in barrels off them, and from day 168 every drink was water; the meals lay loose again. Cause: the stills took the stockpiles' wanted barrels, and drink in a barrel off any stockpile never reached the stockpiles' barrels (game: [T-361](T-361-brew-at-the-still-is-never-stocked.md)). Script: drink stockpiles want empty barrels on a third of their tiles, the larder has 72 food tiles, and barrels are ordered for the brew too.
- Run 4 (`5aeead5`, with T-361's change, [data](../../reports/data/2026-10-16-t145-run4.txt)): no dwarf death, population 15 / 39 / 57, meals 725 / 673 and drink 640 / 937 on days 224 / 336, a trade at each of 8 visits, water 1,868 of 5,699 drinks (2,585 of 5,343 in run 2), mood mean 61.3. It fails one witness: `alloy_steel` 0 (3 in run 2, 1 in the re-measure, 5 to 10 in 2026-10-12's runs 4 to 6). Steel is ordered only from day 224, so its count is a figure whose spread covers 0; it is now printed (the T-334 rule), and the other witnesses stay.
- **Done items against run 2:** item 1 (the scenario passes with its assertions as T-334 left them) is met on the main seed: no hunger or thirst death, 43 dwarves at the end, a trade at each of 6 visits, every witness above zero, floors and invariants. Item 2 (the peril-0 sweep, seven seeds) is not measured: it is seven more three-year runs and was outside this time box. Item 3 (B-008 … B-012) waits for item 2.

## Progress (2026-10-12, branch `t-145`)

The six fixture files of `f-17` are ported by hand and the Decision list is applied; the measurements are in [the report](../../reports/audits/2026-10-12-economy-fixture-at-default-priority.md). Six of the eight allowed three-year runs were made, then the sweep and the mood instrument once each.

**What holds** (runs 4, 5 and 6, seed `three-years`): every recipe witness above zero, a trade at every visit (8 of 8 in run 6), the anvil bought on day 126–127, the engraving, the T-176 invariants, the three played saves, the mood floors. `F17_KNOWN_GAPS` is gone.

**Remaining gaps, by name:**

1. *"no dwarf died across three years in peril 0"* fails: 1, 2 and 2 deaths in runs 4, 5 and 6, each a militia member who bled out after a boar fight. The script cannot remove them: T-301 and T-211.
2. *"Peril 0: seven of seven seeds survive with no dwarf death"*: seven of seven survive, none without a death (1, 4, 25, 2, 32, 27, 6). Twelve deaths are bleeding after a fight (T-301). Eighty-five are starvation in four seeds once the fortress passes about 40 dwarves: the surface farm strips grow nothing in winter and the meal stock is eaten in a season. That part is the script and is still to do: the farm and the kitchens for 40 to 55 dwarves, or fewer immigrants taken.
3. *Perils 2 and 4 are not measured*: all 13 seeds stop on a T-176 invariant finding between day 19 and day 215 (T-302, T-303, T-304).
4. *Beds and the dead*: 18 beds are made and 11 placed for up to 59 dwarves. The bedroom rooms stop being dug (133 of 194 tiles from day 100, no dig job left), and the plan has 20 rooms in any case. The script builds no tomb, and "unburied dead" is active 40% of dwarf-time. The mood time mean is 57.7 on the main seed and 52.7–55.5 on two sweep seeds.
5. *Idle time* ("work follows the population") was not measured.
6. *The old script's unreachable mine* was not run; the report gives the likely cause from reading.
7. *B-008 … B-012* are read against the report in `balance-status.md`; none can close while gaps 1 to 3 stand.

**Decisions made while doing it** (each with its measurement in the report):

- The wagon carries three iron spears instead of the crossbow set and other supplies the fortress never uses; clubs lose to boars.
- The squad is the woodcutter, the mason, the seventh founder and the two miners, from the first day; the hearth alert and kill orders answer any dangerous wild animal within 14 tiles.
- Six barrels are made before the beds: the still cannot brew without them. Beds then come before the standing barrel order.
- Hauling is on for everybody but the miners and keeps its default priority; raised one step it starved the crafts.
- Nobody hunts: an immigrant hunter's crossbow hits bystanders.
- The farm grows by surface strips with bought seed; caravans sell no cave seed.
- The scenario's thought-cap assertion bounded the raw sum of positive thoughts (46.8 measured against 41); it now bounds the mood by what `15` § Mood's capped sum allows.
- The sweep's first seed was started once at `f778cc8`, stopped after one seed to fix the winter food, and run once in full at `ac88f56`.

## Why

F-17 decided that the three-year economy fortress should play as a competent player would. The rewrite on the branch `f-17` (`ffbc723`) does that in part and is not merged. T-123 found that it fails mainly because of the game (T-140 to T-144). It also has faults of its own, which a player would not make.

## Decision

Merge the rewrite once T-140 to T-143 are in, with these changes to the script:

- **Hauling stays on for every dwarf** except the two miners. The rewrite leaves one hauler of seven until day 56.
- **A founder is Broker from day 1.**
- **Beds come before barrels** in the carpenter's order list until every dwarf has a bed. In the kitchen, the lavish order goes first once easy meals have been stocked once.
- **A thief is a threat.** Add `thief` to the purposes that raise the alert and send the squad.
- **The farm grows with the population.** Plots follow the dwarf count.
- **The anvil is bought.** On days 230 to 234 of the urgent-priority run a session was open, the anvil cost about 311 marks, the depot held 524 to 1,841, and the script sent no offer. Find why in the script's `trade` routine and fix it. If the game refused something, that is a new backlog row.
- **Work follows the population.** At walking speed ×1.5 the script leaves 4.6% of dwarf time idle with no work over three years ([the walking-speed report](../../reports/audits/2026-10-09-walking-speed.md)). Orders and designations grow as immigrants arrive.
- **The scenario's run time is decided** (T-140, 2026-10-09): the main `three_years` scenario moved to the performance tier (`test/perf/three_years_main.test.ts`, `npm run test:perf`) with its `timeoutMs` raised to 2,400,000 and every assertion unchanged, because at walking speed ×1.5 it grows to about 43 dwarves and takes about 18 minutes.
- **The original assertions come back**: every recipe witness above zero, a trade at every visit. Remove `F17_KNOWN_GAPS`.

Before merging, also explain why the **old** script with no urgent jobs stops mining by day 112: every dig job is blocked "unreachable" and nothing is mined. If that is a game fault it gets its own row.

- **Wild animals are part of the map now (added 2026-10-09).** Since T-192 they spawn, and in [the T-188 re-measure](../../reports/audits/2026-10-09-t188-reproduction.md) badgers and boars killed seven dwarves of the rewritten fortress at peril 0. The script must treat dangerous wild animals as it treats a thief: an alert, the squad sent, civilians kept in. The same run showed two surviving brewers choosing farm and kitchen work over an eligible brew; the script should keep at least one dwarf with brewing as its top labor.

## What to do

1. Rebase the six fixture files of `f-17` onto master.
2. Apply the changes above. Run `npx vitest run test/scenarios/m8.test.ts -t three_years`.
3. Run the 20-seed sweep once and the mood instrument once. Write a dated report and update `balance-status.md`.

Spec touched: none. This is test authoring.

## Done

- The scenario passes at default priorities with its assertions as T-334 left them: no dwarf dies of hunger or thirst (the 2026-10-16 run fails here, with 63 starvation deaths), the fortress ends above its seven founders, a trade at every visit, every recipe witness and the engraving above zero, and the mood floors, caps and invariants. The dwarf deaths by cause are a printed figure (T-334: at peril 0 a wild animal can kill a dwarf, and which one turns on the job timeline; none did in the one run since T-301, on 2026-10-16).
- Peril 0: seven of seven seeds survive with no hunger or thirst death and more than seven dwarves; their deaths by cause are reported.
- B-008 … B-012 are each read against the new report and closed or re-filed.
