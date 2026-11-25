# T-729 — The Military panel warns twice of no barracks for a squad on Train

**Closed:** 2026-11-25, in d9d3776f,220077cf.

**Source:** T-718 (the Train cost line under the squad's mode) · **Size:** S · **Needs:** — · **Status:** open

## Why

Since T-718 a squad on Train with no barracks zone says it under the mode's keys, in the alert colour: "3 dwarves off work, and with no barracks they cannot drill: [z] Barracks, then [b], or [o] Off." The barracks row at the foot of the squad still says, also in the alert colour, "No barracks: the squad cannot train. [z] Barracks, then [b]." Two alert lines in one panel say one thing, and at the sidebar's width the first wraps between `[z]` and "Barracks".

## What to do

Decisions:

- The barracks row of a squad on Train with no barracks zone reads as for any squad with none, "No barracks  [b] assign", in the alert colour; the warning is the mode line's alone. The status-row notice when Train is set stays as it is.
- The wrap keeps a key with the word after it (`[z] Barracks` on one row), as 24's rule keeps a number with its word.

Spec: `ui-screens/panels.md` § Military (the barracks bullet).

## Done

- [x] Tests (`describe` with the task id): a squad on Train with no barracks has one warning line; `[z] Barracks` is never split by the wrap (`test/unit/ui/t729-one-no-barracks-warning.test.ts`, with the row alert-coloured on Train and dim when Off). The key stays with its word by no-break spaces in the string, as the farm line keeps a count with its word: a general rule in `wrapHang` would also glue a key to the word after it where the key belongs to the word before (`order one [o] or buy one`).
- [x] UI only: world hashes unchanged (only `src/ui` changed).
