# T-525 — Refresh the sweep's reference after the gate and food fixes

**Source:** T-488's sweep verdict ([data](../../reports/data/2026-11-07-t488-sweep-verdict.md)) · **Size:** S · **Needs:** — · **Status:** open

## Why

`SWEEP_REFERENCE` was set by T-513 on `ec0c9e03` (876 living, 145 deaths, 2.5 extinct). Since then T-518's second gate line and T-512's sowing fix moved the pooled sweep to about 973 living and 112 deaths. The verdict's guards are relative to the reference, so a change that loses most of that gain would still pass.

## What to do

Run the pooled sweep on current master (once T-522 has landed, or now and again after it), take the verdict's "if accepted" row, set `SWEEP_REFERENCE` to it, and note the old and new rows in `balance.md` § Three-year sweep. Keep the tolerances T-513 measured unless the new noise clearly differs.
