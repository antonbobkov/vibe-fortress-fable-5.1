# T-242 — No raw string key or clashing letters in the stockpile preset list; log lines start with a capital

**Source:** T-111 and its report, [`../../../reports/audits/2026-10-10-ui-audit-follow-up.md`](../../../reports/audits/2026-10-10-ui-audit-follow-up.md) (new findings N2, N2b) · **Size:** S · **Needs:** — · **Status:** open

## Why

D-U4 says no raw string key ever reaches the screen. The stockpile preset list now ends with `ui.stockpile.preset.hospi…`, and its letter captions repeat (`[S-f]` for Food and Furniture, `[S-s]` for Seeds and Stone, `[w]` for Wood and Weapons, three `[S-c]`). Separately, an unnamed animal starts its log line in lower case: "dog has died."

## Reproduction

Seed `audit-1`, default embark. Make a stockpile, let a few ticks run, select it, `Shift+P` (report shot 08h; [`stockpile-presets.png`](../../../reports/screenshots/t-111/stockpile-presets.png)). For the log: run about three days and open Log (`a`): "dog has died.", "! cat has lost a limb." (shot 10k).

## What the spec says

- [`13-items-and-storage.md`](../../02-systems/13-items-and-storage.md) § Player-facing behavior names thirteen presets, from Food to Everything. `hospital` in `STOCKPILE_PRESETS` (`src/systems/items/stockpiles.ts:91`) is the hospital zone's own filter, not a player preset; `presetOptions` (`src/ui/panels/stockpile-editor.ts:44-46`) offers every key and builds a string key that does not exist.
- [`24-ui-and-input.md`](../../02-systems/24-ui-and-input.md) § Rules (announcements): no content id is shown.
- The death and limb strings put `{name}` first (`src/ui/strings.ts:988-991`); an unnamed creature's name is its species.

## What to do

**Decisions.**
- The preset list offers exactly 13's thirteen presets, in 13's order. `hospital` stays as the hospital zone's filter and is not listed.
- The preset rows carry no letter captions. Letters still jump to the next preset whose name starts with that letter (as now); the list's help line says "letters jump".
- A log line always starts with a capital letter. An unnamed creature is "A dog" / "The dog" in announcements ("A dog has died."). Put the rule in one place (the announcement formatter), not in each string.
- Add a unit test that every option the preset list shows has a string, since `strings:check` cannot see keys built at run time.

1. Amend `panels.md` § Zones (stockpile preset list) and `ui-keymap-and-screens.md` § Announcement strings if they show captions or the lower-case form.
2. Implement in `src/ui/panels/stockpile-editor.ts` and `src/ui/announcements.ts`.
3. Tests, `describe('T-242 …')`.

## Done

- The preset list shows thirteen names, none a key, with no repeated captions; the log reads "A dog has died."
- The verification commands of [`../../process/agent-workflow.md`](../../process/agent-workflow.md) are green, with the browser suite.
