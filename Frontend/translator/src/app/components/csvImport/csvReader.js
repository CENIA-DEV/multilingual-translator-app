/* Copyright 2026 Centro Nacional de Inteligencia Artificial (CENIA, Chile). All rights reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License. */

import Papa from 'papaparse';

// The file is read this many bytes at a time, so a file of any size is never
// in memory whole
const CHUNK_BYTES = 1024 * 1024;
// What the format step looks at
const HEAD_BYTES = 64 * 1024;

const hasContent = (row) => row.some((value) => value.trim() !== '');

/** The line break of a text: \r\n, \r or \n (the first one found). */
function guessNewline(text) {
  const match = text.match(/\r\n|\r|\n/);
  return match ? match[0] : '\n';
}

function parse(text, delimiter, newline, ignoreLastRow) {
  const result = new Papa.Parser({ delimiter, newline }).parse(text, 0, ignoreLastRow);
  return { rows: result.data, cursor: result.meta.cursor };
}

/**
 * The beginning of the file as text, and whether there is more after it.
 * TextDecoder in stream mode drops a character the cut splits in two.
 */
export async function readHead(file, encoding) {
  const bytes = await file.slice(0, HEAD_BYTES).arrayBuffer();
  const text = new TextDecoder(encoding).decode(bytes, { stream: true });
  return { text, truncated: file.size > HEAD_BYTES };
}

/** The delimiter that splits the head into the most consistent columns. */
export function guessDelimiter(text) {
  return Papa.parse(text, { preview: 20 }).meta.delimiter || ',';
}

/** The first rows of the head, split with this delimiter. */
export function parseHead({ text, truncated }, delimiter, count) {
  // a cut row at the end is left out, as it will not look like that in the file
  return parse(text, delimiter, guessNewline(text), truncated).rows.filter(hasContent).slice(0, count);
}

/**
 * Every row of the file, in order, as arrays of strings: `onRows` gets them a
 * chunk at a time and is awaited, so the reading waits for whatever it does
 * (an upload) and never runs ahead of it. Rows with nothing in them are left
 * out. `onRows` also gets `progressAt(i)`: how far into the file (0 to 1) its
 * i-th row is, for a progress bar that moves while a chunk is processed. Each
 * chunk is decoded with one streaming TextDecoder, so a character
 * split between two chunks arrives whole, and the last row of a chunk, which
 * may be incomplete (a quoted text can hold line breaks), waits for the next.
 */
export async function readRows(file, { encoding, delimiter, onRows, onProgress, signal }) {
  const decoder = new TextDecoder(encoding);
  let partial = '';
  let newline = null;
  let offset = 0;
  for (;;) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const end = Math.min(offset + CHUNK_BYTES, file.size);
    const last = end >= file.size;
    const bytes = await file.slice(offset, end).arrayBuffer();
    const text = partial + decoder.decode(bytes, { stream: !last });
    newline = newline || (text ? guessNewline(text) : null);
    const { rows, cursor } = parse(text, delimiter, newline || '\n', !last);
    partial = last ? '' : text.substring(cursor);
    const complete = rows.filter(hasContent);
    const size = file.size || 1;
    const progressAt = (i) => (offset + ((end - offset) * (i + 1)) / complete.length) / size;
    if (complete.length) await onRows(complete, progressAt);
    offset = end;
    if (onProgress) onProgress(file.size ? offset / file.size : 1);
    if (last) return;
  }
}
