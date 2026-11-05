# T-504 — A well-armed squad repels a raid in a fight

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
