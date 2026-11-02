# T-464 — A whole fortress dies to one cave crawler without striking it

**Source:** T-461 ([journal](../../reports/audits/2026-11-01-crawlers-in-the-halls.md)) · **Size:** M · **Needs:** — · **Status:** open

## Why

On `three-years-p4-2`, before the script answered hostiles indoors, one crawler killed 43 dwarves and 15 tame animals over five days. It took no blow in 217 attacks and stood at 100% blood. Every step follows the spec: squads in mode `off` are civilians until an alert, civilians flee unless cornered, and a bite catches a fleeing civilian only when the attacker is a wild animal hunting it (16 § Fleeing and morale in combat, 10 § Behavior selection). A cavern monster is not a wild animal.

The player was warned, and the script now answers, so this seed no longer plays out this way. A player who is away from the screen still loses the fortress to one 45-size animal.

## Decision needed

A balance decision, so the orchestrator takes it. The options:

1. **Nothing.** The alert is the answer, and the announcements are loud enough.
2. **A hunting cavern monster catches a civilian as a hunting wild animal does.** It is the smallest change: the same rule, one more kind of attacker.
3. **A soldier off duty who is attacked fights.** Squad members carry their gear already.
4. **Tame dogs defend.** Touches 08, which has no such rule for untrained animals.

The author's view is 2, with the annual instrument and `pp_defence` run on it.

## Orchestrator's decision (2026-11-01)

Options 2 and 3 together. A hunting cavern monster catches a fleeing civilian as a hunting wild animal does, so the civilian turns and fights. A soldier off duty who is attacked fights, with the gear it carries. Not option 4. Measure both with the annual instrument and `pp_defence`, and report the twenty-seed row.

## Done

- The decision is in 16 and 10, with a unit test if behaviour changes.
- The instrument by the T-308 rule.
