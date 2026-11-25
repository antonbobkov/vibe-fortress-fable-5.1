# T-NEW — The Military panel warns twice of no barracks for a squad on Train

**Source:** T-718 (the Train cost line under the squad's mode) · **Size:** S · **Needs:** — · **Status:** open

## Why

Since T-718 a squad on Train with no barracks zone says it under the mode's keys, in the alert colour: "3 dwarves off work, and with no barracks they cannot drill: [z] Barracks, then [b], or [o] Off." The barracks row at the foot of the squad still says, also in the alert colour, "No barracks: the squad cannot train. [z] Barracks, then [b]." Two alert lines in one panel say one thing, and at the sidebar's width the first wraps between `[z]` and "Barracks".

## What to do

Decisions:

- The barracks row of a squad on Train with no barracks zone reads as for any squad with none, "No barracks  [b] assign", in the alert colour; the warning is the mode line's alone. The status-row notice when Train is set stays as it is.
- The wrap keeps a key with the word after it (`[z] Barracks` on one row), as 24's rule keeps a number with its word.

Spec: `ui-screens/panels.md` § Military (the barracks bullet).

## Done

- [ ] Tests (`describe` with the task id): a squad on Train with no barracks has one warning line; `[z] Barracks` is never split by the wrap.
- [ ] UI only: world hashes unchanged.
