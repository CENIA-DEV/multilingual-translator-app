import React from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMicrophone, faSpinner, faArrowRight } from '@fortawesome/free-solid-svg-icons';

export function RecordingModal({
  showRecordModal,
  setShowRecordModal,
  handleFullCancel,
  asrStatus,
  setAsrStatus,
  isRecording,
  startRecording,
  stopRecording,
  cancelTranscription,
  waveCanvasRef,
  recordingSeconds,
  transcribeChoice,
  setTranscribeChoice,
  srcHint,
  dstHint,
  srcDisplay,
  dstDisplay,
  reviewTranscript,
  setReviewTranscript,
  lastRecordingUrl,
  reviewAudioRef,
  resetAudioState,
  safeUnloadReviewAudio,
  lastRecordingBlobRef,
  startTranslationFromReview,
  isSubmittingValidation
}) {
  return (
    <Dialog
      open={showRecordModal}
      onOpenChange={(open) => {
        if (!open) {
          handleFullCancel();
        } else {
          setShowRecordModal(true);
          setTranscribeChoice(srcHint ? 'source' : (dstHint ? 'target' : 'source'));
          setReviewTranscript('');
          setAsrStatus((prev) => (prev === 'recording' ? prev : 'ready'));
        }
      }}
    >
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={() => handleFullCancel()}
        className="w-[min(800px,90vw)] max-w-none gap-y-4 py-5"
      >	
        {asrStatus === 'ready' && !isRecording && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <button
                onClick={startRecording}
                className="w-14 h-14 rounded-full bg-[#0a8cde] flex items-center justify-center shadow hover:shadow-md transition appearance-none border-0 outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 focus-visible:ring-2 focus-visible:ring-[#0a8cde] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                title="Iniciar grabación"
                aria-label="Iniciar grabación"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <FontAwesomeIcon icon={faMicrophone} className="fa-lg" color="#ffffff" />
              </button>
              <div>
                <button
                  onClick={startRecording}
                  className="text-[#0a8cde] font-medium"
                >
                  Iniciar grabación
                </button>
                <p className="text-xs text-slate-500 mt-1">
                  Recuerda activar el micrófono en tu dispositivo.
                </p>
              </div>
            </div>

            <div className="pt-1">
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-600">Estás hablando en</span>
                <div className="inline-flex rounded-full border border-slate-200 bg-white p-1">
                  <button
                    onClick={() => setTranscribeChoice('source')}
                    className={`px-3 py-1 text-sm rounded-full transition border ${
                      transcribeChoice === 'source'
                        ? 'bg-[#0a8cde] text-white border-[#0a8cde]'
                        : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
                    }`}
                  >
                    {srcDisplay}
                  </button>
                  <button
                    onClick={() => dstHint && setTranscribeChoice('target')}
                    disabled={!dstHint}
                    className={`ml-1 px-3 py-1 text-sm rounded-full transition border ${
                      transcribeChoice === 'target'
                        ? 'bg-[#0a8cde] text-white border-[#0a8cde]'
                        : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
                    } ${!dstHint ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {dstDisplay}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {isRecording && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <button
                onClick={stopRecording}
                className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center shadow hover:shadow-md transition"
                title="Detener grabación"
                aria-label="Detener grabación"
              >
                <span className="block w-3.5 h-3.5 bg-white" />
              </button>
              <p className="text-sm font-medium text-red-600">Detener grabación</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-2">
              <canvas ref={waveCanvasRef} className="w-full h-44 rounded" />
            </div>
            <span className="text-xs font-mono px-2 py-1 rounded bg-white/80 border border-slate-200">
              {String(recordingSeconds).padStart(2, '0')}s
            </span>
          </div>
        )}
        
        {!isRecording && (asrStatus === 'transcribing' || asrStatus === 'processing') && (
          <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
            <div className="flex items-center gap-3">
              <FontAwesomeIcon icon={faSpinner} className="fa-spin" />
              <span>Transcribiendo…</span>
            </div>
            <Button
              variant="outline"
              onClick={cancelTranscription}
              className="ml-auto"
            >
              Cancelar
            </Button>
          </div>
        )}
        
        {!isRecording && asrStatus === 'reviewing' && lastRecordingUrl.current && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Transcripción ({transcribeChoice === 'source' ? srcDisplay : dstDisplay})
              </label>
              <textarea
                className="w-full h-40 p-3 rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0a8cde]"
                value={reviewTranscript}
                onChange={(e) => setReviewTranscript(e.target.value)}
                placeholder="Revisa o edita la transcripción…"
              />
            </div>
            <audio
              ref={reviewAudioRef}
              src={lastRecordingUrl.current}
              controls
              preload="metadata"
              className="w-full"
              onError={(e) => {
                const err = e.currentTarget.error;
                console.debug('Audio element error:', err?.message || err);
              }}
            />
            <div className="flex flex-wrap gap-2 justify-between">
              <Button
                variant="outline"
                onClick={() => { resetAudioState(); setShowRecordModal(false); }}
              >
                Cancelar
              </Button>
              <div className="flex gap-2">
                <Button
                  className="bg-[#068cdc1a] text-default text-sm font-medium hover:bg-default hover:text-white"
                  onClick={() => {
                    safeUnloadReviewAudio();
                    lastRecordingBlobRef.current = null;
                    setReviewTranscript('');
                    setTranscribeChoice(srcHint ? 'source' : (dstHint ? 'target' : 'source'));
                    setAsrStatus('ready');
                    setShowRecordModal(true);
                  }}
                >
                  <FontAwesomeIcon icon={faMicrophone} className="mr-2" />
                  Volver a grabar
                </Button>
                <Button
                  className="bg-[#0a8cde] text-white text-sm font-medium hover:bg-[#067ac1]"
                  onClick={startTranslationFromReview}
                  disabled={isSubmittingValidation}
                >
                  Comenzar traducción
                  <FontAwesomeIcon icon={faArrowRight} className="ml-2" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
