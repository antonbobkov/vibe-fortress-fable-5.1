/** T-176: deterministic seed records shared by the perf output and frozen gate reports. */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export function seedHashes(text) {
  const records = [];
  for (const line of text.split(/\r?\n/)) {
    const match = /\[three_years_hash\] (\{.*\})/.exec(line);
    if (!match) continue;
    const record = JSON.parse(match[1]);
    if (
      typeof record.seed !== 'string' ||
      !Number.isInteger(record.peril) ||
      !Number.isInteger(record.tick) ||
      typeof record.hash !== 'string'
    )
      throw new Error('invalid three_years_hash record');
    records.push(record);
  }
  return records;
}

export function previousSeedGate(directory) {
  const reports = readdirSync(directory)
    .filter((name) => name.endsWith('-gate.md'))
    .map((name) => {
      const text = readFileSync(join(directory, name), 'utf8');
      return {
        name,
        recorded: /^Recorded: (.+)$/m.exec(text)?.[1] ?? '',
        records: seedHashes(text),
      };
    })
    .filter((report) => report.records.length > 0);
  reports.sort(
    (a, b) =>
      a.recorded.localeCompare(b.recorded) ||
      a.name.localeCompare(b.name, undefined, { numeric: true }),
  );
  return reports.at(-1) ?? null;
}

export function compareSeedHashes(current, previous) {
  return current.map((record) => {
    const old = previous.find(
      (p) => p.seed === record.seed && p.peril === record.peril && p.tick === record.tick,
    );
    return {
      ...record,
      previous: old?.hash ?? null,
      result: !old ? 'no comparable baseline' : old.hash === record.hash ? 'equal' : 'CHANGED',
    };
  });
}
