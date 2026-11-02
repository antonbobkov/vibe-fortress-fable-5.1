# T-480 — The hunter hint reads the labor bitset as if it were bytes per labor

**Source:** found while doing T-478 · **Size:** S · **Needs:** — · **Status:** open

`src/ui/hints.ts`, where `hunterLabor` is computed, reads `Labors.enabled[hunting]`. `enabled` is a bitset: labor `k` is bit `k & 7` of byte `k >> 3`, as `noMiners` in the same file and `JobBoard.laborEnabled` read it. With 25 labors the array has 4 bytes, and `hunting` is number 15, past its end. So the read gives `undefined ?? 0`, and `hunterLabor` is false however the labors stand.

## What to do

- Read the bit the way `noMiners` does, and look at which fortress dwarves it should count (`noMiners` filters by faction and species; this one does not).
- Check what the hint that reads `hunterLabor` then does, against `03-content/ui-keymap-and-screens.md` § hints, and correct the condition if the spec expects otherwise.

## Done

- A test with a dwarf whose `hunting` labor is on and one whose labor is off, each giving the right `hunterLabor`.
