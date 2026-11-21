# Backlog

Every open item, and nothing else. A row is added when an item is accepted and deleted in the commit that closes it; git is the history. How to pick up, work and close an item is in [`process/agent-workflow.md`](process/agent-workflow.md).

- **Id.** New items take the next free `T-1nn`. The older ids below (`U-`, `F-`, `C-`, `B-`) keep theirs until they close; nothing new gets one.
- **Source.** The audit, report or plan that produced the item. An item without a source is not accepted.
- **Needs.** Items that must be closed first. "—" means it can start now.
- **Status.** `open`, `in progress (who or which branch)`, or `blocked (why)`.

**Who has what (2026-10-11).** The cloud agent ([`../agents/cloud-agent.md`](../agents/cloud-agent.md)) stopped on 2026-10-11 after closing T-111, T-196, T-144, T-197, T-198, T-199 and T-212; its log is [`../reports/cloud-agent-log.md`](../reports/cloud-agent-log.md). Everything open is the local orchestrator's again.

| Id | Title | Source | Needs | Status |
|---|---|---|---|---|
| T-662 | [The sweep's noise under fixed immigration rolls](work/T-662-sweep-noise-fixed-rolls.md) | [T-652](archive/tasks/T-652-immigration-roll-own-stream.md) | — | open |
| T-663 | [No water inside the gate](work/T-663-water-inside-the-gate.md) | [T-656](archive/tasks/T-656-thirst-under-the-alert.md) | — | open |
| T-665 | [A stockpile that takes flux stone](work/T-665-flux-stockpile.md) | [T-659](archive/tasks/T-659-steel-fuel-in-one-trip.md) | — | open |
| T-666 | [A patient is watered only with drink](work/T-666-patient-water.md) | [T-664](archive/tasks/T-664-small-fortress-starves.md) | — | open |
| T-667 | [The three-year farm stops growing at its strips' cap](work/T-667-farm-strip-cap.md) | [T-664](archive/tasks/T-664-small-fortress-starves.md) | — | open |
| T-668 | [Peril-2 steel fell a seventh with T-664](work/T-668-peril2-steel-after-farm.md) | [T-664](archive/tasks/T-664-small-fortress-starves.md) | — | open |
| T-669 | [A click opens what it lands on, and a creature's view follows the creature](work/T-669-inspection-selection-ladder-creature.md) | [design](../reports/designs/2026-11-21-inspection-and-follow.html) | — | open |
| T-670 | [An item's view, and names that open what they name](work/T-670-inspection-item-view-links.md) | [design](../reports/designs/2026-11-21-inspection-and-follow.html) | T-669 | open |
| T-671 | [Centre and follow the thing in view, and say when it is gone](work/T-671-inspection-centre-follow-gone.md) | [design](../reports/designs/2026-11-21-inspection-and-follow.html) | T-670 | open |
| T-672 | [The embark preset is remembered, and a fortress can be abandoned for a new embark on the same world](work/T-672-sticky-preset-and-re-embark.md) | Owner feedback 2026-11-21 | — | open |
| T-673 | [The mouse wheel's level direction is reversed, and a setting chooses it](work/T-673-wheel-level-direction.md) | Owner feedback 2026-11-21 | — | open |
| T-674 | [Common actions on plain letters: a keymap proposal, then the change](work/T-674-keymap-plain-letters-first.md) | Owner feedback 2026-11-21 | — | open |
| T-675 | [The wagon's animals graze and wander on arrival](work/T-675-animals-on-arrival-wander.md) | Owner feedback 2026-11-21 | — | open |
| T-676 | [Dwarves haul the wagon's goods to stockpiles](work/T-676-wagon-not-hauled.md) | Owner feedback 2026-11-21 | — | open |
| T-677 | [A stockpile clears items that do not belong on it](work/T-677-stockpile-clears-foreign-items.md) | Owner feedback 2026-11-21 | — | open |
| T-678 | [A list of every creature on the map, not just dwarves](work/T-678-all-units-list.md) | Owner feedback 2026-11-21 | T-669 | open |
| T-679 | [The event log can be browsed, and an event with a place goes there](work/T-679-log-inspectable-goto.md) | Owner feedback 2026-11-21 | T-669 | open |
| T-680 | [`z` offers what zones to make, and a stockpile's settings open by clicking it](work/T-680-zones-menu-and-stockpile-click.md) | Owner feedback 2026-11-21 | T-669 | open |

The latest balance evidence is in [balance-status.md](balance-status.md). Walking speed is ×1.5 since T-140's measurement. Of B-008 to B-012, read against T-145's peril-0 sweep (2026-10-17): B-009, B-011 and B-012 are closed; B-008 (year-1 wealth above the model) is T-380 and B-010 (raid sizes at peril 2) is T-381. Their older measurement journal is in the [decision archive](archive/decisions-archive.md).
