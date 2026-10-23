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
'use client'

import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button.jsx";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { API_ENDPOINTS } from '../../constants.js';
import api from '../../api.js';
import { guessDelimiter, parseHead, readHead, readRows } from './csvReader.js';
import { guessLanguage, useLangLabel, useMappableLanguages } from './languages.js';

const STEPS = ['Formato', 'Columnas', 'Lenguas', 'Carga'];

const DELIMITERS = [
  { value: ',', label: 'Coma ( , )' },
  { value: ';', label: 'Punto y coma ( ; )' },
  { value: '\t', label: 'Tabulación' },
  { value: '|', label: 'Barra vertical ( | )' },
  { value: 'other', label: 'Otro' },
];

const ENCODINGS = [
  { value: 'utf-8', label: 'UTF-8' },
  { value: 'windows-1252', label: 'Windows-1252 (Excel en Windows)' },
];

const FIELDS = [
  { key: 'src_text', label: 'Texto de origen', guesses: ['src_text', 'source_text', 'source', 'src', 'origen', 'texto_origen', 'texto'] },
  { key: 'tgt_text', label: 'Traducción', guesses: ['tgt_text', 'dst_text', 'target_text', 'target', 'tgt', 'dst', 'traduccion', 'traducción', 'translation'] },
  { key: 'src_lang', label: 'Lengua de origen', lang: true, guesses: ['src_lang', 'source_lang', 'src_language', 'source_language', 'lengua_origen', 'idioma_origen'] },
  { key: 'tgt_lang', label: 'Lengua de la traducción', lang: true, guesses: ['tgt_lang', 'dst_lang', 'target_lang', 'tgt_language', 'target_language', 'lengua_destino', 'idioma_destino'] },
];

// A language "column" that is not in the file: one language for every row,
// mapped like a code of the file under these keys
const FIXED = { src_lang: '\u0000origen', tgt_lang: '\u0000traduccion' };
const NO_COLUMN = 'none';

const PREVIEW_ROWS = 8;
// What a batch of rows may hold: the API takes up to 5000 rows and Django
// refuses request bodies over 2.5 MB
const BATCH_ROWS = 2000;
const BATCH_CHARS = 1000000;
// Distinct values a language column may have before it is surely another column
const MAX_CODES = 200;

const normalHeader = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
const baseName = (filename) => filename.replace(/\.[^.]+$/, '');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const formatSize = (bytes) => (bytes < 1024 * 1024
  ? `${Math.max(1, Math.round(bytes / 1024)).toLocaleString('es-CL')} KB`
  : `${(bytes / (1024 * 1024)).toLocaleString('es-CL', { maximumFractionDigits: 1 })} MB`);
const isAbort = (error) => error?.name === 'AbortError' || error?.name === 'CanceledError';

function guessColumns(header, columnCount) {
  const names = header ? header.map(normalHeader) : [];
  const columns = {};
  const taken = new Set();
  FIELDS.forEach((field, i) => {
    let index = names.findIndex((name, j) => !taken.has(j) && field.guesses.includes(name));
    if (index < 0 && !header) index = i < columnCount ? i : -1;
    if (index >= 0) taken.add(index);
    columns[field.key] = index >= 0 ? String(index) : (field.lang ? NO_COLUMN : '');
  });
  return columns;
}

function StepIndicator({ step }) {
  return (
    <ol className="flex flex-wrap gap-2 text-sm">
      {STEPS.map((name, i) => (
        <li
          key={name}
          className={`rounded-full px-3 py-1 ${i === step ? 'bg-default text-white' : i < step ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-400'}`}
        >
          {i + 1}. {name}
        </li>
      ))}
    </ol>
  );
}

function PreviewTable({ header, rows }) {
  if (!rows.length) return <p className="text-sm text-gray-500">No hay filas para mostrar.</p>;
  const width = Math.max(header?.length || 0, ...rows.map((row) => row.length));
  return (
    <div className="max-h-72 overflow-auto rounded-lg border">
      <table className="w-full text-left text-xs">
        <thead className="sticky top-0 bg-gray-100">
          <tr>
            {Array.from({ length: width }, (_, i) => (
              <th key={i} className="whitespace-nowrap border-b px-2 py-1 font-semibold">
                {header ? header[i] ?? '' : `Columna ${i + 1}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="odd:bg-white even:bg-gray-50">
              {Array.from({ length: width }, (_, i) => (
                <td key={i} className="max-w-[18rem] truncate border-b px-2 py-1" title={row[i] ?? ''}>
                  {row[i] ?? <span className="text-red-500">—</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const selectClass = 'h-9 w-full rounded-md border border-input bg-white px-2 text-sm';

function LanguageSelect({ value, onChange, languages }) {
  return (
    <select className={selectClass} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">— Ignorar estas filas —</option>
      <optgroup label="Lenguas del traductor">
        {languages.own.map((lang) => <option key={lang.code} value={lang.code}>{lang.label} ({lang.code})</option>)}
      </optgroup>
      <optgroup label="Otras lenguas">
        {languages.others.map((lang) => <option key={lang.code} value={lang.code}>{lang.label} ({lang.code})</option>)}
      </optgroup>
    </select>
  );
}

/**
 * Upload a CSV of translations: pick how it is split (with a preview), which
 * column is which, and which language each code of the file is; then it is
 * read and sent in batches, never whole, so its size does not matter.
 */
export default function ImportWizard({ file, onClose, onImported }) {
  const { toast } = useToast();
  const languages = useMappableLanguages();
  const langLabel = useLangLabel();

  const [step, setStep] = useState(0);
  const [encoding, setEncoding] = useState('utf-8');
  const [head, setHead] = useState(null);
  const [delimiterChoice, setDelimiterChoice] = useState(',');
  const [customDelimiter, setCustomDelimiter] = useState('');
  const [hasHeader, setHasHeader] = useState(true);
  const [columns, setColumns] = useState(null);
  const [scan, setScan] = useState(null);
  const [langMap, setLangMap] = useState({});
  const [name, setName] = useState(baseName(file.name));
  const [upload, setUpload] = useState(null);
  const abortRef = useRef(null);

  const delimiter = delimiterChoice === 'other' ? customDelimiter.replace(/\\t/g, '\t') : delimiterChoice;
  const busy = scan?.running || upload?.running;

  // the head of the file, read again when the encoding changes; the delimiter
  // is guessed the first time
  const guessedRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    readHead(file, encoding).then((result) => {
      if (cancelled) return;
      setHead(result);
      if (!guessedRef.current) {
        guessedRef.current = true;
        const guess = guessDelimiter(result.text);
        if (DELIMITERS.some((d) => d.value === guess)) setDelimiterChoice(guess);
        else { setDelimiterChoice('other'); setCustomDelimiter(guess); }
      }
    });
    return () => { cancelled = true; };
  }, [file, encoding]);

  const previewRows = useMemo(
    () => (head && delimiter ? parseHead(head, delimiter, PREVIEW_ROWS + 1) : []),
    [head, delimiter]
  );
  const header = hasHeader ? previewRows[0] || [] : null;
  const dataPreview = hasHeader ? previewRows.slice(1) : previewRows.slice(0, PREVIEW_ROWS);
  const columnCount = Math.max(0, ...previewRows.map((row) => row.length));
  const columnName = (index) => {
    const label = header?.[index];
    return label ? `${label} (columna ${index + 1})` : `Columna ${index + 1}`;
  };

  // closing is refused while the file is being read or sent; cancel first
  useEffect(() => {
    if (!upload?.running) return undefined;
    const warn = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [upload?.running]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const toColumns = () => {
    setColumns(guessColumns(header, columnCount));
    setStep(1);
  };

  const columnsValid = columns && columns.src_text !== '' && columns.tgt_text !== '' && columns.src_text !== columns.tgt_text
    && new Set(Object.values(columns).filter((v) => v !== NO_COLUMN)).size === Object.values(columns).filter((v) => v !== NO_COLUMN).length;

  const mappedPreview = columns
    ? dataPreview.map((row) => FIELDS.map((field) => {
        const column = columns[field.key];
        if (column === NO_COLUMN) return '(una lengua para todo el archivo)';
        return row[Number(column)] ?? '';
      }))
    : [];

  // Step 3: read the whole file once for the language codes it uses
  const scanFile = async () => {
    setStep(2);
    const controller = new AbortController();
    abortRef.current = controller;
    setScan({ running: true, progress: 0 });
    const codes = new Map();
    const count = (key, side) => {
      const entry = codes.get(key) || { origen: 0, traduccion: 0 };
      entry[side] += 1;
      codes.set(key, entry);
    };
    let rows = 0;
    let skipHeader = hasHeader;
    try {
      await readRows(file, {
        encoding,
        delimiter,
        signal: controller.signal,
        onProgress: (progress) => setScan((s) => ({ ...s, progress })),
        onRows: async (chunk) => {
          for (const row of chunk) {
            if (skipHeader) { skipHeader = false; continue; }
            rows += 1;
            count(columns.src_lang === NO_COLUMN ? FIXED.src_lang : (row[Number(columns.src_lang)] ?? '').trim(), 'origen');
            count(columns.tgt_lang === NO_COLUMN ? FIXED.tgt_lang : (row[Number(columns.tgt_lang)] ?? '').trim(), 'traduccion');
          }
          if (codes.size > MAX_CODES) {
            throw new Error(`Las columnas de lengua tienen más de ${MAX_CODES} valores distintos. Revisa qué columna es cada campo.`);
          }
          await sleep(0); // let the progress bar paint
        },
      });
      const found = [...codes.entries()].sort((a, b) => (b[1].origen + b[1].traduccion) - (a[1].origen + a[1].traduccion));
      setLangMap((previous) => Object.fromEntries(found.map(([raw]) => [
        raw,
        previous[raw] ?? (raw.startsWith('\u0000') ? '' : guessLanguage(raw, languages?.all || [])),
      ])));
      setScan({ running: false, progress: 1, rows, codes: found });
    } catch (error) {
      if (isAbort(error)) { setScan(null); setStep(1); return; }
      setScan({ running: false, progress: 1, error: error.message || 'No se pudo leer el archivo.' });
    }
  };

  const hasIgnored = Boolean(scan?.codes?.some(([raw]) => !langMap[raw]));

  // Step 4: send the rows in batches
  const startUpload = async () => {
    setStep(3);
    const controller = new AbortController();
    abortRef.current = controller;
    setUpload({ running: true, progress: 0, stored: 0, skipped: 0 });
    let fileId = null;
    try {
      const settings = {
        encoding,
        delimiter,
        hasHeader,
        columns: Object.fromEntries(FIELDS.map((field) => [
          field.key,
          columns[field.key] === NO_COLUMN ? null : columnName(Number(columns[field.key])),
        ])),
        languages: Object.fromEntries(Object.entries(langMap).map(([raw, code]) => [
          raw === FIXED.src_lang ? '(origen)' : raw === FIXED.tgt_lang ? '(traducción)' : raw,
          code || null,
        ])),
      };
      const created = await api.post(API_ENDPOINTS.IMPORTED_FILES, { name: name.trim(), filename: file.name, settings });
      fileId = created.data.id;

      let batch = [];
      let chars = 0;
      const send = async () => {
        if (!batch.length) return;
        const rows = batch;
        batch = [];
        chars = 0;
        for (let attempt = 0; ; attempt++) {
          try {
            const res = await api.post(`${API_ENDPOINTS.IMPORTED_FILES}${fileId}/rows/`, { rows }, { signal: controller.signal });
            setUpload((u) => ({ ...u, stored: u.stored + res.data.stored, skipped: u.skipped + res.data.skipped }));
            return;
          } catch (error) {
            // a network hiccup is retried; a refusal or a cancel is not
            if (isAbort(error) || error.response?.status < 500 || attempt >= 2) throw error;
            await sleep(1500 * (attempt + 1));
          }
        }
      };
      const codeOf = (field, row) => {
        const raw = columns[field] === NO_COLUMN ? FIXED[field] : (row[Number(columns[field])] ?? '').trim();
        return langMap[raw] || '';
      };
      let skipHeader = hasHeader;
      await readRows(file, {
        encoding,
        delimiter,
        signal: controller.signal,
        onProgress: (progress) => setUpload((u) => ({ ...u, progress })),
        onRows: async (chunk, progressAt) => {
          for (const [i, row] of chunk.entries()) {
            if (skipHeader) { skipHeader = false; continue; }
            const entry = [
              codeOf('src_lang', row),
              codeOf('tgt_lang', row),
              row[Number(columns.src_text)] ?? '',
              row[Number(columns.tgt_text)] ?? '',
            ];
            batch.push(entry);
            chars += entry[2].length + entry[3].length + 40;
            if (batch.length >= BATCH_ROWS || chars >= BATCH_CHARS) {
              await send();
              setUpload((u) => ({ ...u, progress: progressAt(i) }));
            }
          }
        },
      });
      await send();
      const finished = await api.post(`${API_ENDPOINTS.IMPORTED_FILES}${fileId}/finish/`, {}, { signal: controller.signal });
      setUpload((u) => ({ ...u, running: false, progress: 1, done: true }));
      toast({
        title: 'Archivo cargado',
        description: `${finished.data.row_count.toLocaleString('es-CL')} filas de "${finished.data.name}" ya responden en el traductor.`,
      });
      onImported?.();
    } catch (error) {
      // nothing half-loaded is left behind
      if (fileId) api.delete(`${API_ENDPOINTS.IMPORTED_FILES}${fileId}/`).catch(() => {}).finally(() => onImported?.());
      if (isAbort(error)) {
        setUpload(null);
        setStep(2);
        return;
      }
      const detail = error.response?.data ? JSON.stringify(error.response.data) : error.message;
      setUpload((u) => ({ ...u, running: false, error: `No se pudo cargar el archivo (${detail}). No quedó nada cargado; puedes intentarlo otra vez.` }));
    }
  };

  const cancel = () => abortRef.current?.abort();

  const fixedLabel = (raw) => (raw === FIXED.src_lang ? 'Todas las filas (lengua de origen)' : 'Todas las filas (lengua de la traducción)');

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent className="max-h-[92vh] w-[95vw] max-w-4xl overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Cargar CSV</DialogTitle>
          <DialogDescription>
            {file.name} · {formatSize(file.size)}
          </DialogDescription>
        </DialogHeader>
        <StepIndicator step={step} />

        {step === 0 && (
          <div className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="space-y-1 text-sm">
                <span className="font-semibold">Separador</span>
                <select className={selectClass} value={delimiterChoice} onChange={(e) => setDelimiterChoice(e.target.value)}>
                  {DELIMITERS.map((d) => <option key={d.label} value={d.value}>{d.label}</option>)}
                </select>
              </label>
              {delimiterChoice === 'other' && (
                <label className="space-y-1 text-sm">
                  <span className="font-semibold">Carácter separador</span>
                  <Input value={customDelimiter} maxLength={3} onChange={(e) => setCustomDelimiter(e.target.value)} placeholder="Ej.: #" />
                </label>
              )}
              <label className="space-y-1 text-sm">
                <span className="font-semibold">Codificación</span>
                <select className={selectClass} value={encoding} onChange={(e) => setEncoding(e.target.value)}>
                  {ENCODINGS.map((enc) => <option key={enc.value} value={enc.value}>{enc.label}</option>)}
                </select>
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox id="csv-header" checked={hasHeader} onCheckedChange={setHasHeader} />
              La primera fila tiene los nombres de las columnas
            </label>
            <div>
              <p className="mb-2 text-sm text-gray-600">Así se leen las primeras filas con este separador:</p>
              {head ? <PreviewTable header={header} rows={dataPreview} /> : <p className="text-sm text-gray-500">Leyendo el archivo…</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button className="bg-default text-white hover:bg-defaultHover" disabled={!delimiter || columnCount < 2} onClick={toColumns}>
                Siguiente
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 1 && columns && (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-gray-600">
              Indica qué columna del archivo corresponde a cada campo. Si el archivo no tiene una columna de lengua,
              elige una sola lengua para todas sus filas en el paso siguiente.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {FIELDS.map((field) => (
                <label key={field.key} className="space-y-1 text-sm">
                  <span className="font-semibold">{field.label}</span>
                  <select
                    className={selectClass}
                    value={columns[field.key]}
                    onChange={(e) => setColumns((c) => ({ ...c, [field.key]: e.target.value }))}
                  >
                    {!field.lang && <option value="">— Elige una columna —</option>}
                    {field.lang && <option value={NO_COLUMN}>Sin columna: una lengua para todo el archivo</option>}
                    {Array.from({ length: columnCount }, (_, i) => <option key={i} value={String(i)}>{columnName(i)}</option>)}
                  </select>
                </label>
              ))}
            </div>
            {!columnsValid && <p className="text-sm text-red-600">Elige las columnas de los dos textos, sin usar una columna para dos campos.</p>}
            <div>
              <p className="mb-2 text-sm text-gray-600">Así quedan las primeras filas:</p>
              <PreviewTable header={FIELDS.map((f) => f.label)} rows={mappedPreview} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(0)}>Atrás</Button>
              <Button className="bg-default text-white hover:bg-defaultHover" disabled={!columnsValid} onClick={scanFile}>
                Siguiente
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 2 && (
          <div className="mt-4 space-y-4">
            {scan?.running && (
              <div className="space-y-2">
                <p className="text-sm text-gray-600">Revisando las lenguas del archivo…</p>
                <ProgressBar value={scan.progress} />
                <DialogFooter><Button variant="outline" onClick={cancel}>Cancelar</Button></DialogFooter>
              </div>
            )}
            {scan?.error && (
              <>
                <p className="text-sm text-red-600">{scan.error}</p>
                <DialogFooter><Button variant="outline" onClick={() => setStep(1)}>Atrás</Button></DialogFooter>
              </>
            )}
            {scan?.codes && (
              <>
                <p className="text-sm text-gray-600">
                  El archivo tiene {scan.rows.toLocaleString('es-CL')} filas. Elige la lengua del traductor que corresponde
                  a cada código del archivo; las que coinciden directamente ya están elegidas. Las filas de un código
                  ignorado no se cargan.
                </p>
                {!languages ? (
                  <p className="text-sm text-gray-500">Cargando las lenguas…</p>
                ) : (
                  <div className="max-h-80 overflow-auto rounded-lg border">
                    <table className="w-full text-left text-sm">
                      <thead className="sticky top-0 bg-gray-100">
                        <tr>
                          <th className="px-3 py-2">En el archivo</th>
                          <th className="px-3 py-2">Filas</th>
                          <th className="px-3 py-2 w-1/2">Lengua</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scan.codes.map(([raw, counts]) => (
                          <tr key={raw} className="border-t">
                            <td className="px-3 py-2">
                              {raw.startsWith('\u0000') ? <i>{fixedLabel(raw)}</i> : raw === '' ? <i className="text-gray-500">(vacío)</i> : <code>{raw}</code>}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-600">
                              {counts.origen > 0 && <div>{counts.origen.toLocaleString('es-CL')} de origen</div>}
                              {counts.traduccion > 0 && <div>{counts.traduccion.toLocaleString('es-CL')} de traducción</div>}
                            </td>
                            <td className="px-3 py-2">
                              <LanguageSelect
                                value={langMap[raw] || ''}
                                languages={languages}
                                onChange={(code) => setLangMap((m) => ({ ...m, [raw]: code }))}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {hasIgnored && <p className="text-sm text-amber-700">Hay códigos ignorados: sus filas no se cargarán.</p>}
                <label className="block space-y-1 text-sm">
                  <span className="font-semibold">Nombre del archivo en la lista</span>
                  <Input value={name} maxLength={255} onChange={(e) => setName(e.target.value)} />
                </label>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setStep(1)}>Atrás</Button>
                  <Button
                    className="bg-default text-white hover:bg-defaultHover"
                    disabled={!name.trim() || !languages || Object.values(langMap).every((code) => !code)}
                    onClick={startUpload}
                  >
                    Cargar
                  </Button>
                </DialogFooter>
              </>
            )}
          </div>
        )}

        {step === 3 && upload && (
          <div className="mt-4 space-y-4">
            <ProgressBar value={upload.progress} />
            <p className="text-sm text-gray-600">
              {upload.stored.toLocaleString('es-CL')} filas cargadas
              {upload.skipped > 0 && ` · ${upload.skipped.toLocaleString('es-CL')} omitidas (lengua ignorada, texto vacío o demasiado largo)`}
            </p>
            {upload.running && <p className="text-xs text-gray-500">No cierres esta página hasta que termine.</p>}
            {upload.error && <p className="text-sm text-red-600">{upload.error}</p>}
            {upload.done && (
              <p className="text-sm text-green-700">
                Listo. Lenguas: {Object.entries(langMap).filter(([, code]) => code).map(([, code]) => langLabel(code)).filter((v, i, a) => a.indexOf(v) === i).join(', ')}
              </p>
            )}
            <DialogFooter>
              {upload.running
                ? <Button variant="outline" onClick={cancel}>Cancelar carga</Button>
                : <Button className="bg-default text-white hover:bg-defaultHover" onClick={onClose}>Cerrar</Button>}
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ProgressBar({ value }) {
  const percent = Math.round((value || 0) * 100);
  return (
    <div className="space-y-1">
      <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full bg-default transition-[width]" style={{ width: `${percent}%` }} />
      </div>
      <div className="text-right text-xs text-gray-500">{percent}%</div>
    </div>
  );
}
