# T-278 — Keys that do nothing say why; saving says "Saved"

**Source:** T-116 and its report, [`../../reports/audits/2026-10-12-ui-ux.md`](../../reports/audits/2026-10-12-ui-ux.md) (issue 8, § 5) · **Size:** S · **Needs:** T-273 (`src/ui/panels/military.ts`), T-276 (`src/ui/panels/orders.ts`) · **Status:** open

## Why

The owner's third criterion is a clear message wherever something cannot be done. A dozen keys still do nothing in silence, the game menu's Save gives no sign that it saved, and `F9` asks the player to confirm losing progress before it says there is no quick save.

## Reproduction

Default embark. Military with no squad: `v`, `Shift+K` (capture 5/53, 5/54). `+`, `v` on the empty squad: the mode reads "active" (5/55). `Shift+S`: "Station Click tile..." in the panel while the status row keeps an old line (5/57); a click on a tree: "Refused: it cannot stand there", and the pick stays armed (5/58, 5/59). Orders with no order: `Delete`, `x` (5/51, 5/52). `Ctrl+Z` in Designate with nothing designated (5/21). `Esc`, `Enter` on Save: the menu is unchanged (5/61). `F9` with no quick save: "Load the quick save? Unsaved progress will be lost." and after `y`: "There is no quick save to load." (5/67; the judgement replay).

## What the spec says

- [`24-ui-and-input.md`](../02-systems/24-ui-and-input.md) § Rules: a refusal names the thing and why.
- [`panels.md`](../04-implementation/ui-screens/panels.md) § Military and § Orders; the game menu's screen document under [`../04-implementation/ui-screens/`](../04-implementation/ui-screens/).

## What to do

**Decisions.** A key that a panel shows in a caption never does nothing in silence. The lines, all in the status row:
- Military, any squad key with no squad selected: "No squad yet: [+] makes one."
- Military, `v` or `Shift+T` on a squad with no members: the mode changes, and the line says "The Hearthguard has no members: [S-a] adds them."
- Military, `Shift+S`, `Shift+P`, `Shift+K`: while the pick is armed the status row says what to do ("Station: click a floor tile · [Esc] cancel", "Patrol point: click a floor tile · [Esc] cancel", "Kill order: click a creature · [Esc] cancel"). A refused tile says "The squad cannot stand there: pick a floor tile." and the pick stays armed, with the prompt back on the next pointer move.
- Orders, `x`, `Delete`, `r`, `+`, `-` with no order selected: "No order is selected."
- Designate, `Ctrl+Z` with nothing to undo: "Nothing to undo."
- Harvest refusal, in the voice of its neighbours: "No ripe crops here to harvest."
- **Save.** `Enter` or `s` on Save writes the save, as now, and the menu shows under its title for three seconds: "Saved Grimvault, Day 1 of Spring, Year 1." The same line goes to the log, as the quick save's does.
- **`F9`.** With no quick save, `F9` says "There is no quick save to load." at once and asks nothing.
- **Embark with no food or drink.** After the pick and axe questions, an embark with no food item or no drink item asks "Embark with no food?" or "Embark with no drink?" in the same form.

1. Amend `panels.md` § Military and § Orders, the game menu and embark screen documents, and `ui-keymap-and-screens.md` § Announcement strings if it lists these lines.
2. Implement in `src/ui/panels/military.ts`, `src/ui/panels/orders.ts`, `src/ui/panels/designate.ts` (one line; if T-249 is open, after it), `src/ui/screens/game_menu.ts`, `src/app/` (the `F9` check), `src/ui/screens/embark.ts` (if T-244 is open, after it), and the strings.
3. Tests, `describe('T-278 …')`: one per line above.

## Done

- Every step of the reproduction shows its line.
- The verification commands of [`../process/agent-workflow.md`](../process/agent-workflow.md) are green, with the browser suite.

## Decisions made in the work

- Orders: `Delete` removes the selected order like `x` (unless a map selection is waiting for it). `+` and `-` with no order selected stay the speed keys, as the keymap table says; a new line there would take the speed keys away from the Orders panel. The existing "No order is selected: [S-n] adds one." line is kept, since it already begins with the wanted words.
- A harvest rectangle holding no ripe crop sends nothing (the command used to succeed and mark nothing); the line is "No ripe crops here to harvest."
- `Ctrl+Z` with nothing to undo and `F9` with no quick save already answered at once; the tests now pin both, and `F9` also puts its line in the status row, not only in the log.
- Embark: "Embark without food or drink?" is replaced by two questions, `c_embark_no_food` and `c_embark_no_drink`, asked in that order after the pick and the axe.
- The game menu's "Saved ..." line stays for `GAME_MENU_MESSAGE_MS` (3000); the menu stays open after Save.
