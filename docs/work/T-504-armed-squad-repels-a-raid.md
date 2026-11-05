# T-504 — Raid morale: raiders lose nerve, and a well-armed squad repels a raid

**Source:** T-466's [report](../../reports/audits/2026-11-05-t466-defence-repels-a-raid.md), the owner's decision on 2026-11-04 · **Size:** M · **Needs:** — · **Status:** open

## Why

The owner: "a well-armed squad should be able to repel a raid." T-466 made raids repellable through raid morale: a raid that loses its captains goes home. In `defence_year` that now happens on 7 of 8 seeds, but because the captain walks into a cage trap, not because the squad fights. The squad never meets a raid there, and in the open arena three Novice soldiers lose to a raid of ten every time. Since T-483, a peril-4 raid also beats six Novice soldiers in every fight (T-493's arena).

## What to do

1. **Measure what a well-armed squad does today.** In the combat-pace arena, a peril-2 raid of ten against six soldiers at three levels: Novice in iron, Skilled in iron, Proficient in steel, with and without a marksdwarf or two. Count repelled, wiped and looted, and the squad's losses.
2. **Decide the target from it** and write it in 16 and `balance.md`: roughly, a Skilled squad of six in iron, fighting at a choke point, repels most peril-2 raids; Novices in the open still lose. A peril-4 raid should need more.
3. **If the squad cannot meet that,** find the plainest cause (raid morale under casualties, the captain rule while engaged, squad tactics, or numbers) and change the smallest rule. Keep T-466's captain rule and T-483's careless shooters.
4. **Let `defence_year`'s squad fight:** the script sallies its squad to the corridor when a raid arrives, so the scenario shows a fought defence as well as a trapped one.

## Done

- Arena figures before and after, in a dated report and `balance-status.md`.
- `defence_year_seeds` still passes its set rule; the twenty-seed file (on GitHub) keeps its set rule.

## Decision: raid morale (the owner, 2026-11-05)

The owner: "Raiding party can lose morale and run away, but ideally it would be something more than leader death. Maybe if >50% of the party is defeated. Also a fun mechanic to have a morale, and raiders with low morale lose nerve sooner." So T-466's captain rule becomes one input to a morale rule, not the whole of it:

- **Party morale**, 0 to 100, starting by purpose (a siege steadier than a raid, bandits the least). It falls when a member is killed, downed or caged (more for each), when its captain is lost (a large drop, not an instant retreat), when a trap or a hit from its own careless archers lands, and rises a little with loot taken. When it falls to a breaking point the party retreats: `repelled` without loot, `looted` with. Losing half the party should break it on its own, so the existing 50% rule is the floor of the same scale.
- **Each raider's nerve.** Raiders differ: one with low nerve flees on its own once party morale falls below its nerve, before the party breaks. It leaves the map, may drop what it carries, and its flight lowers morale again, so a rout can cascade. Nerve comes from the species or role (a captain steadiest) and a per-raider spread; it must not draw on 18's stream at spawn (T-479's lesson): derive it from the entity, or use its own stream.
- **Readable:** the threats panel shows a party's morale in words (steady, shaken, wavering, breaking), and a raider that loses its nerve gets a short note ("A Gloam warrior has lost its nerve and runs.").
- It is a fun feature: list it in `docs/fun-features.md` when it lands. Its numbers are *unmeasured* constants.

The measurement above then also covers morale: in the arena, how often a Skilled squad breaks a raid of ten before it loots, and how often a rout cascades.
