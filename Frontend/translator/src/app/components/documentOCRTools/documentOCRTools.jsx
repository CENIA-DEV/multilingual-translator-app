import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFileArrowUp,
  faMagnifyingGlassPlus,
  faMagnifyingGlassMinus,
  faRotateRight,
  faArrowRotateLeft,
  faCrop,
  faChevronLeft,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useDocumentProcessing } from '@/hooks/useDocumentProcessing';

export default function DocumentOCRTools({
  visible,
  translationRestricted,
  onRestricted,
}) {
  const {
    showDocumentModal,
    documentDragActive,
    documentFile,
    documentPages,
    documentPageIndex,
    documentZoom,
    documentRotation,
    documentCropMode,
    documentCropSelection,
    documentPan,
    documentPanDragging,
    documentPageHistory,
    documentIsRunning,
    documentProcessingFiles,
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
    openDocumentUploadModal,
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
  } = useDocumentProcessing();

  const handleOpen = () => {
    if (translationRestricted) {
      onRestricted?.();
      return;
    }
    openDocumentUploadModal();
  };

  return (
    <>
      {visible && (
        <button
          type="button"
          className="max-[850px]:hidden box-content w-[50px] h-[50px] rounded-full flex justify-center items-center bg-white z-[3] cursor-pointer border-[8px] border-[#0a8cde] shadow-[0px_0px_hsla(0,100%,100%,0.333)] transform transition-all duration-300 hover:scale-110"
          title="Subir documento"
          aria-label="Subir documento"
          onClick={handleOpen}
        >
          <FontAwesomeIcon icon={faFileArrowUp} className="text-[1.3em]" color="#0a8cde" />
        </button>
      )}

      <Dialog open={showDocumentModal} onOpenChange={onDocumentModalOpenChange}>
        <DialogContent className="w-[min(1100px,96vw)] max-w-none p-0 overflow-hidden bg-white border border-slate-200">
          <div className="px-5 pt-5 pb-2 text-[#0f172a]">
            <DialogHeader>
              <DialogTitle className="text-2xl font-semibold text-[#0a8cde]">Extraccion de documento</DialogTitle>
              <DialogDescription className="sr-only">
                Modal para cargar, previsualizar y extraer texto desde documentos.
              </DialogDescription>
            </DialogHeader>
            <p className="text-sm text-slate-500 mt-1">Sube un PDF o imagen para extraer su contenido.</p>
          </div>

          <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-[1.05fr_1fr] gap-4">
            <div
              className={`rounded-3xl border-2 border-dashed min-h-[420px] bg-[#f8fbff] transition relative overflow-hidden ${
                documentDragActive ? 'border-[#0a8cde] bg-[#eef7ff]' : 'border-[#cfe6f8]'
              }`}
              onDragEnter={(e) => {
                e.preventDefault();
                setDocumentDragActive(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDocumentDragActive(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setDocumentDragActive(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDocumentDragActive(false);
                const file = e.dataTransfer?.files?.[0];
                handleDocumentPicked(file);
              }}
            >
              {!documentFile ? (
                <div className="min-h-[420px] h-full flex flex-col items-center justify-center text-center px-8 bg-white/95">
                  <FontAwesomeIcon icon={faFileArrowUp} className="text-5xl text-[#0a8cde] mb-5" />
                  <p className="text-3xl text-slate-800 font-semibold">Sube un archivo</p>
                  <p className="text-slate-500 mt-2">Solamente archivos PDF, JPEG o PNG</p>
                  <input
                    ref={docInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    hidden
                    onChange={(e) => {
                      const file = e.currentTarget.files?.[0];
                      handleDocumentPicked(file);
                      e.currentTarget.value = '';
                    }}
                  />
                  <button
                    type="button"
                    className="mt-6 rounded-full bg-[#0a8cde] px-6 py-2 text-white font-semibold hover:bg-[#067ac1] transition"
                    onClick={() => docInputRef.current?.click()}
                  >
                    Seleccionar archivo
                  </button>
                </div>
              ) : (
                <div className="w-full h-full p-3 sm:p-4 flex flex-col gap-3">
                  <div className="rounded-2xl bg-[#eaf5ff] min-h-[360px] relative overflow-hidden border border-[#cfe6f8]">
                    <div className="absolute left-3 top-3 bottom-3 w-11 rounded-2xl bg-[#0a8cde] border border-[#66b8e8] z-10 flex flex-col items-center py-3 gap-3">
                      <button
                        type="button"
                        title="Acercar"
                        aria-label="Acercar"
                        className={`w-7 h-7 rounded-full text-white/90 hover:bg-white/15 ${isPdfObjectFallback ? 'opacity-40 cursor-not-allowed' : ''}`}
                        onClick={handleDocumentZoomIn}
                        disabled={isPdfObjectFallback}
                      >
                        <FontAwesomeIcon icon={faMagnifyingGlassPlus} />
                      </button>
                      <button
                        type="button"
                        title="Alejar"
                        aria-label="Alejar"
                        className={`w-7 h-7 rounded-full text-white/90 hover:bg-white/15 ${isPdfObjectFallback ? 'opacity-40 cursor-not-allowed' : ''}`}
                        onClick={handleDocumentZoomOut}
                        disabled={isPdfObjectFallback}
                      >
                        <FontAwesomeIcon icon={faMagnifyingGlassMinus} />
                      </button>
                      <button
                        type="button"
                        title="Rotar"
                        aria-label="Rotar"
                        className={`w-7 h-7 rounded-full text-white/90 hover:bg-white/15 ${isPdfObjectFallback ? 'opacity-40 cursor-not-allowed' : ''}`}
                        onClick={handleDocumentRotate}
                        disabled={isPdfObjectFallback}
                      >
                        <FontAwesomeIcon icon={faRotateRight} />
                      </button>
                      <button
                        type="button"
                        title="Deshacer"
                        aria-label="Deshacer"
                        className={`w-7 h-7 rounded-full text-white/90 hover:bg-white/15 ${isPdfObjectFallback || !(documentPageHistory[documentPageIndex]?.length) ? 'opacity-40 cursor-not-allowed' : ''}`}
                        onClick={handleDocumentUndoCurrentPage}
                        disabled={isPdfObjectFallback || !(documentPageHistory[documentPageIndex]?.length)}
                      >
                        <FontAwesomeIcon icon={faArrowRotateLeft} />
                      </button>
                      <button
                        type="button"
                        title={documentCropMode ? 'Aplicar recorte' : 'Recortar'}
                        aria-label={documentCropMode ? 'Aplicar recorte' : 'Recortar'}
                        className={`w-7 h-7 rounded-full text-white/90 hover:bg-white/15 ${documentCropMode ? 'bg-white/20' : ''} ${isPdfObjectFallback ? 'opacity-40 cursor-not-allowed' : ''}`}
                        onClick={() => {
                          setDocumentCropMode((prev) => !prev);
                          setDocumentCropSelection(null);
                          setDocumentCropDragging(false);
                          setDocumentCropStart(null);
                        }}
                        disabled={isPdfObjectFallback}
                      >
                        <FontAwesomeIcon icon={faCrop} />
                      </button>
                    </div>

                    <div className="absolute top-3 right-3 z-10 rounded-full bg-[#045f98] text-white/90 text-xs px-3 py-1">
                      {documentPages.length ? `${documentPageIndex + 1} / ${documentPages.length}` : '0 / 0'}
                    </div>

                    <div className="h-full w-full p-4 pl-16 flex items-center justify-center">
                      {!currentDocumentPageUrl ? (
                        <div className="text-white/80 text-center px-4">
                          {documentProcessingFiles ? 'Cargando...' : 'No se pudo generar vista previa editable para este archivo.'}
                        </div>
                      ) : isPdfObjectFallback ? (
                        <div className="w-full h-[460px] rounded-lg overflow-hidden shadow-[0_14px_36px_rgba(10,17,51,0.35)] bg-[#f1f5f9] flex items-center justify-center text-slate-600 px-4 text-center">
                          PDF cargado sin paginas editables. Sube un PDF estandar para activar recorte y rotacion.
                        </div>
                      ) : (
                        <div
                          ref={documentViewportRef}
                          className="relative max-h-[460px] w-full flex items-center justify-center select-none"
                          onMouseDown={handleDocumentViewportMouseDown}
                          onMouseMove={handleDocumentViewportMouseMove}
                          onMouseUp={handleDocumentViewportMouseUp}
                          onMouseLeave={handleDocumentViewportMouseUp}
                          style={{
                            cursor: documentCropMode
                              ? 'crosshair'
                              : (currentDocumentPageUrl && !isPdfObjectFallback
                                  ? (documentPanDragging ? 'grabbing' : 'grab')
                                  : 'default'),
                          }}
                        >
                          <img
                            ref={documentImageRef}
                            src={currentDocumentPageUrl}
                            alt={`Vista previa pagina ${documentPageIndex + 1}`}
                            style={{
                              transform: `translate(${documentPan.x}px, ${documentPan.y}px) scale(${documentZoom}) rotate(${documentRotation}deg)`,
                              transformOrigin: 'center center',
                              transition: 'transform 0.2s',
                              maxHeight: '460px',
                              maxWidth: '100%',
                              objectFit: 'contain'
                            }}
                            className="pointer-events-none rounded-sm shadow-[0_14px_36px_rgba(10,17,51,0.35)]"
                          />
                          {documentCropMode && documentCropSelection && (
                            <div
                              className="absolute border-2 border-dashed border-[#facc15] bg-[#facc1522] rounded-sm pointer-events-none"
                              style={{
                                left: `${documentCropSelection.x}px`,
                                top: `${documentCropSelection.y}px`,
                                width: `${documentCropSelection.w}px`,
                                height: `${documentCropSelection.h}px`,
                              }}
                            />
                          )}
                        </div>
                      )}
                    </div>

                    {documentPages.length > 1 && (
                      <>
                        <button
                          type="button"
                          className="absolute left-14 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-[#056fb0] text-white hover:bg-[#045f98]"
                          onClick={() => goToDocumentPage(documentPageIndex - 1)}
                          disabled={documentPageIndex === 0}
                          aria-label="Pagina anterior"
                          title="Pagina anterior"
                        >
                          <FontAwesomeIcon icon={faChevronLeft} />
                        </button>
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-[#056fb0] text-white hover:bg-[#045f98]"
                          onClick={() => goToDocumentPage(documentPageIndex + 1)}
                          disabled={documentPageIndex === documentPages.length - 1}
                          aria-label="Pagina siguiente"
                          title="Pagina siguiente"
                        >
                          <FontAwesomeIcon icon={faChevronRight} />
                        </button>
                      </>
                    )}
                  </div>

                  {documentPages.length > 0 && (
                    <>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          className="rounded-md border border-[#b7d8f4] bg-white px-3 py-1 text-xs font-medium text-[#0a8cde] transition hover:bg-[#f5fbff]"
                          onClick={handleDocumentClear}
                          title="Escanear otro documento"
                          aria-label="Escanear otro documento"
                        >
                          Escanear otro documento
                        </button>
                      </div>

                      <div className="rounded-2xl bg-[#eaf5ff] border border-[#cfe6f8] px-3 py-2 overflow-x-auto">
                        <div className="flex items-center gap-2 min-w-max">
                          {documentPages.map((pageUrl, index) => (
                            <button
                              key={`${pageUrl.slice(0, 24)}-${index}`}
                              type="button"
                              onClick={() => goToDocumentPage(index)}
                              className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition ${
                                index === documentPageIndex ? 'border-white shadow-[0_0_0_2px_#056fb0]' : 'border-transparent opacity-75 hover:opacity-100'
                              }`}
                              title={`Pagina ${index + 1}`}
                              aria-label={`Pagina ${index + 1}`}
                            >
                              <img src={pageUrl} alt={`Miniatura ${index + 1}`} className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-3xl overflow-hidden bg-white border border-slate-200 min-h-[420px]">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3 bg-[#f8fafc]">
                <p className="text-sm font-semibold text-slate-700">
                  Escaner Pagina {documentPages.length ? documentPageIndex + 1 : 0}
                </p>
                <Button
                  className="bg-[#0a8cde] text-white hover:bg-[#0a8cde]"
                  onClick={runDocumentOCR}
                  disabled={!documentFile || documentIsRunning || documentProcessingFiles}
                >
                  {documentIsRunning ? 'Escaneando...' : 'Escanear documento'}
                </Button>
              </div>

              <div className="h-[calc(100%-4rem)] p-6">
                {!documentFile ? (
                  <div className="h-full flex items-center justify-center text-center">
                    <p className="text-slate-400 text-2xl">Sube un documento para ver resultados</p>
                  </div>
                ) : (
                  <textarea
                    className="w-full h-full bg-transparent p-0 text-slate-700 text-sm resize-none border-0 focus:outline-none"
                    value={currentDocumentResultText || 'Todavia no se extrae el texto de esta pagina'}
                    onChange={(e) =>
                      setDocumentOcrByPage((prev) => ({
                        ...prev,
                        [documentPageIndex]: e.target.value,
                      }))
                    }
                  />
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
