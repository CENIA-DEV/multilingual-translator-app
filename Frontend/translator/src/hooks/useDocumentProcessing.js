import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { runOCR } from '../app/services/ocrService';
import { OCR_MAX_FILE_SIZE_MB, OCR_MAX_PDF_PAGES } from '../app/constants';


const DOCUMENT_LANGUAGE_OPTIONS = [
  { code: 'spa', label: 'Español' },
  { code: 'rap', label: 'Rapa Nui' },
];

function revokeBlobUrl(url) {
  if (typeof url === 'string' && url.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(url);
    } catch {}
  }
}

function dedupeUrls(urls) {
  return Array.from(new Set((urls || []).filter(Boolean)));
}

function getFileBaseName(fileName, fallback = 'document') {
  if (!fileName || typeof fileName !== 'string') return fallback;
  return fileName.replace(/\.[^/.]+$/, '') || fallback;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function round6(value) {
  return Number(value.toFixed(6));
}

export function useDocumentProcessing() {
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [documentDragActive, setDocumentDragActive] = useState(false);
  const [documentFile, setDocumentFile] = useState(null);
  const [documentPages, setDocumentPages] = useState([]);
  const [documentPageIndex, setDocumentPageIndex] = useState(0);
  const [documentPreviewUrl, setDocumentPreviewUrl] = useState('');
  const [documentZoom, setDocumentZoom] = useState(1);
  const [documentRotation, setDocumentRotation] = useState(0);
  const [documentCropMode, setDocumentCropMode] = useState(false);
  const [documentCropSelection, setDocumentCropSelection] = useState(null);
  const [documentCropDragging, setDocumentCropDragging] = useState(false);
  const [documentCropStart, setDocumentCropStart] = useState(null);
  const [documentPan, setDocumentPan] = useState({ x: 0, y: 0 });
  const [documentPanDragging, setDocumentPanDragging] = useState(false);
  const [documentPageHistory, setDocumentPageHistory] = useState({});
  const [documentOcrByPage, setDocumentOcrByPage] = useState({});
  const [documentCornersByPage, setDocumentCornersByPage] = useState({});
  const [documentIsRunning, setDocumentIsRunning] = useState(false);
  const [documentProcessingFiles, setDocumentProcessingFiles] = useState(false);
  const [documentSourceLanguage, setDocumentSourceLanguage] = useState('spa');

  const docInputRef = useRef(null);
  const documentViewportRef = useRef(null);
  const documentImageRef = useRef(null);
  const documentPanStartRef = useRef(null);
  const pdfjsRef = useRef(null);

  const isSupportedDocument = useCallback((file) => {
    const supportedMime = ['application/pdf', 'image/jpeg', 'image/png'];
    const name = (file?.name || '').toLowerCase();
    return supportedMime.includes(file?.type) || /\.(pdf|jpe?g|png)$/i.test(name);
  }, []);

  const isPdfDocument = useCallback((file) => {
    if (!file) return false;
    return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  }, []);

  const currentDocumentPageUrl = useMemo(
    () => documentPages[documentPageIndex] || documentPreviewUrl,
    [documentPages, documentPageIndex, documentPreviewUrl]
  );

  const currentDocumentResultText = useMemo(
    () => documentOcrByPage[documentPageIndex] || '',
    [documentOcrByPage, documentPageIndex]
  );

  const isPdfObjectFallback = useMemo(
    () => !!documentFile && isPdfDocument(documentFile) && documentPages.length === 0 && !!documentPreviewUrl,
    [documentFile, documentPages.length, documentPreviewUrl, isPdfDocument]
  );

  const revokeAllKnownBlobUrls = useCallback(() => {
    const historyUrls = Object.values(documentPageHistory || {}).flat();
    const candidateUrls = dedupeUrls([
      documentPreviewUrl,
      ...documentPages,
      ...historyUrls,
    ]);
    candidateUrls.forEach(revokeBlobUrl);
  }, [documentPageHistory, documentPages, documentPreviewUrl]);

  const resetDocumentState = useCallback(() => {
    revokeAllKnownBlobUrls();
    setDocumentDragActive(false);
    setDocumentFile(null);
    setDocumentPreviewUrl('');
    setDocumentPages([]);
    setDocumentPageIndex(0);
    setDocumentZoom(1);
    setDocumentRotation(0);
    setDocumentCropMode(false);
    setDocumentCropSelection(null);
    setDocumentCropDragging(false);
    setDocumentCropStart(null);
    setDocumentPan({ x: 0, y: 0 });
    setDocumentPanDragging(false);
    documentPanStartRef.current = null;
    setDocumentPageHistory({});
    setDocumentOcrByPage({});
    setDocumentCornersByPage({});
    setDocumentIsRunning(false);
    setDocumentProcessingFiles(false);
    setDocumentSourceLanguage('spa');
    if (docInputRef.current) docInputRef.current.value = '';
  }, [revokeAllKnownBlobUrls]);

  useEffect(() => {
    return () => {
      revokeAllKnownBlobUrls();
    };
  }, [revokeAllKnownBlobUrls]);

  const clampDocumentPageIndex = useCallback((nextIndex) => {
    if (!documentPages.length) return 0;
    return Math.max(0, Math.min(nextIndex, documentPages.length - 1));
  }, [documentPages]);

  const goToDocumentPage = useCallback((nextIndex) => {
    const safeIndex = clampDocumentPageIndex(nextIndex);
    setDocumentPageIndex(safeIndex);
    setDocumentCropSelection(null);
    setDocumentCropMode(false);
    setDocumentRotation(0);
    setDocumentPan({ x: 0, y: 0 });
    setDocumentPanDragging(false);
    documentPanStartRef.current = null;
    const nextUrl = documentPages[safeIndex];
    if (nextUrl) setDocumentPreviewUrl(nextUrl);
  }, [clampDocumentPageIndex, documentPages]);

  const handleDocumentZoomIn = useCallback(() => {
    setDocumentZoom((z) => Math.min(3, Number((z + 0.2).toFixed(2))));
  }, []);

  const handleDocumentZoomOut = useCallback(() => {
    setDocumentZoom((z) => Math.max(0.5, Number((z - 0.2).toFixed(2))));
  }, []);

  const pushDocumentHistoryForCurrentPage = useCallback((sourceUrl) => {
    if (!sourceUrl) return;
    setDocumentPageHistory((prev) => ({
      ...prev,
      [documentPageIndex]: [...(prev[documentPageIndex] || []), sourceUrl],
    }));
  }, [documentPageIndex]);

  const handleDocumentRotate = useCallback(async () => {
    const srcUrl = documentPages[documentPageIndex] || documentPreviewUrl;
    if (!srcUrl) return;

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = srcUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.height;
      canvas.height = img.width;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      const rotatedUrl = canvas.toDataURL('image/png');
      pushDocumentHistoryForCurrentPage(srcUrl);

      setDocumentPages((prevPages) => {
        if (!prevPages.length) return [rotatedUrl];
        const updatedPages = [...prevPages];
        updatedPages[documentPageIndex] = rotatedUrl;
        return updatedPages;
      });

      setDocumentPreviewUrl(rotatedUrl);
      setDocumentRotation(0);
      setDocumentCropSelection(null);
      setDocumentCropMode(false);
      setDocumentCornersByPage((prev) => {
        const next = { ...prev };
        delete next[documentPageIndex];
        return next;
      });
      setDocumentPan({ x: 0, y: 0 });
      setDocumentPanDragging(false);
      documentPanStartRef.current = null;
    } catch (error) {
      console.error('Document rotate failed', error);
      toast('No se pudo rotar la pagina.');
    }
  }, [documentPages, documentPageIndex, documentPreviewUrl, pushDocumentHistoryForCurrentPage]);

  const handleDocumentClear = useCallback(() => {
    resetDocumentState();
  }, [resetDocumentState]);

  const handleDocumentUndoCurrentPage = useCallback(() => {
    const history = documentPageHistory[documentPageIndex] || [];
    if (!history.length) return;

    const previousUrl = history[history.length - 1];
    setDocumentPageHistory((prev) => ({
      ...prev,
      [documentPageIndex]: (prev[documentPageIndex] || []).slice(0, -1),
    }));

    setDocumentPages((prevPages) => {
      if (!prevPages.length) return prevPages;
      const updatedPages = [...prevPages];
      updatedPages[documentPageIndex] = previousUrl;
      return updatedPages;
    });

    setDocumentPreviewUrl(previousUrl);
    setDocumentCropMode(false);
    setDocumentCropSelection(null);
    setDocumentCropDragging(false);
    setDocumentCropStart(null);
    setDocumentCornersByPage((prev) => {
      const next = { ...prev };
      delete next[documentPageIndex];
      return next;
    });
    setDocumentPan({ x: 0, y: 0 });
    setDocumentPanDragging(false);
    documentPanStartRef.current = null;
  }, [documentPageHistory, documentPageIndex]);

  const applyDocumentSelectionCrop = useCallback(async () => {
    const imgEl = documentImageRef.current;
    const viewportEl = documentViewportRef.current;
    const selection = documentCropSelection;
    if (!imgEl || !viewportEl || !selection) return;

    try {
      const imgRect = imgEl.getBoundingClientRect();
      const viewportRect = viewportEl.getBoundingClientRect();
      const leftInViewport = imgRect.left - viewportRect.left;
      const topInViewport = imgRect.top - viewportRect.top;

      const sxView = Math.max(0, selection.x - leftInViewport);
      const syView = Math.max(0, selection.y - topInViewport);
      const exView = Math.min(imgRect.width, selection.x + selection.w - leftInViewport);
      const eyView = Math.min(imgRect.height, selection.y + selection.h - topInViewport);
      const widthView = exView - sxView;
      const heightView = eyView - syView;

      if (widthView < 4 || heightView < 4) {
        toast('Seleccion de recorte demasiado pequena.');
        return;
      }

      const scaleX = imgEl.naturalWidth / imgRect.width;
      const scaleY = imgEl.naturalHeight / imgRect.height;
      const sx = Math.floor(sxView * scaleX);
      const sy = Math.floor(syView * scaleY);
      const sWidth = Math.floor(widthView * scaleX);
      const sHeight = Math.floor(heightView * scaleY);
      const right = sx + sWidth;
      const bottom = sy + sHeight;

      if (!imgEl.naturalWidth || !imgEl.naturalHeight) {
        throw new Error('No se pudieron calcular las esquinas del recorte.');
      }

      const normalizedCorners = {
        x1: round6(clamp01(sx / imgEl.naturalWidth)),
        y1: round6(clamp01(sy / imgEl.naturalHeight)),
        x2: round6(clamp01(right / imgEl.naturalWidth)),
        y2: round6(clamp01(sy / imgEl.naturalHeight)),
        x3: round6(clamp01(right / imgEl.naturalWidth)),
        y3: round6(clamp01(bottom / imgEl.naturalHeight)),
        x4: round6(clamp01(sx / imgEl.naturalWidth)),
        y4: round6(clamp01(bottom / imgEl.naturalHeight)),
      };

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, sWidth);
      canvas.height = Math.max(1, sHeight);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(imgEl, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
      const croppedUrl = canvas.toDataURL('image/png');
      const srcUrl = documentPages[documentPageIndex] || documentPreviewUrl;
      pushDocumentHistoryForCurrentPage(srcUrl);

      setDocumentPages((prevPages) => {
        if (!prevPages.length) return [croppedUrl];
        const updatedPages = [...prevPages];
        updatedPages[documentPageIndex] = croppedUrl;
        return updatedPages;
      });

      setDocumentPreviewUrl(croppedUrl);
      setDocumentCropMode(false);
      setDocumentCropSelection(null);
      setDocumentCropDragging(false);
      setDocumentCropStart(null);
      setDocumentCornersByPage((prev) => ({
        ...prev,
        [documentPageIndex]: normalizedCorners,
      }));
      setDocumentPan({ x: 0, y: 0 });
      setDocumentPanDragging(false);
      documentPanStartRef.current = null;
    } catch (error) {
      console.error('Document crop failed', error);
      toast('No se pudo recortar la pagina.');
    }
  }, [documentCropSelection, documentPages, documentPageIndex, documentPreviewUrl, pushDocumentHistoryForCurrentPage]);

  const handleDocumentCropMouseDown = useCallback((event) => {
    if (!documentCropMode || isPdfObjectFallback) return;
    const viewportEl = documentViewportRef.current;
    if (!viewportEl) return;
    const rect = viewportEl.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    setDocumentCropStart({ x, y });
    setDocumentCropSelection({ x, y, w: 0, h: 0 });
    setDocumentCropDragging(true);
  }, [documentCropMode, isPdfObjectFallback]);

  const handleDocumentCropMouseMove = useCallback((event) => {
    if (!documentCropMode || !documentCropDragging || !documentCropStart) return;
    const viewportEl = documentViewportRef.current;
    if (!viewportEl) return;
    const rect = viewportEl.getBoundingClientRect();
    const currentX = event.clientX - rect.left;
    const currentY = event.clientY - rect.top;
    const width = currentX - documentCropStart.x;
    const height = currentY - documentCropStart.y;

    setDocumentCropSelection({
      x: width >= 0 ? documentCropStart.x : currentX,
      y: height >= 0 ? documentCropStart.y : currentY,
      w: Math.abs(width),
      h: Math.abs(height),
    });
  }, [documentCropMode, documentCropDragging, documentCropStart]);

  const handleDocumentCropMouseUp = useCallback(async () => {
    if (!documentCropMode || !documentCropDragging) return;
    setDocumentCropDragging(false);
    if (!documentCropSelection || documentCropSelection.w < 8 || documentCropSelection.h < 8) {
      setDocumentCropSelection(null);
      return;
    }
    await applyDocumentSelectionCrop();
  }, [documentCropMode, documentCropDragging, documentCropSelection, applyDocumentSelectionCrop]);

  const handleDocumentPanMouseDown = useCallback((event) => {
    if (documentCropMode || isPdfObjectFallback || !currentDocumentPageUrl) return;
    event.preventDefault();
    documentPanStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      originX: documentPan.x,
      originY: documentPan.y,
    };
    setDocumentPanDragging(true);
  }, [documentCropMode, isPdfObjectFallback, currentDocumentPageUrl, documentPan]);

  const handleDocumentPanMouseMove = useCallback((event) => {
    if (!documentPanDragging || !documentPanStartRef.current) return;
    const start = documentPanStartRef.current;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    setDocumentPan({ x: start.originX + dx, y: start.originY + dy });
  }, [documentPanDragging]);

  const handleDocumentPanMouseUp = useCallback(() => {
    if (!documentPanDragging) return;
    setDocumentPanDragging(false);
    documentPanStartRef.current = null;
  }, [documentPanDragging]);

  const handleDocumentViewportMouseDown = useCallback((event) => {
    if (documentCropMode) {
      handleDocumentCropMouseDown(event);
      return;
    }
    handleDocumentPanMouseDown(event);
  }, [documentCropMode, handleDocumentCropMouseDown, handleDocumentPanMouseDown]);

  const handleDocumentViewportMouseMove = useCallback((event) => {
    if (documentCropMode) {
      handleDocumentCropMouseMove(event);
      return;
    }
    handleDocumentPanMouseMove(event);
  }, [documentCropMode, handleDocumentCropMouseMove, handleDocumentPanMouseMove]);

  const handleDocumentViewportMouseUp = useCallback(async () => {
    if (documentCropMode) {
      await handleDocumentCropMouseUp();
      return;
    }
    handleDocumentPanMouseUp();
  }, [documentCropMode, handleDocumentCropMouseUp, handleDocumentPanMouseUp]);

  const getPdfJs = useCallback(async () => {
    if (pdfjsRef.current) return pdfjsRef.current;

    // Use legacy build for broad browser compatibility with Next client bundles.
    const mod = await import('pdfjs-dist/legacy/build/pdf');
    const pdfjsLib = mod?.default || mod;

    if (!pdfjsLib?.getDocument) {
      throw new Error('PDF.js no se pudo cargar.');
    }

    // Use a stable public asset path for the worker in Next.js.
    if (pdfjsLib.GlobalWorkerOptions) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
    }

    pdfjsRef.current = pdfjsLib;
    return pdfjsLib;
  }, []);

  const loadPdfDocument = useCallback(async (pdfjsLib, arrayBuffer) => {
    const data = new Uint8Array(arrayBuffer);

    return await pdfjsLib.getDocument({ data }).promise;
  }, []);

  const handleDocumentPicked = useCallback(async (file) => {
    if (!file) return;

    const maxFileSizeBytes = OCR_MAX_FILE_SIZE_MB * 1024 * 1024;
    if (file.size > maxFileSizeBytes) {
      toast('Archivo demasiado grande', {
        description: `El archivo supera ${OCR_MAX_FILE_SIZE_MB} MB.`,
      });
      return;
    }

    if (!isSupportedDocument(file)) {
      toast('Formato no soportado', {
        description: 'Sube un archivo PDF, JPG, JPEG o PNG.',
      });
      return;
    }

    setDocumentProcessingFiles(true);
    revokeAllKnownBlobUrls();

    setDocumentFile(file);
    setDocumentZoom(1);
    setDocumentRotation(0);
    setDocumentCropMode(false);
    setDocumentCropSelection(null);
    setDocumentCropDragging(false);
    setDocumentCropStart(null);
    setDocumentPan({ x: 0, y: 0 });
    setDocumentPanDragging(false);
    documentPanStartRef.current = null;
    setDocumentPageHistory({});
    setDocumentOcrByPage({});
    setDocumentCornersByPage({});
    setDocumentPages([]);
    setDocumentPageIndex(0);

    try {
      const previewUrl = URL.createObjectURL(file);

      if (isPdfDocument(file)) {
        const pdfjsLib = await getPdfJs();
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await loadPdfDocument(pdfjsLib, arrayBuffer);
        const pageImages = [];
        const maxPages = Math.min(pdf.numPages, OCR_MAX_PDF_PAGES);

        for (let i = 1; i <= maxPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          const context = canvas.getContext('2d');
          if (!context) continue;

          await page.render({ canvasContext: context, viewport }).promise;
          pageImages.push(canvas.toDataURL('image/png'));
        }

        if (!pageImages.length) {
          setDocumentPreviewUrl(previewUrl);
          setDocumentPages([]);
          toast('PDF cargado sin paginas editables.', {
            description: 'No se pudo rasterizar este PDF para recorte y rotacion.',
          });
        } else {
          revokeBlobUrl(previewUrl);
          setDocumentPages(pageImages);
          setDocumentPageIndex(0);
          setDocumentPreviewUrl(pageImages[0]);
        }
      } else {
        setDocumentPreviewUrl(previewUrl);
        setDocumentPages([previewUrl]);
      }

      toast('Documento cargado', {
        description: file.name,
      });
    } catch (error) {
      console.error('Error processing document:', error);
      toast('No se pudo procesar el documento.');
    } finally {
      setDocumentProcessingFiles(false);
    }
  }, [getPdfJs, isPdfDocument, isSupportedDocument, loadPdfDocument, revokeAllKnownBlobUrls]);

  const openDocumentUploadModal = useCallback(() => {
    setShowDocumentModal(true);
  }, []);

  const closeDocumentModal = useCallback(() => {
    resetDocumentState();
    setShowDocumentModal(false);
  }, [resetDocumentState]);

  const onDocumentModalOpenChange = useCallback((open) => {
    if (!open) {
      closeDocumentModal();
      return;
    }
    setShowDocumentModal(true);
  }, [closeDocumentModal]);

  const buildCurrentPageFile = useCallback(async () => {
    if (!currentDocumentPageUrl || isPdfObjectFallback) {
      return documentFile;
    }

    const response = await fetch(currentDocumentPageUrl);
    const blob = await response.blob();
    const mimeType = blob.type || 'image/png';
    const extension = mimeType.includes('jpeg') ? 'jpg' : 'png';
    const baseName = getFileBaseName(documentFile?.name, 'document');
    const fileName = `${baseName}_page_${documentPageIndex + 1}.${extension}`;

    return new File([blob], fileName, { type: mimeType });
  }, [currentDocumentPageUrl, documentFile, documentPageIndex, isPdfObjectFallback]);

  const runDocumentOCR = useCallback(async () => {
    if (!documentFile) {
      toast('No hay documento', { description: 'Sube un documento antes de ejecutar OCR.' });
      return;
    }

    const sourceLanguage = documentSourceLanguage || 'spa';
    const corners = documentCornersByPage[documentPageIndex] || null;

    setDocumentIsRunning(true);
    try {
      const fileForOCR = await buildCurrentPageFile();
      if (!fileForOCR) {
        throw new Error('No se pudo preparar el archivo para OCR.');
      }

      const formData = new FormData();
      formData.append('files', fileForOCR, fileForOCR.name);
      formData.append('src_languages', sourceLanguage);

      if (corners) {
        Object.entries(corners).forEach(([key, value]) => {
          formData.append(key, String(value));
        });
      }

      const results = await runOCR(formData);
      const validResults = Array.isArray(results) ? results : [];
      const extractedText = validResults
        .map((result) => (result?.text || '').trim())
        .filter(Boolean)
        .join('\n\n')
        .trim();

      const firstError = validResults.find((result) => result?.error)?.error;
      const emptyMessage = `No se encontro texto en pagina ${documentPageIndex + 1}.`;

      setDocumentOcrByPage((prev) => ({
        ...prev,
        [documentPageIndex]: extractedText || emptyMessage,
      }));

      if (extractedText) {
        toast('OCR completado');
      } else if (firstError) {
        toast('OCR completado con errores', {
          description: firstError,
        });
      } else {
        toast('No se detecto texto en la pagina actual.');
      }
    } catch (error) {
      console.error('Document OCR failed:', error);
      const apiError =
        error?.response?.data?.error ||
        error?.response?.data?.detail ||
        'Intenta nuevamente con otro archivo o formato.';
      toast('No se pudo ejecutar OCR', {
        description: apiError,
      });
    } finally {
      setDocumentIsRunning(false);
    }
  }, [
    buildCurrentPageFile,
    documentCornersByPage,
    documentFile,
    documentPageIndex,
    documentSourceLanguage,
  ]);

  return {
    DOCUMENT_LANGUAGE_OPTIONS,
    showDocumentModal,
    documentDragActive,
    documentFile,
    documentPages,
    documentPageIndex,
    documentPreviewUrl,
    documentZoom,
    documentRotation,
    documentCropMode,
    documentCropSelection,
    documentPan,
    documentPanDragging,
    documentPageHistory,
    documentOcrByPage,
    documentCornersByPage,
    documentIsRunning,
    documentProcessingFiles,
    documentSourceLanguage,
    docInputRef,
    documentViewportRef,
    documentImageRef,
    currentDocumentPageUrl,
    currentDocumentResultText,
    isPdfObjectFallback,

    setDocumentDragActive,
    setDocumentCropMode,
    setDocumentCropSelection,
    setDocumentCropDragging,
    setDocumentCropStart,
    setDocumentOcrByPage,
    setDocumentSourceLanguage,

    openDocumentUploadModal,
    closeDocumentModal,
    onDocumentModalOpenChange,
    handleDocumentPicked,
    runDocumentOCR,
    goToDocumentPage,
    handleDocumentZoomIn,
    handleDocumentZoomOut,
    handleDocumentRotate,
    handleDocumentUndoCurrentPage,
    handleDocumentClear,
    handleDocumentViewportMouseDown,
    handleDocumentViewportMouseMove,
    handleDocumentViewportMouseUp,
  };
}
