# T-277 — Look: a wounded dwarf's panel says what happens next; the mood is a whole number

Closed by `T-277: a wounded dwarf's Look panel says what happens next; the mood is a whole number` (4147f3d).

**Source:** T-116 and its report, [`../../reports/audits/2026-10-12-ui-ux.md`](../../../reports/audits/2026-10-12-ui-ux.md) (issue 7) · **Size:** S · **Needs:** — · **Status:** open

## Why

For a wounded dwarf the Look panel says "Health: Wounded, bleeding" and stops. It does not say whether a hospital exists, whether a medic is coming, or what is missing, so the player cannot tell whether to act. The mood line prints the raw number: "Mood: Unhappy (36.686247314646366)".

## Reproduction

`test/fixtures/reference-fortress.deepholm`, step 1,200 ticks (a raid wounds a dwarf). `u`, move to Hrolf Brighteye, `Enter`, `3` (capture 3/23, `23-t3-creature-tab.png`). Code: `src/ui/panels/look.ts:205` (the mood), `:211-214` (the health line for an undiagnosed patient).

## What the spec says

- [`17-health-and-medicine.md`](../../02-systems/17-health-and-medicine.md): the steps of treatment (rescue, diagnosis, cleaning, suture, bandage, splint) and what each needs.
- [`panels.md`](../../04-implementation/ui-screens/panels.md) § Look (creature tab).

## What to do

**Decisions.**
- **Mood.** "Mood: Unhappy (37)": the number is rounded to a whole number, as the thoughts under it already are.
- **Treatment line.** Under the Health line of any dwarf who is a patient or has an untreated wound, one line in the alert colour when the player must act and the normal colour otherwise. The first that applies:
  1. no hospital zone: "Care: no hospital. Make one in Zones [z] › Hospital."
  2. the hospital has no free bed: "Care: no free hospital bed."
  3. no living dwarf has the medicine labor on: "Care: no one has Medicine enabled ([l] Labors)."
  4. waiting to be carried: "Care: waiting to be carried to the hospital."
  5. a treatment job exists and has a worker: "Care: {job} by {name}." (for example "Care: diagnosis by Snorri Pinesong.")
  6. a treatment is blocked for a supply: "Care: needs {item} (0 in stock)."
  7. waiting for a medic: "Care: waiting for a medic."
  8. all wounds treated: "Care: resting until healed."
- The line reads 17's reader and the job board; if 17's reader lacks one of these facts, the task adds a read-only method to it and lists it in 17 § Interfaces. It changes no rule of 17.
- An undiagnosed patient keeps "Health: Wounded, bleeding" (the details stay hidden until diagnosis, as 17 says).

1. Amend `panels.md` § Look and, if a reader method is added, 17 § Interfaces.
2. Implement in `src/ui/panels/look.ts`, the strings, and `src/systems/health/` only for the reader method.
3. Tests, `describe('T-277 …')`: the rounded mood; one test per treatment line.

## Done

- The reproduction shows "Mood: Unhappy (37)" and a Care line that names the missing hospital.
- The verification commands of [`../process/agent-workflow.md`](../../process/agent-workflow.md) are green.
