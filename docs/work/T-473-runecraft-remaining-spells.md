# T-473 — Runecraft 6: ward, mend, dread, daze, firebloom and vials

**Source:** runecraft [design](../../reports/designs/2026-11-01-runecraft-magic-system.md) · **Size:** L · **Needs:** — · **Status:** open

The specification is [25 Runecraft](../02-systems/25-runecraft.md). It governs, and this task needs only its sections named below. Everything marked for this task lands here and nothing else. Move this task's rows from 25 to the tables and schemas it names, and into its § Interfaces. Every number stays *unmeasured* unless this task measures it.

## What to do

25 §§ Casting (`castSupport`, the hold distance), Spells (those rows), Effects (`ward`, `flee`, stun on a target), Vials, Morale (its rows). `pendingBlooms` and `services.magic`. The ward's glyph background.

## Decisions

- Firebloom has `FIREBLOOM_DELAY_TICKS` between the cast and the bloom. It is checked clear at the cast, and it burns whoever stands there at the bloom.
- Dread is a `flee` effect read in 16's loop. 18 is not touched and nothing leaves the map.
- Daze is `CreatureStunned`. A stunned raider counts toward retreat while it lies there.
- The dwarf stops at three vials a day. There is no fourth and no `rune_sick`.
- Off-duty `mend_wounds` is cut. Mend is a fight spell.


## Done

- A warded squad of six at the measured peril-2 raid loses less blood than an unwarded one in the arena. The ward lapses at 420 ticks from a wand and 720 from an iron staff.
- The ward row of the worked numbers holds.
- Dread sends at most four running and they return. The retreat counter does not move. Mental spells fail on size 180 and on `deep`.
- Firebloom is never cast while a fortress creature stands in the square at the moment of casting, and one that walks in during the delay is burned.
- A caster below cost with a hostile held drinks, up to three a day.
- Announcements: out of rune, once; a firebloom that catches a fortress creature.
