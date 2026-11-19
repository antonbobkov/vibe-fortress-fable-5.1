# T-NEW — Some soldiers at drill spend three-quarters of the day on needs and barely train

**Source:** [T-606's pace measurement](../../reports/audits/2026-11-18-t606-training-pace.md) · **Size:** M · **Needs:** — · **Status:** open

## Why

In the three-year fortress a soldier at drill stands at the barracks 15 to 20% of the day on average, and needs take 60% (sleep 25%, eating and drinking 18%, company, joy and comfort 18%). The average hides two kinds of soldier in each squad: two or three stand at the barracks 20 to 37% of the day and reach Proficient in five to ten weeks with T-606's `TRAIN_XP`; one to three stand there 1 to 6%, spend 70 to 80% of the day on needs (more sleep, longer hunger and thirst errands), and stay at Novice to Competent for months (`three-years-p4-4`: six of eight never Proficient in 100 days). A player sees a soldier who never improves and no reason.

## What to do

Find what sets these soldiers apart with the probe (`test/perf/t606_pace_probe.test.ts`, its `T606_TRACE` day trace): sleeping on a dormitory floor (10 § Sleeping: less rest), the walk from their bed or the food and drink to the barracks, armour's weight on their speed, or mood. Then fix what is wrong in the engine, or, if each is a rule working as written, decide whether sparring should count as company for the social need (two dwarves sparring together), and record it in 16 § Training.

## Done

The probe's per-soldier barracks share and need shares before and after; no soldier of a squad at drill below a stated share without a reason the spec gives.
