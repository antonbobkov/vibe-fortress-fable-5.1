# T-190 — The bandage_animal job is not produced for wounded tame animals

**Source:** T-152 and its run of `hospital_run.scenario.ts` · **Size:** S · **Needs:** — · **Status:** open

## Why

[`docs/03-content/jobs.md`](../03-content/jobs.md) § Animals and [`docs/03-content/skills-and-professions.md`](../03-content/skills-and-professions.md) specify a `bandage_animal` job (labor `animal_care`, skill `animal_care`, target `entity`, work tile `entity`, duration 100 ticks):
> `| bandage_animal | Bandage animal | animal_care | animal_care | entity | entity | 100 | - | 6 | no |`

However, in `src/systems/health/producer.ts:320–349`, when a tame animal is bleeding, the health job producer creates a job with `type: 'stop_bleeding'` and `data: { labor: 'animal_care', patient: animalId }`:
```ts
sink.create(key, {
  type: 'stop_bleeding',
  target: { kind: 'entity', ref: animalId },
  workTile: 'adjacent',
  priority: 1,
  inputs: [ ... ],
  data: { labor: 'animal_care', patient: animalId },
});
```
Because the created job type is `'stop_bleeding'` rather than `'bandage_animal'`, the registered `bandage_animal` job type is never produced or completed during gameplay, and scenarios asserting `bandage_animal` cannot observe that job type.

## Reproduction

In scenario `hospital_run` (seed `hospital-run`, flat-test), wounded animals from the embark party produce `JobCreated` and `JobCompleted` events with `jobType: 'stop_bleeding'` rather than `'bandage_animal'`.

Read:
- `src/systems/health/producer.ts:320–349` (`HealthProducer.produce`) creates `type: 'stop_bleeding'` for tame animals.
- `src/content/jobTypes.json` defines both `stop_bleeding` (labor `medicine`) and `bandage_animal` (labor `animal_care`).
- `docs/03-content/jobs.md` § Animals specifies `bandage_animal`.

## What to do

1. Change `src/systems/health/producer.ts:329` to produce `type: 'bandage_animal'` instead of `type: 'stop_bleeding'` for bleeding tame animals.
2. In `HealthProducer.onComplete` (`src/systems/health/producer.ts:411–425`), handle `bandage_animal` to bandage the animal's bleeding wounds and emit the appropriate event or completion.
3. In `HealthProducer.workCentiTicks` (`src/systems/health/producer.ts:39–59`), return `100 * 100` for `bandage_animal` per `docs/03-content/jobs.md`.
4. Add a test in `test/unit/health/` or `test/scenarios/` verifying that a bleeding tame animal causes a `bandage_animal` job to be produced and completed by a dwarf with `animal_care` labor enabled.

## Done

- Bleeding tame animals produce and complete `bandage_animal` jobs.
- `npm test` passes.
