import { describe, expect, it } from 'vitest';
import { copyFileSync, mkdtempSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const { checkExport } = await import(new URL('../../scripts/content-export-check.mjs', import.meta.url).href) as {
  checkExport(contentDir?: string): { tableCount: number; differences: string[] };
};

const root = fileURLToPath(new URL('../../', import.meta.url));
const content = join(root, 'src/content');
const files = readdirSync(content).filter((name) => name.endsWith('.json')).sort();
function fixture(run: (dir: string) => void): void {
  const dir = mkdtempSync(join(root, '.t126-content-fixture-'));
  try {
    for (const name of files) copyFileSync(join(content, name), join(dir, name));
    run(dir);
  } finally {
    const within = relative(root, dir);
    if (isAbsolute(within) || within.startsWith('..')) throw new Error('Fixture escaped the repository');
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('T-126 source exports reproduce committed content', () => {
  it('exports all fifty-seven tables into temporary storage without changing any committed byte', () => {
    const before = files.map((name) => readFileSync(join(content, name)));
    expect(checkExport()).toEqual({ tableCount: 57, differences: [] });
    expect(files.map((name) => readFileSync(join(content, name)))).toEqual(before);
  });

  it.each(['thoughts.json', 'strings.json', 'palette.json'])('rejects a manual JSON edit in %s', (name) => {
    fixture((dir) => {
      const file = join(dir, name);
      if (name === 'strings.json') {
        const data = JSON.parse(readFileSync(file, 'utf8')) as Record<string, string>;
        data['announce.caravan_arrived'] = 'Changed by hand';
        writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
      } else if (name === 'palette.json') {
        const data = JSON.parse(readFileSync(file, 'utf8')) as { id: string; hex: string; alt?: string }[];
        data.find((row) => row.id === 'hostile')!.alt = '#010203';
        writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
      } else {
        const data = JSON.parse(readFileSync(file, 'utf8')) as { id: string; trigger: { event?: string } }[];
        data.find((row) => row.id === 'dwarf_died')!.trigger.event = 'HourPassed';
        writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
      }
      expect(checkExport(dir).differences).toEqual([`${name}: differs from source export`]);
    });
  });

  it('rejects missing and unexpected tables as well as changed bytes', () => {
    fixture((dir) => {
      unlinkSync(join(dir, 'palette.json'));
      writeFileSync(join(dir, 'invented.json'), '[]\n');
      expect(checkExport(dir).differences).toEqual(['palette.json: missing committed table', 'invented.json: unexpected committed table']);
    });
  });
});
