# Threat Schedules

**Owner:** content (`threatSchedules`) · **Depends on:** [`../02-systems/18-threats-monsters-and-raids.md`](../02-systems/18-threats-monsters-and-raids.md), [creatures.md](creatures.md), [weapons-and-armor.md](weapons-and-armor.md)

## Renown

`renown = wealth / RENOWN_WEALTH_DIVISOR + population × RENOWN_POP_WEIGHT` = `wealth / 2000 + population × 0.2`.

| Typical fortress | Wealth | Population | Renown |
|---|---|---|---|
| End of year 1 | 6,000 | 13 | 5.6 |
| End of year 2 | 18,000 | 28 | 14.6 |
| End of year 3 | 40,000 | 45 | 29 |
| End of year 5 | 120,000 | 70 | 74 |

The economy fixture at peril 2 runs a year ahead of this table: renown 12.8, 24.4 and 41.7 at the ends of years 1 to 3, from wealth two to three times the first row's ([raid sizes and renown](../../reports/audits/2026-10-21-raid-sizes-and-renown.md)).

## Schedule by peril

`earliest` is the first season the kind may occur; `interval` in days between rolls after the first; `size = min(max, base + renown × perRenown)` rounded; `warning` in days. `—` means never. The rows of perils 2 and 4 are measured over three years of the economy fixture ([raid sizes and renown](../../reports/audits/2026-10-21-raid-sizes-and-renown.md)): at peril 2 thieves 4 to 8 times, bandits of 3 to 5, ambushes of 4 in year 1 rising to the cap of 6, one raid a year (8 to 11 in year 2, 12 to 16 in year 3); at peril 4 raids of 13 in year 1 to the cap of 24 in year 3 and sieges of 22 to 34 in year 2. Every `earliest`, `interval`, `base`, `perRenown` and `max` of perils 0, 1 and 3 is *unmeasured*.

### Thieves (`gloam_snatcher`; `twilight_pass`: two per event)

| Peril | earliest | interval | size |
|---|---|---|---|
| 0 | year 2 spring | 60–120 | 1 |
| 1 | year 1 autumn | 40–80 | 1 |
| 2 | year 1 summer | 30–60 | 1 |
| 3 | year 1 summer | 20–40 | 1 |
| 4 | year 1 spring day 14 | 14–28 | 1–2 |

### Bandits (`hillfolk_bandit`; only when Hillfolk reputation < 50)

| Peril | earliest | interval | base | perRenown | max |
|---|---|---|---|---|---|
| 0 | year 2 summer | 120–240 | 2 | 0.05 | 4 |
| 1 | year 1 autumn | 90–180 | 2 | 0.05 | 4 |
| 2–4 | year 1 autumn | 120–240 | 3 | 0.05 | 5 |

### Ambushes (Gloam warriors and archers; no warning)

| Peril | earliest | interval | base | perRenown | max |
|---|---|---|---|---|---|
| 0–1 | — | | | | |
| 2 | year 1 autumn | 60–120 | 3 | 0.10 | 6 |
| 3 | year 1 autumn | 40–80 | 4 | 0.12 | 8 |
| 4 | year 1 autumn | 28–56 | 5 | 0.15 | 10 |

### Raids (warning 1 day; never in winter at peril ≤ 2)

| Peril | earliest | interval | base | perRenown | max |
|---|---|---|---|---|---|
| 0 | — | | | | |
| 1 | year 2 autumn | 112–224 | 5 | 0.20 | 12 |
| 2 | year 2 spring | 84–140 | 6 | 0.30 | 16 |
| 3 | year 1 autumn | 56–112 | 8 | 0.35 | 20 |
| 4 | year 1 autumn | 42–84 | 10 | 0.40 | 24 |

### Sieges (warning 1 day; Gloam plus trollkin)

| Peril | earliest | interval | base | perRenown | max | trollkin |
|---|---|---|---|---|---|---|
| 0–2 | — | | | | | |
| 3 | year 3 spring | 224–336 | 14 | 0.45 | 32 | 2 + renown / 15, max 6 |
| 4 | year 2 autumn | 168–224 | 18 | 0.50 | 40 | 3 + renown / 12, max 8 |

### Restless dead (`old_battlefield` only)

Every autumn night at dusk: `count = clamp(2, 8, 2 + renown / 12)` rise from random battlefield-band tiles; they collapse at dawn. Any that reach a dwarf fight; they never loot or retreat.

### Trait modifiers

`twilight_pass`: all Gloam intervals × 0.5. `serene_vale`: only thieves, at the peril 0 row. Region peril 0 with `serene_vale` never sees bandits.

## Party composition

Fractions of `size` by role; the remainder after rounding goes to warriors. A captain is added on top of `size` for raids and sieges, and so are hexers (`gloam_hexer`, [25 Runecraft](../02-systems/25-runecraft.md) § Hexers): at peril 3 from year 3 and at peril 4 from year 2, never at a lower peril or earlier.

| Kind | Warriors | Archers | Captain | Trollkin | Hexers |
|---|---|---|---|---|---|
| ambush | 60% | 40% | 0 | 0 | 0 |
| raid | 70% | 30% | 1 | 0 | 1 |
| siege | 60% | 30% | 1 (+1 per 20 members) | per table | 2 |
| bandits | 100% (`hillfolk_bandit`) | 0 | 0 | 0 | 0 |

## Hostile gear by tier

`tier = min(peril, 3)` for warriors and archers; sieges `+1`; captains `+1`; tier 0 exists only for restless dead and bandits.

| Tier | Metal | Warrior kit | Archer kit | Captain extra | Hexer kit |
|---|---|---|---|---|---|
| 0 | wood/rusted iron (poor) | club or rusted short sword, cap | — | — | — |
| 1 | copper | short sword or mace (50/50), cap, leather jerkin, buckler 50% | bow, 30 wooden arrows, dagger, cap, jerkin | helm, mail shirt | wand (stone amethyst), dagger, cap, leather jerkin |
| 2 | bronze | short sword, axe or mace, cap, leather jerkin, shield 50%, leggings | bow, 30 bone arrows, dagger, cap, jerkin | helm, mail shirt, shield | wand (stone amethyst), dagger, cap, leather jerkin |
| 3 | iron | axe, mace or spear, helm 50%, mail shirt 50% else jerkin, shield 60%, leggings | bow, 30 iron arrows, short sword, cap, jerkin | helm, mail shirt, greaves, shield | wand (stone amethyst), dagger, cap, leather jerkin |
| 4 | steel | axe, warhammer or spear, helm, mail shirt, shield 70%, greaves, gauntlets 50% | bow, 30 steel arrows, short sword, helm, mail shirt | helm, breastplate, greaves, gauntlets, shield | wand (stone amethyst), dagger, cap, leather jerkin |

Quality: common; captains fine. Restless dead carry a rusted (poor) iron weapon with 30% chance. A bow, a club and a wand are of wood (oak); a cap, a jerkin, leggings, boots and a quiver of leather; the rest of the tier's metal. `(stone amethyst)` sets that stone in the item when it is made, as a runeforge sets a channel's: a hexer's wand is a wand of frost (Frostbind). A hexer holds no other stone, and its kit is taken whole, with no roll.

## Cavern monsters

From [creatures.md](creatures.md): initial spawns and caps per cavern; daily respawn chance per species when below cap and the cavern is breached. `fungal_depths` multiplies caps by 1.5. Monsters wake on breach; `blind_stalker` and `giant_cave_spider` ambush from stealth.

| Cavern | Species | Initial | Cap | Daily respawn ‰ |
|---|---|---|---|---|
| 1 | `cave_crawler` | 2 packs of 3–5 | 10 | 80 |
| 1 | `giant_cave_spider` | 2 | 3 | 30 |
| 2 | `blind_stalker` | 3 | 6 | 60 |
| 2 | `troll` | 2 | 4 | 40 |
| 3 | `magma_wyrm` | 1 with `wyrm_roost`, else 0 | 1 | 0 |

## The Deep

`DEEP_PRESSURE_PER_TILE` = 10 per deepsilver tile mined; thresholds and emergences:

| Level | Pressure | Emergence | Announcement |
|---|---|---|---|
| 1 | 50 | 3 `hollow_crawler` | "The Deep stirs. Something has noticed the pale metal being taken." |
| 2 | 150 | 2 `hollow_stalker` + 3 `hollow_crawler` | "The rock cracks below. The Hollow sends its hunters." |
| 3 | 300 | 1 `magma_wyrm` (if none alive) + 2 `hollow_stalker` | "Fire moves in the deep. A wyrm has come up." |
| 4 | 500 | 1 `hollow_maw` + 4 `hollow_crawler` + 2 `hollow_stalker` | "The Hollow opens its mouth." |

After level 4, a wave every `HOLLOW_WAVE_DAYS` (28) days: wave n brings 3 + n crawlers, 1 + n/2 stalkers, and a maw every third wave; 'The Hollow does not forget.'

A vein of deepsilver has 6 tiles on average (5 with one vein at wealth 2; two veins at wealth 3): mining one whole vein reaches level 1; two veins level 2 to 3; every vein on a wealth-4 map (18 tiles → 180) reaches level 2 and stays there unless the player keeps digging for the wyrm chamber's vein. Level 4 needs deliberate mining of deepsilver from the Sea of Fire's rim over years; it is the endgame.

## Warnings and fog

`WARNING_DAYS` = 1 for raids and sieges; fog halves it. The warning names the edge ("the eastern edge") and the size band: "a few" (< 6), "a band" (6–15), "a horde" (> 15).
