# T-513 — The twenty-seed sweep judges pooled shifted samples, like the instrument

**Closed:** 2026-11-06, in 68bfda83.

**Source:** T-507's [report](../../../reports/audits/2026-11-05-t507-three-years-food.md) and T-509's [report](../../../reports/audits/2026-11-05-t509-instrument-noise.md) · **Size:** M · **Needs:** — · **Status:** open

## Why

T-507 found the sweep as noisy as the annual instrument: a shift of one or two ticks on unchanged code moves total deaths by up to 70 and living by up to 149. So one sweep cannot judge a change smaller than that, and T-482's sweep looked like a regression that three samples showed was mostly chance. T-509 fixed this for the instrument by pooling eight shifted samples in one command.

## What to do

- Give the sweep the same shape: a `shifts` input to `measure.yml`'s sweep suite, so one command plays N shifted timelines of all twenty seeds in parallel, and a verdict job that pools them.
- Keep the set rule, read over the pooled samples in a form that is strict enough to catch a real regression and does not flip on chance (T-509's method: split shifted samples of unchanged code into halves to set tolerances).
- Measure the noise on current master, set the reference, and write the rule into `testing-strategy.md`, `balance.md`, `tooling.md` and `agent-workflow.md`.
- Mind the runner budget: 20 seeds × N shifts queue on GitHub's free runners; pick N and say how long a verdict takes.

## Done

- One command gives a pooled sweep verdict; the docs say how to read it; the reference is set from current master.
