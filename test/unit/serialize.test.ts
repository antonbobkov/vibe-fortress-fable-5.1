import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  SerializationError,
  base64ToBytes,
  bytesToBase64,
  deserializeJson,
  deserializeValue,
  migrateCore,
  serializeJson,
  serializeValue,
  typedArrayCode,
  typedArrayFromBytes,
  typedArrayBytes,
} from '@core/serialize';

describe('T-M0-10 serialize: base64', () => {
  it('matches the published vectors of RFC 4648', () => {
    const cases: [string, string][] = [
      ['', ''],
      ['f', 'Zg=='],
      ['fo', 'Zm8='],
      ['foo', 'Zm9v'],
      ['foob', 'Zm9vYg=='],
      ['fooba', 'Zm9vYmE='],
      ['foobar', 'Zm9vYmFy'],
    ];
    for (const [text, encoded] of cases) {
      const bytes = new TextEncoder().encode(text);
      expect(bytesToBase64(bytes)).toBe(encoded);
      expect(new TextDecoder().decode(base64ToBytes(encoded))).toBe(text);
    }
  });

  it('round-trips arbitrary bytes', () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 500 }), (bytes) => {
        expect([...base64ToBytes(bytesToBase64(bytes))]).toEqual([...bytes]);
        return true;
      }),
      { numRuns: 120 },
    );
  });

  it('refuses a character outside the alphabet', () => {
    expect(() => base64ToBytes('ab*d')).toThrow(SerializationError);
  });
});

describe('T-M0-10 serialize: typed arrays', () => {
  it('keeps the element type and every value through a marker round-trip', () => {
    const arrays = [
      new Uint8Array([0, 1, 254, 255]),
      new Uint16Array([0, 1000, 65535]),
      new Uint32Array([0, 1, 4294967295]),
      new Int8Array([-128, 0, 127]),
      new Int16Array([-32768, 0, 32767]),
      new Int32Array([-2147483648, 0, 2147483647]),
    ];
    for (const array of arrays) {
      const marker = serializeValue(array) as { $type: string; $b64: string };
      expect(marker.$type).toBe(typedArrayCode(array));
      const back = deserializeValue(marker) as typeof array;
      expect(back.constructor).toBe(array.constructor);
      expect([...back]).toEqual([...array]);
    }
  });

  it('typed arrays nested inside state survive a JSON round-trip', () => {
    const state = { stateVersion: 1, level: new Uint8Array([3, 4, 5]), nested: { xp: new Uint16Array([9]) } };
    const back = deserializeJson(serializeJson(state)) as typeof state;
    expect([...back.level]).toEqual([3, 4, 5]);
    expect(back.level).toBeInstanceOf(Uint8Array);
    expect([...back.nested.xp]).toEqual([9]);
  });

  it('bytes of the wrong length for the element type are refused', () => {
    expect(() => typedArrayFromBytes('u16', new Uint8Array([1, 2, 3]))).toThrow(SerializationError);
  });

  it('typedArrayBytes views the array without copying its values', () => {
    const array = new Uint16Array([0x0102, 0x0304]);
    const bytes = typedArrayBytes(array);
    expect(bytes.byteLength).toBe(4);
    expect(typedArrayFromBytes('u16', bytes)).toEqual(array);
  });
});

describe('T-M0-10 serialize: canonical order', () => {
  it('a Map becomes a sorted array of pairs whatever the insertion order', () => {
    const forwards = new Map<number, string>([
      [1, 'a'],
      [2, 'b'],
      [3, 'c'],
    ]);
    const backwards = new Map<number, string>([
      [3, 'c'],
      [1, 'a'],
      [2, 'b'],
    ]);
    expect(serializeValue(forwards)).toEqual([
      [1, 'a'],
      [2, 'b'],
      [3, 'c'],
    ]);
    expect(serializeJson(backwards)).toBe(serializeJson(forwards));
  });

  it('numeric Map keys sort numerically, not as text', () => {
    const map = new Map<number, number>([
      [10, 0],
      [9, 0],
      [100, 0],
    ]);
    expect((serializeValue(map) as [number, number][]).map(([k]) => k)).toEqual([9, 10, 100]);
  });

  it('a Set becomes a sorted array', () => {
    expect(serializeValue(new Set(['pear', 'apple', 'fig']))).toEqual(['apple', 'fig', 'pear']);
  });

  it('object keys are written in sorted order, so equal states give equal bytes', () => {
    expect(serializeJson({ b: 1, a: 2 })).toBe(serializeJson({ a: 2, b: 1 }));
    expect(serializeJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it('undefined fields are dropped and null is kept', () => {
    expect(serializeJson({ a: undefined, b: null })).toBe('{"b":null}');
  });
});

describe('T-M0-10 serialize: only plain data', () => {
  it('refuses class instances, functions and non-finite numbers', () => {
    class Thing {
      x = 1;
    }
    expect(() => serializeValue(new Thing())).toThrow(SerializationError);
    expect(() => serializeValue(() => 1)).toThrow(SerializationError);
    expect(() => serializeValue(Number.NaN)).toThrow(SerializationError);
    expect(() => serializeValue(Number.POSITIVE_INFINITY)).toThrow(SerializationError);
  });

  it('a nested plain structure round-trips unchanged', () => {
    const state = {
      stateVersion: 1,
      designations: [{ tile: 5, kind: 1, priority: 5 }],
      forbiddenTiles: [9, 4, 7],
      flags: { locked: true, note: 'ok' },
    };
    expect(deserializeJson(serializeJson(state))).toEqual(state);
  });
});

describe('T-M0-10 serialize: core migrations', () => {
  it('there are none for the first published format version', () => {
    expect(migrateCore({ a: 1 }, 1, 1)).toEqual({ a: 1 });
    expect(() => migrateCore({}, 1, 2)).toThrow(SerializationError);
  });
});
