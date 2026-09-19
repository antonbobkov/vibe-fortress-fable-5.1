/**
 * Files: the export download and the import picker of `01-architecture/persistence.md` § Export
 * and import ("Export writes the blob as a file … through a Blob download"; "Import reads a
 * file"). The DOM lives in `platform`; the app passes bytes in and gets bytes back.
 */

export interface FileBridge {
  /** Offer `bytes` to the player as a file named `name`. */
  download(name: string, bytes: Uint8Array): void;
  /** Let the player pick a file; resolves with its bytes, or null when nothing was picked. */
  pick(accept: string): Promise<Uint8Array | null>;
}

/** The browser implementation: an object URL on a temporary link, and a hidden file input. */
export function browserFiles(doc: Document): FileBridge {
  return {
    download(name, bytes) {
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      const url = URL.createObjectURL(new Blob([copy.buffer], { type: 'application/octet-stream' }));
      const link = doc.createElement('a');
      link.href = url;
      link.download = name;
      doc.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    },
    pick(accept) {
      return new Promise((resolve) => {
        const input = doc.createElement('input');
        input.type = 'file';
        input.accept = accept;
        input.style.display = 'none';
        input.addEventListener('change', () => {
          const file = input.files?.[0];
          input.remove();
          if (file === undefined) {
            resolve(null);
            return;
          }
          void file.arrayBuffer().then((buffer) => resolve(new Uint8Array(buffer)));
        });
        input.addEventListener('cancel', () => {
          input.remove();
          resolve(null);
        });
        doc.body.appendChild(input);
        input.click();
      });
    },
  };
}
