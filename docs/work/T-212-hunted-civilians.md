# T-212 — A hungry predator kills the civilian it hunts

**Source:** T-196 and [`2026-10-10-wild-animals-and-civilians.md`](../../reports/audits/2026-10-10-wild-animals-and-civilians.md) · **Size:** M · **Needs:** — · **Status:** open; decided 2026-10-10, see Decision

## Why

After T-196 a wild animal that defends its ground lets a fleeing dwarf go, so a badger or a boar no longer kills a whole group. A *hungry* predator does not let go: 08 makes it hunt "any prey … or dwarf within perception" and keep its prey until it dies. A wolf is half again as fast as a dwarf, so a hunted civilian cannot escape, and a civilian in the open never fights back (10: only a cornered civilian fights). Measured by T-196's chain probe with the wolf hungry from the start (ten seeds, seven civilians hauling past it for three days): the hunted civilian died in every run (17 of 70 in all, one to three per run), a median of 234 ticks after the first bite; a squad 28 tiles away with a kill order arrived after the kill (10 of 70). The code before T-196 killed 29 of 35 on five seeds.

A wolf is hungry every `PREDATOR_HUNGER_DAYS` (3) and stays on the map up to `WILD_LIFETIME_DAYS` (28), in packs of 3–6, in temperate forest at peril 0. A fortress that works outside near a pack may lose a dwarf every few days.

## Reproduction

`reports/data/2026-10-10-t196-probe-chain-v2.test.ts.txt` with `T196_HUNGRY=1 T196_SPECIES=wolf`; results in `reports/data/2026-10-10-t196-probe-final-hungry.json` and the report [`2026-10-10-wild-animals-after-the-fixes.md`](../../reports/audits/2026-10-10-wild-animals-after-the-fixes.md).

## What the spec says

08 § Wild behavior (`hunt`, the hungry predator); 10 § Behavior selection (flee, cornered civilian); 16 § Targeting.

## What to do

Decide, with a measurement over a year on forest and taiga seeds, one of: (a) a civilian caught by an attacker faster than itself fights back with what it carries; (b) civilians near a dwarf that a wild animal attacks defend it when they are several; (c) a hungry predator prefers animal prey, and hunts a dwarf only when none is in perception; (d) keep it, and say in `balance.md` how often a careless fortress loses a dwarf to wolves. Then write the rule in 08 or 10 and pin it with a test.

## Done

- The decision and its reason are in 08 or 10, with a test that names T-212.
- `balance.md` § Wild animals states the hungry-predator figure, measured.

## Decision (2026-10-10, local orchestrator, under the owner's standing instruction to use judgement; the owner was told and may overrule)

Two of the four options together, (c) and (a). Not (b), not (d).

- **(c) A hungry predator prefers animal prey.** It hunts the nearest animal prey in perception, wild or tame, and hunts a dwarf only when no animal prey is in perception. A pack shares one quarry. This is how the animal should read to a player, and it makes livestock, not haulers, the first thing a wolf pack costs a fortress; a pasture near the forest edge then needs a fence, a door or a guard, which is a decision the player can see and make.
- **(a) A civilian that has been caught fights back.** "Cornered" in 10 already means a civilian with no escape. Being hit while fleeing, by an attacker at least as fast as itself, is no escape: from that moment the civilian turns and fights with what it carries (a pick, an axe, a knife, else its fists), and keeps fighting until the attacker breaks off, flees or dies, or until a route to safety opens that the attacker cannot close. It does not chase.
- **Not (b):** civilians rushing to defend each other would send unarmed haulers into a wolf pack and turn one death into three. The squad and the alert are the fortress's answer, and T-196 made a kill order work.
- **Not (d):** a death that no play can prevent is not a hazard, it is a tax.

**Target, to state in `balance.md` § Wild animals after measuring:** on a forest or taiga map at peril 0, a fortress that ignores wolves loses livestock regularly and a dwarf now and then (a few a year at most); a fortress that reacts (pasture behind a door, alert raised, squad sent) loses no dwarf to wildlife in a year.

**What to do:** as the section above says, with these two rules; measure the year on forest and taiga seeds before and after; write the rules in 08 § Wild behavior and 10 § Behavior selection; tests that name T-212 for both rules, including a hauler with a pick that wounds a wolf and one with nothing that still dies sometimes.
