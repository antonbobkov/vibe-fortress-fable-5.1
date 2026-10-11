# T-219 — A caught civilian stays and fights a defending animal or an armed raider it could have escaped

**Source:** T-212 and [`2026-10-11-hungry-predators.md`](../../reports/audits/2026-10-11-hungry-predators.md) (§ The chain probe with fed animals, § The reference fortress) · **Size:** S (a decision, then a rule and a re-measure) · **Needs:** — · **Status:** open (needs a decision)

## Why

T-212's decision: a civilian hit while fleeing by an attacker at least as fast as itself is caught, and fights until the attacker breaks off, flees or dies. It was written for the hungry predator, which never lets go. The rule as decided covers every attacker, and a badger (0.15), a boar (0.18) and a wolf (0.225) are all at least as fast as a dwarf (0.15 at Agility 50). A *defending* animal (08) lets go once its target is out of its provoke radius from where the attack began. A caught civilian no longer runs out of that radius, so the defender keeps biting until the civilian is unconscious, or the animal flees or dies.

Measured with the T-196 chain probe (seven civilians crossing one fed animal's ground for three days, ten seeds), before and after T-212: with a medic, boar 7 → 9 of 70 civilians dead, wolf 0 → 3; with a medic and a squad, boar 2 → 4; one lone civilian, wolf 4 → 6 of 10. Without a medic it helped: boar 18 → 16, wolf 16 → 10. A badger with a medic stays at 0.

The rule also covers hostiles. On the saved 80-dwarf reference fortress (`test/fixtures/reference-fortress.deepholm`, the 2,200 ticks the per-system perf test steps), Hillfolk bandits attack civilians: before T-212 they attacked dwarves 58 times and 2 dwarves bled out; after, caught civilians fought back (25 strikes, 645 dwarf-ticks of fighting), the bandits attacked 126 times and 4 dwarves bled out.

## What the spec says

`10` § Behavior selection (the caught civilian); `08` § Wild behavior (defending and hunting attacks).

## What to do

Decide whether a defending animal's bite, or an armed raider's blow, catches a fleeing civilian. One reading: "no escape" holds only for an attacker that does not let go, so a civilian is caught only by a hunting predator. Another: a civilian is caught only when it carries a weapon. Write the choice in 10, pin it with a test, and re-measure the chain probe (all modes, three species, ten seeds) and the year of the T-212 report.

## Done

- The rule is in 10 § Behavior selection, with a test that names this task.
- `balance.md` § Wild animals and `balance-status.md` carry the re-measured figures.
