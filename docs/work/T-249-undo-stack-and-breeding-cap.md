# T-249 — Undo keeps ten designation batches; the breeding cap can be typed

**Source:** T-111 and its report, [`../../reports/audits/2026-10-10-ui-audit-follow-up.md`](../../reports/audits/2026-10-10-ui-audit-follow-up.md) (R11, R12) · **Size:** S · **Needs:** — · **Status:** open

## Why

Two repetitive tasks of the first audit were not taken up by any U task. `Ctrl+Z` undoes only the last designation batch, once. The breeding cap only counts up by one and wraps from 100 to 0, so lowering it means pressing through the top.

## Reproduction

Seed `audit-1`, default embark, paused. `d`, drag two separate rectangles on the rock face, `Ctrl+Z` twice: the second batch goes, then "Nothing to undo." and the first batch stays (report shot 15h; code `src/ui/panels/designate.ts:97,163-174`). Animals, select the dog, `Shift+C`: 12 → 13; `-` does nothing (run p16; code `src/ui/panels/animals.ts:58` adds one modulo 101).

## What the spec says

- [`24-ui-and-input.md`](../02-systems/24-ui-and-input.md) § Rules (input model): "`Ctrl+Z` undoes the last batch".
- [`panels.md`](../04-implementation/ui-screens/panels.md) § Animals: `[S-c] cap`; [`08-animals-and-domestication.md`](../02-systems/08-animals-and-domestication.md): `SetBreedingCap { species, cap }`.

## What to do

**Decisions.**
- `Ctrl+Z` undoes the most recent of up to `UNDO_BATCHES_MAX` = 10 designation batches, one per press, newest first. The stack is presentation state: not saved, cleared on load and on leaving the fortress. Define `UNDO_BATCHES_MAX` in 24 § Tuning constants and `src/ui/constants.ts`.
- `[S-c] cap` turns the cap into a number field: digits type, `+`/`-` step by 1 and with Shift by 10, within 0–100; `Enter` sends `SetBreedingCap`, `Esc` leaves it unchanged. No wrapping.

1. Amend 24 § Rules and § Tuning constants, and `panels.md` § Animals.
2. Implement in `src/ui/panels/designate.ts` and `src/ui/panels/animals.ts`.
3. Tests, `describe('T-249 …')`: two, ten and eleven batches; the cap field's keys and bounds.

## Done

- The reproduction undoes both batches; the cap goes down with `-` and can be typed.
- The verification commands of [`../process/agent-workflow.md`](../process/agent-workflow.md) are green, with the browser suite.
