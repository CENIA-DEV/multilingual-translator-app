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

import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button.jsx";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowDown, faArrowUp, faChevronLeft, faChevronRight, faDownload, faEdit, faEye, faFileCsv, faGripVertical, faTrash } from "@fortawesome/free-solid-svg-icons";
import ActionIcon from '../actionIcon/actionIcon.jsx';
import { useToast } from "@/hooks/use-toast";
import { API_ENDPOINTS } from '../../constants.js';
import api from '../../api.js';
import ImportWizard from './importWizard.jsx';
import { useLangLabel } from './languages.js';

const formatDate = (value) => new Date(value).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' });
const formatCount = (value) => Number(value || 0).toLocaleString('es-CL');

/** The rows a file holds, a page at a time, as they were stored. */
function FileRowsDialog({ file, onClose }) {
  const langLabel = useLangLabel();
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    api.get(`${API_ENDPOINTS.IMPORTED_FILES}${file.id}/pairs/`, { params: { page } })
      .then((res) => { if (!cancelled) setData(res.data); })
      .catch(() => { if (!cancelled) setData({ results: [], count: 0, error: true }); });
    return () => { cancelled = true; };
  }, [file.id, page]);

  const pages = data ? Math.max(1, Math.ceil(data.count / (data.page_size || 20))) : 1;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[92vh] w-[95vw] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{file.name}</DialogTitle>
          <DialogDescription>{formatCount(file.row_count)} filas, en el orden del archivo</DialogDescription>
        </DialogHeader>
        {!data ? (
          <Skeleton className="h-64 w-full" />
        ) : data.error ? (
          <p className="text-sm text-red-600">No se pudieron cargar las filas.</p>
        ) : (
          <div className="overflow-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100">
                <tr><th className="px-3 py-2 w-1/2">Texto de origen</th><th className="px-3 py-2 w-1/2">Traducción</th></tr>
              </thead>
              <tbody>
                {data.results.map((row) => (
                  <tr key={row.id} className="border-t align-top">
                    <td className="px-3 py-2">
                      <div className="whitespace-pre-wrap">{row.src_text}</div>
                      <div className="mt-1 text-xs text-gray-500">{langLabel(row.src_lang)}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="whitespace-pre-wrap">{row.dst_text}</div>
                      <div className="mt-1 text-xs text-gray-500">{langLabel(row.dst_lang)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <FontAwesomeIcon icon={faChevronLeft} className="mr-2 h-3 w-3" /> Anterior
          </Button>
          <span className="text-sm">Página {page} de {pages}</span>
          <Button variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Siguiente <FontAwesomeIcon icon={faChevronRight} className="ml-2 h-3 w-3" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmDelete({ file, onCancel, onConfirm, deleting }) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !deleting) onCancel(); }}>
      <DialogContent className="w-[95vw] max-w-md">
        <DialogHeader>
          <DialogTitle>¿Eliminar &quot;{file.name}&quot;?</DialogTitle>
          <DialogDescription>
            Sus {formatCount(file.row_count)} filas dejarán de responder en el traductor. No se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={deleting}>Cancelar</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={deleting}>
            {deleting ? 'Eliminando…' : 'Eliminar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The CSVs uploaded as translations ("Archivos CSV" in Explorar datos). Their
 * rows answer in the translator where the suggestions leave gaps; the order
 * of the list is the order in which they are looked up.
 */
export default function ImportedFiles() {
  const { toast } = useToast();
  const langLabel = useLangLabel();
  const inputRef = useRef(null);
  const [files, setFiles] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [wizardFile, setWizardFile] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [renaming, setRenaming] = useState(null); // { id, name }
  const [dragIndex, setDragIndex] = useState(null);
  const [downloading, setDownloading] = useState(null); // file id

  const load = useCallback(async () => {
    try {
      const res = await api.get(API_ENDPOINTS.IMPORTED_FILES);
      setFiles(res.data);
      setLoadError(false);
    } catch (error) {
      setLoadError(true);
      setFiles((current) => current || []);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveOrder = async (ordered) => {
    const previous = files;
    setFiles(ordered);
    try {
      const res = await api.post(`${API_ENDPOINTS.IMPORTED_FILES}reorder/`, { ids: ordered.map((f) => f.id) });
      setFiles(res.data);
    } catch (error) {
      setFiles(previous);
      toast({ title: 'No se pudo cambiar el orden', description: 'Inténtalo otra vez.', variant: 'destructive' });
    }
  };

  const move = (from, to) => {
    if (to < 0 || to >= files.length || from === to) return;
    const ordered = [...files];
    const [file] = ordered.splice(from, 1);
    ordered.splice(to, 0, file);
    saveOrder(ordered);
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await api.delete(`${API_ENDPOINTS.IMPORTED_FILES}${confirming.id}/`);
      setFiles((current) => current.filter((f) => f.id !== confirming.id));
      toast({ title: 'Archivo eliminado', description: `"${confirming.name}" ya no responde en el traductor.` });
      setConfirming(null);
    } catch (error) {
      toast({ title: 'No se pudo eliminar el archivo', description: 'Inténtalo otra vez.', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const rename = async () => {
    const name = renaming.name.trim();
    if (!name) return;
    try {
      const res = await api.patch(`${API_ENDPOINTS.IMPORTED_FILES}${renaming.id}/`, { name });
      setFiles((current) => current.map((f) => (f.id === res.data.id ? res.data : f)));
      setRenaming(null);
    } catch (error) {
      toast({ title: 'No se pudo cambiar el nombre', variant: 'destructive' });
    }
  };

  // The CSV is written again by the server from the stored rows, with the
  // codes as they were mapped; fetched with the session's token, then saved
  const download = async (file) => {
    setDownloading(file.id);
    try {
      const res = await api.get(`${API_ENDPOINTS.IMPORTED_FILES}${file.id}/download/`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${file.name}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (error) {
      toast({ title: 'No se pudo descargar el archivo', description: 'Inténtalo otra vez.', variant: 'destructive' });
    } finally {
      setDownloading(null);
    }
  };

  const pickFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) setWizardFile(file);
  };

  return (
    <Card className="p-5">
      <CardContent className="space-y-4 p-0 sm:p-2">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl space-y-1 text-sm text-gray-600">
            <p>
              Las filas de estos archivos responden en el traductor como sugerencias verificadas, pero solo donde no hay
              una sugerencia validada ni de un usuario de confianza para la misma variante.
            </p>
            <p>
              Si un texto está en varios archivos, responde el que está más arriba en la lista. Una fila de un territorio
              y grafemario responde antes que una sugerencia sin territorio.
            </p>
          </div>
          <Button className="bg-default text-white hover:bg-defaultHover" onClick={() => inputRef.current?.click()}>
            <FontAwesomeIcon icon={faFileCsv} className="mr-2 h-4 w-4" /> Cargar CSV
          </Button>
          <input ref={inputRef} type="file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values" className="hidden" onChange={pickFile} />
        </div>

        {files === null ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <>
            {loadError && <p className="text-sm text-red-600">No se pudieron cargar los archivos. Reintenta en unos momentos.</p>}
            {files.length === 0 && !loadError && (
              <p className="rounded-lg border border-dashed py-10 text-center text-gray-500">Aún no hay archivos cargados.</p>
            )}
            <ol className="space-y-2" aria-label="Archivos cargados, en orden de prioridad">
              {files.map((file, index) => (
                <li
                  key={file.id}
                  draggable={renaming?.id !== file.id}
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => { if (dragIndex !== null) move(dragIndex, index); setDragIndex(null); }}
                  onDragEnd={() => setDragIndex(null)}
                  className={`flex flex-wrap items-center gap-3 rounded-lg border bg-white p-3 ${dragIndex === index ? 'opacity-50' : ''}`}
                >
                  <FontAwesomeIcon icon={faGripVertical} className="hidden h-4 w-4 cursor-grab text-gray-400 sm:block" title="Arrastra para cambiar la prioridad" />
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-default text-sm font-bold text-white" title="Prioridad">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    {renaming?.id === file.id ? (
                      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); rename(); }}>
                        <Input autoFocus value={renaming.name} maxLength={255} onChange={(e) => setRenaming({ ...renaming, name: e.target.value })} />
                        <Button type="submit" size="sm" className="bg-default text-white hover:bg-defaultHover">Guardar</Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setRenaming(null)}>Cancelar</Button>
                      </form>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="break-all font-semibold">{file.name}</span>
                        {file.status !== 'ready' && <Badge variant="destructive">Carga incompleta</Badge>}
                      </div>
                    )}
                    <div className="text-xs text-gray-600">
                      {formatCount(file.row_count)} filas
                      {file.skipped_count > 0 && ` · ${formatCount(file.skipped_count)} omitidas`}
                      {file.filename && file.filename !== file.name && ` · ${file.filename}`}
                      {' · '}{file.uploaded_by ? `${file.uploaded_by}, ` : ''}{formatDate(file.created_at)}
                    </div>
                    {file.lang_pairs?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {file.lang_pairs.map((pair) => (
                          <Badge key={`${pair.src}-${pair.dst}`} variant="secondary" className="font-normal">
                            {langLabel(pair.src)} → {langLabel(pair.dst)}: {formatCount(pair.rows)}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center">
                    <ActionIcon icon={faArrowUp} tooltipText="Subir prioridad" variant="ghost" clickCallback={() => move(index, index - 1)} />
                    <ActionIcon icon={faArrowDown} tooltipText="Bajar prioridad" variant="ghost" clickCallback={() => move(index, index + 1)} />
                    {file.status === 'ready' && (
                      <>
                        <ActionIcon icon={faEye} tooltipText="Ver filas" variant="ghost" clickCallback={() => setViewing(file)} />
                        {/* ActionIcon spins while the download runs */}
                        <ActionIcon
                          icon={faDownload}
                          tooltipText="Descargar CSV"
                          variant="ghost"
                          clickCallback={() => (downloading === null ? download(file) : undefined)}
                        />
                      </>
                    )}
                    <ActionIcon icon={faEdit} tooltipText="Cambiar nombre" variant="ghost" clickCallback={() => setRenaming({ id: file.id, name: file.name })} />
                    <ActionIcon icon={faTrash} tooltipText="Eliminar archivo" variant="ghost" clickCallback={() => setConfirming(file)} />
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}
      </CardContent>

      {wizardFile && <ImportWizard file={wizardFile} onClose={() => setWizardFile(null)} onImported={load} />}
      {viewing && <FileRowsDialog file={viewing} onClose={() => setViewing(null)} />}
      {confirming && <ConfirmDelete file={confirming} deleting={deleting} onCancel={() => setConfirming(null)} onConfirm={remove} />}
    </Card>
  );
}
