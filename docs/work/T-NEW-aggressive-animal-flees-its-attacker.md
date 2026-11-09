# T-NEW — An aggressive animal struck outside `attack` flees its attacker

**Source:** [T-535](T-535-struck-animal-sleeps-on.md) · **Size:** S · **Needs:** — · **Status:** open

## Why

`perceivedThreats` in `animals/brain.ts` treats the creature that last attacked an animal as a threat for `aggressive` animals as it does for `neutral` ones. 08 § Wild behavior gives `aggressive` carnivores no such fear: a wounded animal flees "unless `aggressive`". So a wolf or a bear struck while it is idle, wandering, grazing or asleep, and still nearly unhurt, flees its attacker at its next think and, on a small map, leaves. In one of T-535's local runs of `pp_defence` (seed `pp-defence`, an early version of that change whose timeline differed), the soldiers' first swing, hit or miss, on each of two bears and four wolves sent the animal off the map, and the squad killed nothing in two seasons. An aggressive animal that is already in `attack` does not check threats, so whether a bear fights back depends on whether it saw the soldier first.

## What to do

Decide whether an aggressive animal fears its attacker. If it does not, drop `aggressive` from the attacker rule in `perceivedThreats` and say in 08 what an aggressive animal struck outside `attack` does: probably it defends against the attacker from its tile, as a territorial one now does when struck in its sleep (T-535). Run the instrument and the sweep: this makes the three-year squad's fights with wolves and bears costlier.

## Done

- 08 says what a struck aggressive animal does, the brain does it, a test pins it, and the instrument's and the sweep's verdicts pass, or a dated report says why not.
