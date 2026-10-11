# T-219 — A caught civilian stays and fights a defending animal or an armed raider it could have escaped

Closed by `T-219: only a hunting animal catches a fleeing civilian`, the commit that archived this file. The re-measure of the chain probe and the year is T-253.

**Source:** T-212 and [`2026-10-11-hungry-predators.md`](../../../reports/audits/2026-10-11-hungry-predators.md) (§ The chain probe with fed animals, § The reference fortress) · **Size:** S (a decision, then a rule and a re-measure) · **Needs:** — · **Status:** open; decided 2026-10-11, see Decision

## Why

T-212's decision: a civilian hit while fleeing by an attacker at least as fast as itself is caught, and fights until the attacker breaks off, flees or dies. It was written for the hungry predator, which never lets go. The rule as decided covers every attacker, and a badger (0.15), a boar (0.18) and a wolf (0.225) are all at least as fast as a dwarf (0.15 at Agility 50). A *defending* animal (08) lets go once its target is out of its provoke radius from where the attack began. A caught civilian no longer runs out of that radius, so the defender keeps biting until the civilian is unconscious, or the animal flees or dies.

Measured with the T-196 chain probe (seven civilians crossing one fed animal's ground for three days, ten seeds), before and after T-212: with a medic, boar 7 → 9 of 70 civilians dead, wolf 0 → 3; with a medic and a squad, boar 2 → 4; one lone civilian, wolf 4 → 6 of 10. Without a medic it helped: boar 18 → 16, wolf 16 → 10. A badger with a medic stays at 0.

The rule also covers hostiles. On the saved 80-dwarf reference fortress (`test/fixtures/reference-fortress.deepholm`, the 2,200 ticks the per-system perf test steps), Hillfolk bandits attack civilians: before T-212 they attacked dwarves 58 times and 2 dwarves bled out; after, caught civilians fought back (25 strikes, 645 dwarf-ticks of fighting), the bandits attacked 126 times and 4 dwarves bled out.

In the browser year (`test/e2e/full-year.spec.ts`, twelve runs on `cloud/T-212`, [`2026-10-11-full-year-with-t212.md`](../../../reports/audits/2026-10-11-full-year-with-t212.md)), 14 of the 21 dwarf deaths were civilians caught by an animal defending its ground: 7 to boars, 5 to wolves, 2 to badgers. Survival was still better than without T-212 (a median of 11 living against 8.5 in ten runs on `cloud/main`).

## What the spec says

`10` § Behavior selection (the caught civilian); `08` § Wild behavior (defending and hunting attacks).

## What to do

Decide whether a defending animal's bite, or an armed raider's blow, catches a fleeing civilian. One reading: "no escape" holds only for an attacker that does not let go, so a civilian is caught only by a hunting predator. Another: a civilian is caught only when it carries a weapon. Write the choice in 10, pin it with a test, and re-measure the chain probe (all modes, three species, ten seeds) and the year of the T-212 report.

## Done

- The rule is in 10 § Behavior selection, with a test that names this task.
- `balance.md` § Wild animals and `balance-status.md` carry the re-measured figures.

## Decision (2026-10-11, local orchestrator, under the owner's standing instruction to use judgement; the owner was told and may overrule)

**A civilian is caught only by a hunting predator.** "No escape" in 10 means an attacker that does not let go. A wild animal that hunts the dwarf is one. An animal defending its ground is not (it lets a fleeing dwarf go, T-196), and an armed raider is not for this rule either: the fortress's answer to raiders is doors, the alert and the squad, and a civilian that turns on an armed raider dies where it could have reached a door.

- A fleeing civilian hit by a **wild animal that is hunting it** is caught and fights back, as T-212 wrote.
- A fleeing civilian hit by a **defending** animal, or by a **hostile of a party** (thief, bandit, raider, the restless dead, the Deep), keeps fleeing. The existing rule for a civilian with no route to flee at all is unchanged.
- The reason is measured: with fighting back against everything, 14 of T-212's 21 browser-year deaths were civilians who stayed in a defending animal's ground, and raider deaths in the reference fortress went from 2 to 4.

Re-measure as the task says, and update `balance.md` § Wild animals.
