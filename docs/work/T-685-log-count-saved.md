# T-685 — A loaded log keeps its merged lines' counts

**Source:** noticed in T-679 · **Size:** S · **Needs:** — · **Status:** open

## Why

`toSaved` in `src/ui/ui-state.ts` writes a log line's tick, severity, text, focus, category and subject but not its `count`, and `fromSaved` loads every line with `count: 1`: "Stockpile #2 is full ×3" reads "Stockpile #2 is full" after a load, and the next identical line that day merges into it as ×2.

## What to do

Save `count` when it is above 1 (omitted otherwise, so older saves load as today) and load it back; 24 § State and `schemas/system-state.md` (`logTail`) name it.

## Done

A unit test: a merged ×3 line survives `toSaved` / `fromSaved` with its count, and a line saved without one loads as ×1.
