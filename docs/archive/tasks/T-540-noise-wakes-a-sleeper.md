# T-540 — Noise and closeness may wake a sleeping animal

**Closed:** 2026-11-10, in a855a78a,c054d41a.

**Source:** the owner, 2026-11-09 · **Size:** M · **Needs:** — · **Status:** open

## Why

The owner: "For fighting/sleeping interaction; generally noise / closeness should have a chance to wake up. Maybe do a check/roll on every noise (such as arrow shooting or dwarf in metal armor getting closer) with a chance to wake up. Of course, getting hit should immediately wake."

T-535 made a hit wake a sleeper at once; a miss, a parry or a block leaves it asleep, and nothing else wakes it but a threat at its next think. A deer can doze through a volley of missed bolts (listed in [`docs/fun-features.md`](../../fun-features.md)). This task keeps a hit as an instant wake and adds a chance to wake from noise and closeness, so the doze stays possible but less certain.

## What to do

- A sleeping wild animal rolls to wake on a noise near it. Noises to cover, at least: a shot or swing that misses, parries or is blocked against it or near it; a fight within a few tiles; a dwarf walking up close, louder in metal armour than in leather or none. Pick the plainest set the game already has events or a cheap per-think check for; no new per-tick scan over every creature.
- The chance falls with distance and rises with loudness. A missed attack on the sleeper itself is the loudest noise short of a hit. Pick starting numbers, write them in 08 § Wild behavior (`sleep`) as constants marked *unmeasured*, and decide what a woken animal does by T-535's rules (territorial defends, wounded flees, others idle).
- If armour has no "noisy" property yet, add the plainest one: by armour material class (metal loud, leather quiet), not per item.
- Rolls draw on the animals' own stream and only when a sleeper hears something, so a fortress with no sleeping animal near noise draws nothing new.
- Update the fun-features row for the dozing sleeper: it now dozes through a volley only by luck.
- **Heavy sleepers** (the owner, 2026-11-09: "Maybe some creatures have 'heavy sleeper' trait. They would sleep through the noise much more", then: "Per individual, at random"). Each wild animal is a heavy sleeper or not, decided at random once when it is created and kept on the creature (saved). Pick the share, about one in five as a start, *unmeasured*. Draw it so no existing draw moves: from the creature's id or on a stream of its own, not on the spawn stream. A heavy sleeper's chance to wake from noise is a small fraction of the ordinary one (pick it, *unmeasured*); a hit still wakes it at once. Show it where the creature's description lists such things (for example "a heavy sleeper"). Write it in 08 § Wild behavior. List it in `docs/fun-features.md` § In the game as a fun feature.

## Done

- Tests: a hit always wakes; a miss on the sleeper wakes it often but not always; a dwarf in metal armour walking past wakes it more often than one in leather; a sleeper far from any noise never rolls; a heavy sleeper wakes from noise far less often than a light one, and at once from a hit.
- Measured on GitHub: the pooled sweep and the instrument verdicts pass (hunting and the three-year squad's fights with boars move), or a dated report says why not.

## Outcome (2026-11-10)

Built as asked. Numbers in 08 § Tuning constants, all *unmeasured*: noise heard within 4 tiles; a miss, parry or block on the sleeper 600‰; a fight one tile away 250‰; a dwarf one tile away 100‰ in metal armour, 30‰ otherwise, at a listen every 10 ticks; each falling by a quarter a tile. One wild animal in five (by an id hash) is a heavy sleeper, at a tenth of those chances. Woken by an attack on it, a sleeper acts as T-535's struck sleeper; woken by other noise, it flees below its flee percent, else idles and its next think decides. Measured on a855a78a: sweep 42851630696 pass, pooled 19/7/0.25/879.75/142.25 (alive/grown/hungry/living/deaths; bounds living ≥ 848.5, deaths ≤ 155.25); instrument 42851636936 pass, pooled 12.44/6.5/8.63/141.63/6.38. Three sweep seed jobs failed their own T-156 build witnesses (p2-4 at shift 0, p4-4 at 100, p2-5 at 150), the family T-538 also saw; the verdict does not judge them.
