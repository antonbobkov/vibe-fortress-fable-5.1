# T-743 — The Hillfolk blame the fortress for every bandit's death, whoever killed it

**Source:** T-740 (the blame rule of 20 § Movement step 5, master 3ebc7d90) · **Size:** S · **Needs:** T-740 · **Status:** open

## Why

T-740 made a caravan member's death count against the fortress only when the fortress caused it (a fortress creature or a trap). The Hillfolk's other grievance has no such rule: `src/systems/trade/index.ts` charges `REP_BANDIT_KILLED` (−1, `caravan-goods.md` § Reputation events, "Hillfolk bandit killed") on every `CreatureDied` of a `hillfolk_bandit`, whatever its killer: a Hillfolk caravan's own guards, a wild animal, a Gloam raid, a fall or a drowning. The two rules now disagree: a bandit the fortress never touched costs it reputation, a Hillfolk merchant its guards shoot does not.

## What to do

Decisions:

- **A Hillfolk bandit's death costs `REP_BANDIT_KILLED` only when the fortress caused it**, by the same rule and the same helper as a caravan member's death (`fortressKilled` in `trade/index.ts`: the killer, as the bandit dies, is a fortress creature or a building).

Spec: 20 § Movement step 5 or § Reputation effects (name the bandit with the blame rule), `03-content/caravan-goods.md` § Reputation events (the bandit row; re-export `reputationEvents.json`).

## Done

- [ ] Tests (`describe` with the task id): a bandit killed by a dwarf costs 1; one killed by a wild animal, or with no killer, costs nothing.
- [ ] The sweep on GitHub (reputation drives caravans), pooled row and verdict in the commit.
