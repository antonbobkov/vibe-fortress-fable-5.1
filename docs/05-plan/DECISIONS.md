# Decision Log

Ambiguities resolved during implementation, per the protocol in [`00-agent-workflow.md`](00-agent-workflow.md) § Ambiguity protocol. Append only. Ids are `D-<nnn>`.

| Id | Date | Task | Question | Choice | Spec consulted | Pinning test |
|---|---|---|---|---|---|---|
| D-001 | 2026-09-17 | T-M0-01 | `tooling.md` says the boundary zones are implemented with `eslint-plugin-import`'s `no-restricted-paths`, but that rule resolves specifiers to files and cannot see TypeScript path aliases without `eslint-import-resolver-typescript`, which is not in the allowed dev-dependency list. | Enforce every boundary row twice: with the core `no-restricted-imports` rule over the alias specifiers (the only form source files use, and the form `tech-stack.md` names), and with `import/no-restricted-paths` zones for relative cross-layer imports. No boundary row is loosened. | `tooling.md` § ESLint boundaries, `tech-stack.md` § Layer boundary enforcement, `01-testing-strategy.md` § Dev dependencies | `test/unit/tooling.test.ts` — "T-M0-01 tooling: ESLint layer boundaries" |
| D-002 | 2026-09-17 | T-M0-01 | `tooling.md` asks for `no-restricted-globals` for `Math.random`, `Date` and `performance`, but `no-restricted-globals` bans whole identifiers; banning `Math` would ban `Math.floor`. | `Date` and `performance` are banned as globals; `Math.random`, `Date.now` and `performance.now` are banned with `no-restricted-properties`. Same coverage, no collateral ban. | `tooling.md` § ESLint boundaries, `simulation-core.md` § Random numbers | `test/unit/tooling.test.ts` — "T-M0-01 tooling: determinism rules" |
| D-003 | 2026-09-17 | T-M0-01 | `tooling.md` forbids `for...of` over `Map`/`Set` in `src/core` and `src/systems`; a syntactic rule cannot tell a `Map` from an array without type information. | Ban the iterator-method form (`for (const k of m.keys()/.values()/.entries())`, and `.forEach`) with `no-restricted-syntax`, excluding `Object`, `Array` and `Reflect` receivers. The bare `for (const x of map)` form is not detectable and is covered by review and by the determinism scenario. | `tooling.md` § ESLint boundaries, `simulation-core.md` § Determinism | `test/unit/tooling.test.ts` — "for...of over a Map iterator method fails lint in src/core" |
| D-004 | 2026-09-17 | T-M0-01 | `tooling.md` lists no `@types/node`, but `vite.config.ts`, `playwright.config.ts`, the `scripts/` harness and the unit tests need Node's built-in module types to typecheck. | Add `@types/node` as a dev dependency. It is type-only: it adds no runtime code and no runtime dependency, which is the constraint the plan actually states. | `tooling.md` § package.json, `01-testing-strategy.md` § Tiers | `npm run typecheck` (whole suite) |

## Contradictions

Spec test versus spec rule conflicts, per the protocol. Append only.

| Id | Date | Task | Rule | Test | Resolution |
|---|---|---|---|---|---|
| — | — | — | (none yet) | — | — |

## Balance findings (M8 only)

Measured values that differ from `03-content/balance.md` by more than 30%. Constants are not changed by agents.

| Id | Seeds | Region | Measure | Model | Measured | Constant that would move it |
|---|---|---|---|---|---|---|
| — | — | — | (none yet) | — | — | — |
