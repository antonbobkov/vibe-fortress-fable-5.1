# T-528 — A dwarf stays in `retreat` for one tick after the alert falls

**Closed:** 2026-11-07, in HEAD.

**Source:** T-527's sweep (run 42429599670, `three-years-p2-4` at shift 0, tick 403,200) · **Size:** S · **Needs:** — · **Status:** open

## Why

System 16 lowers the hearth alert after system 10 has stepped the dwarves, so a dwarf keeps `retreat` for one tick after the alert falls. A daily invariant sample that lands on that tick fails `dwarf.retreat-without-hearth-alert`, a false finding that fails a sweep seed job.

## What to do

With a small test, either have 10 drop `retreat` in the same tick the alert falls (preferred if it changes nothing else), or let the invariant accept the tick the alert falls.
