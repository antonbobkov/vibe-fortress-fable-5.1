# T-520 — The threat system's casualty check relabels a caravan's party

**Source:** T-519's work ([findings](../archive/tasks/T-519-sweep-invariant-findings.md), archived at merge) · **Size:** S · **Needs:** — · **Status:** open

## Why

18's casualty check also runs on caravan parties, and relabels a caravan's party as `retreat` with outcome `repelled`. Nothing moves differently because of it, but the party's state is misleading in the threats panel, the save, and any rule that reads party outcomes (raid morale, defence counts, the legend).

## What to do

Make 18's casualty and morale checks skip parties whose purpose is trade, with a test, and say so in 18 § Party AI. Check that no count of repelled or looted parties included caravans.
