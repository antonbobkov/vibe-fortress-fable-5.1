import { describe, expect, it } from 'vitest';
import ts from 'typescript';

type Surface = { reader: string[]; events: string[]; commands: string[] };
const api = await import(new URL('../../scripts/interface-check.mjs', import.meta.url).href) as {
  documentedInterfaces(doc: string): Surface;
  differences(actual: Surface, expected: Surface): string[];
  emissions(source: ts.SourceFile, checker: ts.TypeChecker): string[];
  methods(checker: ts.TypeChecker, declaration: ts.InterfaceDeclaration, namespace: string): string[];
  audit(): { id: string; differences: string[] }[];
  noteLines(markdown: string, label: string): string[];
  implementationNotes(directory?: string): string[];
};

function fixture(text: string) {
  const source = ts.createSourceFile('fixture.ts', text, ts.ScriptTarget.ES2022, true);
  const host = ts.createCompilerHost({ noLib: true });
  host.getSourceFile = (name) => name === 'fixture.ts' ? source : undefined;
  const program = ts.createProgram(['fixture.ts'], { noLib: true }, host);
  return { source, checker: program.getTypeChecker() };
}

describe('T-M8-08 interface audit', () => {
  it('reads only Interfaces declarations; a parenthesis or a consuming subsection is a reference', () => {
    const doc = '## Rules\n`Wrong`\n## Interfaces\n### Reader\n`items.get(id)` (uses `Other`)\n' +
      '### Commands\n`Local`. (`Delegated` is owned by 14.)\n### Events consumed\n`Incoming`\n### Events emitted\n`Created`\n' +
      '## State\n`AlsoWrong`\n';
    expect(api.documentedInterfaces(doc)).toEqual({ reader: ['items.get'], events: ['Created'], commands: ['Local'] });
    expect(() => api.documentedInterfaces('## Rules\n')).toThrow('missing Interfaces');
  });

  it('reports omissions in both directions for all three categories', () => {
    expect(api.differences({ reader: ['a.new'], events: ['New'], commands: ['NewCmd'] },
      { reader: ['a.old'], events: ['Old'], commands: ['OldCmd'] })).toEqual([
      'reader undocumented: a.new', 'reader missing in code: a.old',
      'events undocumented: New', 'events missing in code: Old',
      'commands undocumented: NewCmd', 'commands missing in code: OldCmd',
    ]);
  });

  it('includes inherited queries while excluding fields', () => {
    const { source, checker } = fixture('interface Base { get(id: number): number; } export interface FooReader extends Base { size: number; list(): number; }');
    const declaration = source.statements[1] as ts.InterfaceDeclaration;
    expect(api.methods(checker, declaration, 'foo').sort()).toEqual(['foo.get', 'foo.list']);
  });

  it('finds actual dispatches through factories, conditional types and notification callbacks', () => {
    const { source, checker } = fixture(`
      type EventType = 'Made' | 'A' | 'B' | 'NotDispatched' | 'Callback';
      interface GameEvent { type: EventType; }
      declare const flag: boolean;
      declare const emit: (e: GameEvent) => void;
      declare const notify: (job: number, e: GameEvent) => void;
      function factory(): {type: 'Made'} { return {type: 'Made'}; }
      function unused(): {type: 'NotDispatched'} { return {type: 'NotDispatched'}; }
      function forward(e: GameEvent) { emit(e); }
      emit(factory()); emit({type: flag ? 'A' : 'B'});
      notify(42, {type: 'Callback'});
    `);
    expect(api.emissions(source, checker)).toEqual(['A', 'B', 'Callback', 'Made']);
  });

  it('T-102: a note is not a set delta: it no longer subtracts a cross-owner reference', () => {
    const doc = '## Interfaces\n### Commands\n`Local`, `Delegated`\n' +
      'Implementation note: commands references: `Delegated`; audited.\n';
    expect(api.documentedInterfaces(doc).commands).toEqual(['Delegated', 'Local']);
    expect(api.differences({ reader: [], events: [], commands: ['Local'] }, api.documentedInterfaces(doc)))
      .toEqual(['commands missing in code: Delegated']);
  });

  it('T-102: a line that starts with "Implementation note:" fails, named by file and line', () => {
    expect(api.noteLines('# Title\n\nImplementation note: pinned beside the text.\nMid-line Implementation note: is prose.\n\r\nImplementation note: again.', 'docs/x.md'))
      .toEqual(['docs/x.md:3', 'docs/x.md:6']);
    expect(api.implementationNotes()).toEqual([]);
  });

  it('audits every system document without differences', () => {
    const results = api.audit();
    expect(results.map((r) => r.id)).toEqual(Array.from({ length: 25 }, (_, n) => String(n + 1).padStart(2, '0')));
    expect(results.flatMap((r) => r.differences.map((d) => `${r.id}: ${d}`))).toEqual([]);
  });
});
