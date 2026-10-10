# T-196 — Wild predators kill civilians outside the walls, and livestock starve on pasture

**Source:** T-151 (Gemini, 2026-10-10) and the T-188 re-measure ([`2026-10-09-t188-reproduction.md`](../../reports/audits/2026-10-09-t188-reproduction.md)) · **Size:** M · **Needs:** — · **Status:** open

**Who:** a measurement and a decision first, by a strong model. Not Gemini.

## Why

Wild animals have spawned only since T-192 (2026-10-09). Nothing in the game's balance was ever measured with them present. Two runs since then:

- **`defence_year`, temperate forest, peril 2:** five civilians bled to death to wolves and a bear between days 41 and 55, while working outside under a `calm` alert. A cow and two sheep starved on day 56.
- **The rewritten economy fortress at peril 0:** seven dwarves died to badgers and boars.

The full-year browser playthrough met 8 wolves and 4 lynx in its year and lost nobody, so it is not every map. All of these are single runs, reported by other tasks in passing.

## Questions to answer, by measurement

1. **How dangerous is the wild, by biome and savagery?** Over a year on several seeds: arrivals by species, attacks on dwarves, deaths, and what the dwarves were doing. Compare with what [`08-animals-and-domestication.md`](../02-systems/08-animals-and-domestication.md) (wild behavior, aggression) and [`balance.md`](../03-content/balance.md) intend. `balance.md` has no figure for deaths to wildlife; say what it should be for a peril-0 map without the `serene` trait, and with it.
2. **Do the rules work?** Does a predator attack only when the spec says (hunger, proximity, provocation)? Do civilians see it coming and flee (10, 16)? Does the alert rise? Does a hunter or the squad respond? A badger killing a dwarf suggests either very weak civilians or a rule that makes small animals fight to the death.
3. **Why did the livestock starve?** Wild grazers eating the pasture (allowed by 08: a zone is not a fence), too small a pasture in the fixture, or a fault.

## What to do

Write a dated report with the measurements, classify each finding as GAME, BALANCE or FIXTURE, and file a row for each one worth doing, with a proposed resolution. Change no code in this task.

## Done

- **Capture pass (2026-10-10):** measurements recorded across experiments A–E on three seeds in [`2026-10-10-wildlife-capture.md`](../../reports/data/2026-10-10-wildlife-capture.md) and [`2026-10-10-wildlife-capture.json`](../../reports/data/2026-10-10-wildlife-capture.json).
- The report exists; each finding carries its evidence and its class.
- The follow-up rows are in the backlog.

## Decisions (2026-10-10, Opus on `cloud/T-196`)

The owner's brief of 2026-10-10 widened this task: after the report, fix what is a fault and write the missing rules, each with a failing test first. "Change no code in this task" above is superseded. The report is [`2026-10-10-wild-animals-and-civilians.md`](../../reports/audits/2026-10-10-wild-animals-and-civilians.md); its probes and data are under `reports/data/2026-10-10-t196-probe-*`.

1. **An attacking animal stops when its target dies (fault, 08).** The specification already says so; the code took the nearest other dwarf in sight. A hungry hunter's kill ends its hunger, as 08 says ("stop hunting after a kill").
2. **A defending animal breaks off (fault against "flees" in 08; the distance is new spec text).** An animal that attacked because a dwarf came within its provoke radius follows its target no farther than that radius from the tile where the attack began, and leaves alone a target that is unconscious; then it wanders, which ignores dwarves until the wander ends. Reason: the specification says the attack ends when the target flees, and a territory is the place, not the animal. A hungry hunter is not limited: 08 makes it hunt dwarves on purpose.
3. **A kill order reaches a target out of perception (fault, 16).** A soldier whose kill target is out of perception walks toward it. Reason: 16 says kill orders execute until the target dies; the code dropped the target every tick it was beyond 14 tiles.
4. **A light wound stops bleeding by itself (missing rule, 17).** Serious and grievous wounds still bleed until bandaged. Reason: an unbandaged light cut killed in 2,500 ticks, so every bite was a death without cloth and a medic, which `balance.md` § Combat pace does not intend ("a hospital visit"). The value is set by measurement.
5. **No automatic alert (by design, 16 § Alerts).** Kept: the alert is the player's choice; the first attack is an alert announcement and a death pauses.
6. **Civilians keep fleeing (by design, 10).** No fight-back rule unless the measurement after decisions 1–4 shows civilians still dying in the open.
7. **Livestock**: the fixture's pasture is below 08's capacity rule, and that rule is not sustainable against 07's regrowth. Filed as a new row; not changed here (balance of another system, fixture owned by another task).
8. **Fixtures**: no fixture on this branch names T-196 as a "no wildlife" stopgap (`grep -rn T-196 test/` is empty at `26b6b86`), so none is restored here; `year_one` on `t-144` is not this branch's.
