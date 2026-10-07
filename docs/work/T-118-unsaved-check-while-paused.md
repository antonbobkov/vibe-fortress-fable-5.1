# T-118 — The main menu's unsaved-change check misses commands applied while paused

**Source:** U-02 ([`../archive/tasks/U-02-paused-input.md`](../archive/tasks/U-02-paused-input.md)), found while checking paused save and load against [`../02-systems/24-ui-and-input.md`](../02-systems/24-ui-and-input.md) § Game menu · **Size:** S · **Needs:** — · **Status:** open

## Why

Since U-02, a command given while the game is paused takes effect at once, without the calendar advancing. `Game.unsavedSince()` decides whether there are unsaved changes by comparing calendar ticks only. A player who pauses, designates a dig or places buildings, and then leaves through the game menu is therefore not warned, and loses those changes.

## What to do

1. Make the unsaved-change check count commands applied since the last save, not only ticks elapsed. A counter of applied commands kept beside the last-save tick is enough; it does not need to be saved.
2. Keep the existing behaviour for a game that has only run: ticks elapsed since the last save still count.
3. Write the rule into `24-ui-and-input.md` § Game menu, where the confirmation is described.

## Done

- A regression test: pause, apply a command, open the game menu and choose to leave; the confirmation is shown. Save, then leave; it is not shown.
- The verification commands of [`../process/agent-workflow.md`](../process/agent-workflow.md) are green.
