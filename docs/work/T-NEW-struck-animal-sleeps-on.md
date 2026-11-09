# T-NEW — A territorial animal struck in its sleep sleeps on until it dies

**Source:** [T-529](T-529-squad-lost-to-boars.md) ([the audit](../../reports/audits/2026-11-09-t529-squad-and-boars.md), [the probe](../../reports/data/2026-11-09-t529-boars.probe.ts.txt)) · **Size:** S · **Needs:** — · **Status:** open

## Why

In T-529's six 400-day runs of seed `three-years`, 194 of 316 engagements between a dwarf and a wild animal began on a sleeping boar or badger, and in 181 of them the animal never struck back: soldiers speared it to death in its sleep. A territorial animal fears nothing (08 § Wild behavior), a sleeping animal wakes only for a threat (`thinkWild`, case `sleep`, in `animals/brain.ts`), and the wounded-flee check runs only in `attack`. 08 says wounded animals flee unless `aggressive`, and a `neutral` animal fears anything that attacked it; a territorial one, which defends its ground against a dwarf five tiles off, ignores a spear in its side.

## What to do

Decided: an animal struck while asleep wakes. A territorial one takes the striker as a defending attack from its own tile (as `idle`'s provoke rule starts one); any animal below its flee percent flees, unless aggressive, as in `attack`. Write it into 08 § Wild behavior (`sleep`), with a unit test of a boar struck in its sleep. Run the instrument and the sweep: it makes the three-year squad's hunts of sleeping boars costlier, now that T-529 sends it after a boar only at the gate.

## Done

- 08 says what a struck sleeper does, the brain does it, and a test pins it; the instrument's and the sweep's verdicts pass, or a dated report says why the change is not taken.
