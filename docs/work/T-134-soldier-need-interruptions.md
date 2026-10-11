# T-134 — T-195 follow-up: squad orders respect need activities

**Source:** Codex's critical read of the T-195 fix (`8ef36d5`), 2026-10-10; its work in progress is commit `c97c17c` on branch `t-134-wip` · **Size:** S · **Needs:** — · **Status:** in progress (cloud agent, `cloud/T-134`)

## Why

T-195 made soldiers on duty eat, drink and sleep. Codex's critical read found three faults in that fix and left ten stepped-world regressions and a correction (`test/unit/combat/t195-follow-up.test.ts`), not green: `hospital_run` got one wounded survivor where it expects three, and the per-system performance file passed 19 of 22.

1. Squad code (`stepSquads`) still moved a soldier whose brain behavior was `need` when its activity was `sleep` outside `train` mode, so a sleeping soldier or one walking to bed was walked back to its station.
2. `select()` held a soldier's wants (`dutyHolds`) for an `active` squad with any standing order, or under any alert, and never for a `train` or `off` squad under an alert with an order.
3. `hasHostileInSight` counted a held combat target as a hostile in sight; 16 keeps a target that is out of sight (§ Targeting), so that is no proof of sight. And it ran the perception scan on every selection of every soldier, also when nothing could be held.

## Rule and scope

Implement the existing behavior-selection rules of 10 and 16. A critical need wins in every mode, and squad movement never redirects a `need` activity, including travel to a bed and sleep. Want-level needs wait only for an active squad with a hostile in sight, or an explicit order during a watchful or hearth alert. A calm station order and an alert without an order do not alone hold a want. An acquired combat target is not proof of current sight. Skip the sight scan where it cannot change the outcome; combat's own perception and target retention are unchanged.

## Spec sections

- `02-systems/10-dwarves.md` § Behavior selection, § Sleeping.
- `02-systems/16-combat.md` § Squads.
- `04-implementation/algorithms/creature-brains.md` § Dwarf brain.

## Decisions

(Filled in as the work goes.)

## Done

Every `describe('T-134 …')` regression passes; the static checks, `npm test` and the e2e suite pass; the per-system performance file adds no failure over `cloud/main`; the rules are folded into the spec. Archive this file and remove its backlog row.
