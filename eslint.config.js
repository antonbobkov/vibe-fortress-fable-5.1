// ESLint flat configuration.
//
// Implements `04-implementation/tooling.md` § ESLint boundaries: one zone per row of the
// `boundaries` table, the restricted globals, the `for...of` over Map/Set ban and
// `@typescript-eslint/switch-exhaustiveness-check`.
//
// See DECISIONS.md D-001: the boundary rows are enforced with the core `no-restricted-imports`
// rule over the path-alias specifiers (the only form source files use), plus
// `import/no-restricted-paths` for relative cross-layer imports; `eslint-plugin-import`'s
// resolver cannot see TypeScript path aliases without an extra dependency, which the plan forbids.
// See D-002 for `Math.random` / `Date.now` being expressed with `no-restricted-properties`.

import { readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import importPlugin from 'eslint-plugin-import';

const here = fileURLToPath(new URL('.', import.meta.url));

/** Every system directory under src/systems, used for the "no other system's state" rule. */
function systemDirs() {
  const dir = new URL('./src/systems/', import.meta.url);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

/** Expand an alias prefix into the specifier patterns that reach it. */
function reach(alias) {
  return [alias, `${alias}/*`, `${alias}/**`];
}

function denyImports(groups, message) {
  return ['error', { patterns: groups.map((group) => ({ group, message })) }];
}

const LAYER_MSG = 'Layer boundary (tooling.md ESLint boundaries).';

const boundaryConfigs = [
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': denyImports(
        [
          reach('@systems'),
          reach('@render'),
          reach('@ui'),
          reach('@app'),
          reach('@content'),
          ['@platform', '@platform/*', '@platform/**', '!@platform/interfaces'],
        ],
        `src/core may import only @platform/interfaces. ${LAYER_MSG}`,
      ),
    },
  },
  {
    files: ['src/content/**/*.ts'],
    rules: {
      'no-restricted-imports': denyImports(
        [reach('@systems'), reach('@render'), reach('@ui'), reach('@app'), reach('@platform')],
        `src/content may not import systems, render, ui, app or platform. ${LAYER_MSG}`,
      ),
    },
  },
  {
    files: ['src/systems/**/*.ts'],
    rules: {
      'no-restricted-imports': denyImports(
        [
          reach('@render'),
          reach('@ui'),
          reach('@app'),
          reach('@platform'),
          ...systemDirs().map((self) => [
            '@systems/*/state',
            '@systems/*/state/**',
            `!@systems/${self}/state`,
            `!@systems/${self}/state/**`,
          ]),
        ],
        `A system may not import render, ui, app, platform, or another system's state. ${LAYER_MSG}`,
      ),
    },
  },
  {
    files: ['src/render/**/*.ts'],
    rules: {
      'no-restricted-imports': denyImports(
        [
          reach('@app'),
          ['@platform/storage', '@platform/storage/**'],
          ['@systems/*/state', '@systems/*/state/**'],
          ['@systems/*/tick', '@systems/*/tick/**'],
          ['@systems/*/rules', '@systems/*/rules/**'],
        ],
        `src/render may not import app, @platform/storage, or a system's state/tick/rules. ${LAYER_MSG}`,
      ),
    },
  },
  {
    files: ['src/ui/**/*.ts'],
    rules: {
      'no-restricted-imports': denyImports(
        [
          reach('@app'),
          ['@systems/*/state', '@systems/*/state/**'],
          ['@systems/*/tick', '@systems/*/tick/**'],
          ['@systems/*/rules', '@systems/*/rules/**'],
        ],
        `src/ui may not import app, or a system's state/tick/rules. ${LAYER_MSG}`,
      ),
    },
  },
];

/** Relative-path form of the same zones, for imports written as `../core/x`. */
const restrictedPathZones = [
  { target: './src/core', from: './src/systems' },
  { target: './src/core', from: './src/render' },
  { target: './src/core', from: './src/ui' },
  { target: './src/core', from: './src/app' },
  { target: './src/core', from: './src/content' },
  { target: './src/content', from: './src/systems' },
  { target: './src/content', from: './src/render' },
  { target: './src/content', from: './src/ui' },
  { target: './src/content', from: './src/app' },
  { target: './src/content', from: './src/platform' },
  { target: './src/systems', from: './src/render' },
  { target: './src/systems', from: './src/ui' },
  { target: './src/systems', from: './src/app' },
  { target: './src/systems', from: './src/platform' },
  { target: './src/render', from: './src/app' },
  { target: './src/ui', from: './src/app' },
];

const NO_DETERMINISM_BREAKERS = [
  { name: 'Date', message: 'Determinism: no wall-clock in core/systems/content (simulation-core.md).' },
  {
    name: 'performance',
    message: 'Determinism: no wall-clock in core/systems/content (simulation-core.md).',
  },
];

const NO_RANDOM_PROPERTIES = [
  { object: 'Math', property: 'random', message: 'Determinism: use core/rng.ts streams.' },
  { object: 'Date', property: 'now', message: 'Determinism: use the calendar tick.' },
  { object: 'performance', property: 'now', message: 'Determinism: no wall-clock in the simulation.' },
];

// `for (const x of someMap)` cannot be recognised without type information; this catches the
// iterator-method form, which is the one that actually appears in code. See DECISIONS.md D-003.
const NO_UNORDERED_ITERATION = [
  {
    selector:
      "ForOfStatement > CallExpression.right[callee.property.name=/^(keys|values|entries|forEach)$/]:not([callee.object.name='Object']):not([callee.object.name='Array']):not([callee.object.name='Reflect'])",
    message:
      'Iterate shared state through the sorted helpers in core/ (simulation-core.md § Determinism).',
  },
];

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'reports/**',
      'coverage/**',
      'test-results/**',
      'playwright-report/**',
      'src/content/*.json',
    ],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: {} },
      globals: {
        console: 'readonly',
        globalThis: 'readonly',
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        queueMicrotask: 'readonly',
        indexedDB: 'readonly',
        IDBDatabase: 'readonly',
        IDBOpenDBRequest: 'readonly',
        IDBRequest: 'readonly',
        CompressionStream: 'readonly',
        DecompressionStream: 'readonly',
        Response: 'readonly',
        Blob: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        HTMLCanvasElement: 'readonly',
        CanvasRenderingContext2D: 'readonly',
        OffscreenCanvas: 'readonly',
        ImageData: 'readonly',
        KeyboardEvent: 'readonly',
        MouseEvent: 'readonly',
        WheelEvent: 'readonly',
        Event: 'readonly',
        performance: 'readonly',
        process: 'readonly',
        URL: 'readonly',
        structuredClone: 'readonly',
        btoa: 'readonly',
        atob: 'readonly',
      },
    },
    plugins: { '@typescript-eslint': tsPlugin, import: importPlugin },
    settings: {
      'import/resolver': { node: { extensions: ['.ts', '.js', '.mjs', '.json'] } },
    },
    rules: {
      ...tsPlugin.configs['eslint-recommended'].overrides[0].rules,
      ...tsPlugin.configs.recommended.rules,
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      'no-undef': 'off',
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-const-assign': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-duplicate-case': 'error',
      'no-unreachable': 'error',
      'no-fallthrough': 'error',
      'no-debugger': 'error',
      'no-cond-assign': 'error',
      'no-self-compare': 'error',
      'no-constant-condition': ['error', { checkLoops: false }],
      'import/no-restricted-paths': ['error', { zones: restrictedPathZones }],
    },
  },
  ...boundaryConfigs,
  {
    files: ['src/core/**/*.ts', 'src/systems/**/*.ts', 'src/content/**/*.ts'],
    rules: {
      'no-restricted-globals': ['error', ...NO_DETERMINISM_BREAKERS],
      'no-restricted-properties': ['error', ...NO_RANDOM_PROPERTIES],
      'no-restricted-syntax': ['error', ...NO_UNORDERED_ITERATION],
    },
  },
  {
    // Type-aware rules. Scoped to real sources; transient lint fixtures are excluded because
    // they are not part of the TypeScript project.
    files: ['src/**/*.ts', 'test/**/*.ts'],
    ignores: ['**/*.lintfixture.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { project: './tsconfig.json', tsconfigRootDir: here },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
    },
  },
  {
    files: ['test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    files: ['scripts/**/*.mjs', '*.config.js', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { console: 'readonly', process: 'readonly', URL: 'readonly', globalThis: 'readonly' },
    },
    rules: {
      'no-undef': 'error',
    },
  },
];
