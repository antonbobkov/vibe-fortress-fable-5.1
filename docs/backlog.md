# Backlog

Every open item, and nothing else. A row is added when an item is accepted and deleted in the commit that closes it; git is the history. How to pick up, work and close an item is in [`process/agent-workflow.md`](process/agent-workflow.md).

- **Id.** New items take the next free `T-1nn`. The older ids below (`U-`, `F-`, `C-`, `B-`) keep theirs until they close; nothing new gets one.
- **Source.** The audit, report or plan that produced the item. An item without a source is not accepted.
- **Needs.** Items that must be closed first. "—" means it can start now.
- **Status.** `open`, `in progress (who or which branch)`, or `blocked (why)`.

**Who has what (2026-10-11).** The cloud agent ([`../agents/cloud-agent.md`](../agents/cloud-agent.md)) stopped on 2026-10-11 after closing T-111, T-196, T-144, T-197, T-198, T-199 and T-212; its log is [`../reports/cloud-agent-log.md`](../reports/cloud-agent-log.md). Everything open is the local orchestrator's again.

| Id | Title | Source | Needs | Status |
|---|---|---|---|---|
| T-752 | [UI words still written in code: quality words, aged names, tag items, the legend's own lines](work/T-752-ui-words-still-in-code.md) | [T-744](archive/tasks/T-744-ui-words-left.md) | — | open |
| T-753 | [A civilian already in the only room behind a door finds no shelter there](work/T-753-shelter-from-inside.md) | [T-745](archive/tasks/T-745-locked-in-thirst.md) | — | open |
| T-754 | [The Population panel's last skip shows a raw reason code, and Year 1's guaranteed wave reads "Eligible: no"](work/T-754-population-skip-words.md) | [T-750](archive/tasks/T-750-immigration-wealth-bar.md) | — | open |
| T-755 | [The tutorial's steps pass before the thing works: a stockpile that takes nothing, a farm with no crop, Bedroom for Build, nine steps paused](work/T-755-tutorial-steps-finish-the-job.md) | [the newcomer playtest of 2026-11-25](../reports/data/2026-11-25-playtest-5.md) | — | open |
| T-756 | [On a forest site the first workshop is refused almost everywhere: "needs the tree chopped first"](work/T-756-workshop-over-trees-fells-them.md) | [the newcomer playtest of 2026-11-25](../reports/data/2026-11-25-playtest-5.md) | — | open |
| T-757 | [A new fortress starts paused and nothing on screen says so](work/T-757-paused-fortress-says-so.md) | [the newcomer playtest of 2026-11-25](../reports/data/2026-11-25-playtest-5.md) | — | open |
| T-758 | [A window under 960 × 540 loses the status bar, the key bar and the hover line](work/T-758-small-window-keeps-status-rows.md) | [the newcomer playtest of 2026-11-25](../reports/data/2026-11-25-playtest-5.md) | — | open |
| T-759 | [The world map's first screen shows no keys: the cursor starts on the ocean and the panel says only "No embark here"](work/T-759-world-map-shows-its-keys.md) | [the newcomer playtest of 2026-11-25](../reports/data/2026-11-25-playtest-5.md) | — | open |
| T-760 | ["X is miserable" from the second day, and nothing says what would help](work/T-760-mood-says-what-helps.md) | [the newcomer playtest of 2026-11-25](../reports/data/2026-11-25-playtest-5.md) | — | open |
| T-761 | [The keyboard's map cursor is an inverted cell, and on grass it cannot be found](work/T-761-map-cursor-stands-out.md) | [the newcomer playtest of 2026-11-25](../reports/data/2026-11-25-playtest-5.md) | — | open |
| T-762 | [Six idle woodcutters and 35 chops waiting: the Jobs reason says "it may need … a tool another dwarf holds" when it knows the only axe is with Dis](work/T-762-job-wait-names-the-only-tool.md) | [the newcomer playtest of 2026-11-25](../reports/data/2026-11-25-playtest-5.md) | — | open |

The latest balance evidence is in [balance-status.md](balance-status.md). Walking speed is ×1.5 since T-140's measurement. Of B-008 to B-012, read against T-145's peril-0 sweep (2026-10-17): B-009, B-011 and B-012 are closed; B-008 (year-1 wealth above the model) is T-380 and B-010 (raid sizes at peril 2) is T-381. Their older measurement journal is in the [decision archive](archive/decisions-archive.md).
