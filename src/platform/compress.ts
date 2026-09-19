/**
 * Deflate for the save container.
 *
 * `01-architecture/persistence.md` § Container format: "The body is compressed with
 * `CompressionStream('deflate-raw')` when available." When it is not, the body is written raw and
 * the header's `compressed` flag says so, which is the case `save-format.md` already allows.
 *
 * This is the only module that touches the compression globals; `core` never does.
 */

export interface Compressor {
  /** False when the platform has no `CompressionStream`; the body is then stored raw. */
  readonly available: boolean;
  deflateRaw(bytes: Uint8Array): Promise<Uint8Array>;
  inflateRaw(bytes: Uint8Array): Promise<Uint8Array>;
}

type StreamCtor = new (format: string) => { readable: unknown; writable: unknown };

function ctor(name: 'CompressionStream' | 'DecompressionStream'): StreamCtor | undefined {
  const holder = globalThis as unknown as Record<string, unknown>;
  const found = holder[name];
  return typeof found === 'function' ? (found as StreamCtor) : undefined;
}

async function through(stream: { readable: unknown; writable: unknown }, bytes: Uint8Array): Promise<Uint8Array> {
  const writable = stream.writable as { getWriter(): { write(chunk: Uint8Array): Promise<void>; close(): Promise<void> } };
  const writer = writable.getWriter();
  const pump = (async (): Promise<void> => {
    await writer.write(bytes);
    await writer.close();
  })();
  // A corrupt body fails on both sides; the reading side's error is the one reported, and the
  // writing side's must not surface as an unhandled rejection (`persistence.md` § Failure handling).
  pump.catch(() => undefined);
  const body = await new Response(stream.readable as BodyInit).arrayBuffer();
  await pump;
  return new Uint8Array(body);
}

/** The platform compressor: real deflate when the browser or runtime offers it, else a pass-through. */
export const compressor: Compressor = {
  get available(): boolean {
    return ctor('CompressionStream') !== undefined && ctor('DecompressionStream') !== undefined;
  },
  async deflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
    const Ctor = ctor('CompressionStream');
    if (Ctor === undefined) return bytes;
    return through(new Ctor('deflate-raw'), bytes);
  },
  async inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
    const Ctor = ctor('DecompressionStream');
    if (Ctor === undefined) return bytes;
    return through(new Ctor('deflate-raw'), bytes);
  },
};

/** A compressor that never compresses; used by tests and by the export path when asked for raw. */
export const noCompressor: Compressor = {
  available: false,
  deflateRaw: (bytes) => Promise.resolve(bytes),
  inflateRaw: (bytes) => Promise.resolve(bytes),
};
