# T-246 — Training an animal and renaming the fortress have a UI

**Source:** T-111 and its report, [`../../reports/audits/2026-10-10-ui-audit-follow-up.md`](../../reports/audits/2026-10-10-ui-audit-follow-up.md) (Issue 5, §5.4, 7.10) · **Size:** M · **Needs:** — · **Status:** open

## Why

Of the 22 commands the first audit found without a UI, two still have none: `TrainAnimal` and `RenameFortress`. A player cannot train a war or hunting animal, and cannot rename the fortress after embark.

## Reproduction

Seed `audit-1`, default embark. Animals (`n`): the Tame tab offers `[S-p] pasture  [S-s] slaughter  [S-c] cap [S-a] assign [S-n] name` and nothing to train (report shot 16b). `Esc` opens the game menu: Resume, Save, Load, Settings, Retire fortress, Main menu; no rename (shot 14d). Code: no `TrainAnimal` or `RenameFortress` is submitted anywhere in `src/ui` or `src/app`.

## What the spec says

- [`command-catalog.md`](../04-implementation/command-catalog.md): `TrainAnimal { animalId, kind }` (08; needs a kennel, `no_kennel`) and `RenameFortress { name }` (core; 1–32 characters).
- [`08-animals-and-domestication.md`](../02-systems/08-animals-and-domestication.md) § Rules: `kind: war | hunting` for `trainable` species; § Player-facing behavior: the Tame tab has "trained" and "actions".
- [`panels.md`](../04-implementation/ui-screens/panels.md) § Animals: the `Tr` column (`war`, `pet`).

## What to do

**Decisions.**
- Animals, Tame tab: `[S-t] train` (`t` is a panel letter) opens a two-row choice, "War" and "Hunting", for the selected animal, and `Enter` sends `TrainAnimal`. For a species that is not trainable the status row says so instead of opening the choice. A refusal (`no_kennel`) goes through the normal rejection path with a string that says to build a kennel. The `Tr` column shows "war", "hunting", "training" (a job exists) or nothing.
- Game menu: `[n] Rename fortress` opens the existing text input with the current name, and `Enter` sends `RenameFortress`. An empty or too long name is refused with the rule.

1. Amend `panels.md` § Animals (the action row), the game menu in 24 § Rules (its list of rows) and in `fortress-screen.md` (the game menu wireframe).
2. Implement in `src/ui/panels/animals.ts` and `src/ui/screens/game_menu.ts`.
3. Tests, `describe('T-246 …')`: the train choice submits the command; non-trainable species; rename through the text input.

## Done

- Both commands can be issued from the UI, and a refusal says why.
- The verification commands of [`../process/agent-workflow.md`](../process/agent-workflow.md) are green, with the browser suite.
