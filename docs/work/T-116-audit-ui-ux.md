# T-116 — Audit: UI and UX pass

**Source:** the owner, 2026-10-06 (the third of three audit/fix loops) · **Size:** M · **Needs:** T-111, T-115 and the fix tasks it produces · **Status:** open

**Who:** an Opus subagent, or Codex on `gpt-6-astra` at high effort. Not Gemini ([`../../agents/README.md`](../../agents/README.md)).

## Why

The first UI audit ([`../../reports/audits/ui-audit.md`](../../reports/audits/ui-audit.md)) led to eight fix tasks, and T-111 records which of its items they closed. This is a fresh pass on the result, not a re-check of the old list. It goes last of the three audits, so that it looks at the game after the playthrough and bug fixes have landed.

The owner's criteria are unchanged:

1. An intuitive, clean, clear UI: a new player can tell what they are looking at, what they can do, and how.
2. Repetitive tasks are easy.
3. A clear error or warning wherever something cannot be done.

## What to do

Audit only. Change no source, test or spec file. Play the real game in a browser: run a dev server on a port no other agent uses, and drive it with Playwright from a script kept outside the repository. Stop the server when done. Mark every finding as observed in play or read in code.

1. **A new player's first hour, twice.** Play once with the mouse only and once with the keyboard only, from the main menu to a fortress with food, drink, bedrooms, a workshop chain, a squad and a trade. Record every point of hesitation, and every place where one of the two input methods cannot do what the other can.
2. **A mature fortress.** Load the 80-dwarf reference fortress and do the everyday management tasks: find an idle dwarf and give it work, find out why an order is not being made, re-equip a squad, rearrange stockpiles, respond to a raid, treat the wounded, run a trade. Measure the keys and clicks for each, and say what should be shorter.
3. **The new UI from the fix tasks.** The order picker, the labor manager, the building panel, drag-to-place, the stockpile editor and room panel, tooltips, confirmations and the Shift accelerators. Do they fit together? Are the `[S-x]` captions readable in two-column panels? Does needing two presses of `Esc` to leave Designate bother a player? Is "new order" on `Shift+N` discoverable?
4. **Every failure path again.** Trigger each rejection and block the game can produce and read the message as a player would: does it name the thing, the reason and the remedy?
5. **Legibility.** Glyphs, both palettes, the smallest and largest supported window, long names, and a full log.
6. **What is still missing.** Commands with no UI, information a player needs but cannot see, and anything a Dwarf Fortress player would expect and not find.

## Deliverable

A new dated report, `reports/audits/<YYYY-MM-DD>-ui-ux.md`:

- the ten issues that matter most, each with a severity;
- the two walkthroughs;
- the task-cost table for the mature fortress;
- the failure-path table: what is shown today, and what it should say;
- recommendations grouped as quick wins, features and spec changes, each sized and tied to the file or spec section it touches.

Keep the screenshots that the report cites under `reports/audits/<date>-ui-ux/`.

## Follow-up

Add `T-1nn` rows for the recommendations worth doing, with this report as the source and a work file each. Group them so that tasks do not collide in the same files. Those fix tasks close the loop.

## Done

- The report exists and each finding says whether it was observed or read.
- The follow-up rows are in the backlog.
- The verification commands of [`../process/agent-workflow.md`](../process/agent-workflow.md) are green.
