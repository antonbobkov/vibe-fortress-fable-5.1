# T-NEW — A hillfolk caravan stuck on its way to the depot

**Source:** T-539's sweep (run 42782003867) · **Size:** S · **Needs:** — · **Status:** open

## Why

In T-539's sweep, seed p2-2 at shifts 100 and 150 failed a caravan invariant: a hillfolk caravan stayed stuck on its way to the depot for 20 days. The verdict passed, since this fails only the seed's own job, and nobody looked at why.

## What to do

Reproduce p2-2 at shift 100 on GitHub (as T-530's and T-536's probes did), find what holds the caravan (a door, an alert, a walled depot, a path the labels join but a walk cannot take), and fix the rule or the script at its root, with a test. Write the rule in the trade spec if it changes.

## Done

- p2-2 at shifts 100 and 150 passes its seed job in the pooled sweep, and the verdict passes.
