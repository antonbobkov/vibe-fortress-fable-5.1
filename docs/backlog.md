# Backlog

Every open item, and nothing else. A row is added when an item is accepted and deleted in the commit that closes it; git is the history. How to pick up, work and close an item is in [`process/agent-workflow.md`](process/agent-workflow.md).

- **Id.** New items take the next free `T-1nn`. The older ids below (`U-`, `F-`, `C-`, `B-`) keep theirs until they close; nothing new gets one.
- **Source.** The audit, report or plan that produced the item. An item without a source is not accepted.
- **Needs.** Items that must be closed first. "—" means it can start now.
- **Status.** `open`, `in progress (who or which branch)`, or `blocked (why)`.

**Who has what (2026-10-11).** The cloud agent ([`../agents/cloud-agent.md`](../agents/cloud-agent.md)) stopped on 2026-10-11 after closing T-111, T-196, T-144, T-197, T-198, T-199 and T-212; its log is [`../reports/cloud-agent-log.md`](../reports/cloud-agent-log.md). Everything open is the local orchestrator's again.

| Id | Title | Source | Needs | Status |
|---|---|---|---|---|
| T-453 | [A river that ends in a far lake can lie beyond the drink search from the wagon](work/T-453-lake-beyond-the-drink-search.md) | T-449's measurements | — | open |
| T-456 | [The `three_years` scenario does not yet play on relief](work/T-456-three-years-main-on-relief.md) | T-451's sweep | — | open |
| T-464 | [A whole fortress dies to one cave crawler without striking it](work/T-464-fortress-never-strikes-a-monster.md) | T-461's journal | — | open |
| T-465 | [A seeking cavern monster stands still until a dwarf comes near](work/T-465-cavern-seek-stands-still.md) | T-461's journal | — | open |
| T-466 | [The hand-laid defence of `defence_year` does not repel a raid](work/T-466-defence-never-repels-a-raid.md) | T-462's defence_year seeds | — | open |
| T-469 | [Runecraft 2: the rune tank, the sanctum, attunement and mishaps](work/T-469-runecraft-sanctum-attunement.md) | Runecraft design | T-468 | blocked (needs T-468) |
| T-470 | [Runecraft 3: the runeforge, wands and staffs, emberbolt and frostbind](work/T-470-runecraft-runeforge-staffs-bolts.md) | Runecraft design | T-469 | blocked (needs T-469) |
| T-471 | [Runecraft 4: setting stones, enchanted items and their value](work/T-471-runecraft-setting-stones.md) | Runecraft design | T-470 | blocked (needs T-470) |
| T-472 | [Runecraft 5: enchantments act in combat](work/T-472-runecraft-enchants-in-combat.md) | Runecraft design | T-471, T-473 | blocked (needs T-471, T-473) |
| T-473 | [Runecraft 6: ward, mend, dread, daze, firebloom and vials](work/T-473-runecraft-remaining-spells.md) | Runecraft design | T-470 | blocked (needs T-470) |
| T-474 | [Runecraft 7: draughts](work/T-474-runecraft-draughts.md) | Runecraft design | T-473 | blocked (needs T-473) |
| T-475 | [Runecraft 8: Call and the three summons](work/T-475-runecraft-summons.md) | Runecraft design | T-473 | blocked (needs T-473) |
| T-476 | [Runecraft 9: rare materials, deepsilver pressure and the legend](work/T-476-runecraft-deep-materials-hexers.md) | Runecraft design | T-472, T-474 | blocked (needs T-472, T-474) |
| T-477 | [Runecraft 10: the whole loop played, and the docs that tell it](work/T-477-runecraft-whole-loop-scenario.md) | Runecraft design | T-475, T-476, T-479 | blocked (needs T-475, T-476, T-479) |
| T-479 | [Runecraft 9b: Gloam hexers in raids and sieges](work/T-479-runecraft-hexers.md) | Runecraft design | T-473 | blocked (needs T-473) |
| T-480 | [The hunter hint reads the labor bitset as if it were bytes per labor](work/T-480-hunter-hint-labor-bit.md) | T-478's work | — | open |

The latest balance evidence is in [balance-status.md](balance-status.md). Walking speed is ×1.5 since T-140's measurement. Of B-008 to B-012, read against T-145's peril-0 sweep (2026-10-17): B-009, B-011 and B-012 are closed; B-008 (year-1 wealth above the model) is T-380 and B-010 (raid sizes at peril 2) is T-381. Their older measurement journal is in the [decision archive](archive/decisions-archive.md).
