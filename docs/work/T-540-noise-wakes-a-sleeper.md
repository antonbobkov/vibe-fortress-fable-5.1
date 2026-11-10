# T-540 — Noise and closeness may wake a sleeping animal

**Source:** the owner, 2026-11-09 · **Size:** M · **Needs:** — · **Status:** open

## Why

The owner: "For fighting/sleeping interaction; generally noise / closeness should have a chance to wake up. Maybe do a check/roll on every noise (such as arrow shooting or dwarf in metal armor getting closer) with a chance to wake up. Of course, getting hit should immediately wake."

T-535 made a hit wake a sleeper at once; a miss, a parry or a block leaves it asleep, and nothing else wakes it but a threat at its next think. A deer can doze through a volley of missed bolts (listed in [`docs/fun-features.md`](../fun-features.md)). This task keeps a hit as an instant wake and adds a chance to wake from noise and closeness, so the doze stays possible but less certain.

## What to do

- A sleeping wild animal rolls to wake on a noise near it. Noises to cover, at least: a shot or swing that misses, parries or is blocked against it or near it; a fight within a few tiles; a dwarf walking up close, louder in metal armour than in leather or none. Pick the plainest set the game already has events or a cheap per-think check for; no new per-tick scan over every creature.
- The chance falls with distance and rises with loudness. A missed attack on the sleeper itself is the loudest noise short of a hit. Pick starting numbers, write them in 08 § Wild behavior (`sleep`) as constants marked *unmeasured*, and decide what a woken animal does by T-535's rules (territorial defends, wounded flees, others idle).
- If armour has no "noisy" property yet, add the plainest one: by armour material class (metal loud, leather quiet), not per item.
- Rolls draw on the animals' own stream and only when a sleeper hears something, so a fortress with no sleeping animal near noise draws nothing new.
- Update the fun-features row for the dozing sleeper: it now dozes through a volley only by luck.

## Done

- Tests: a hit always wakes; a miss on the sleeper wakes it often but not always; a dwarf in metal armour walking past wakes it more often than one in leather; a sleeper far from any noise never rolls.
- Measured on GitHub: the pooled sweep and the instrument verdicts pass (hunting and the three-year squad's fights with boars move), or a dated report says why not.
