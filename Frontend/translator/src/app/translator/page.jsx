/* Copyright 2024 Centro Nacional de Inteligencia Artificial (CENIA, Chile). All rights reserved.

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

import { useState, useEffect, useContext, useRef } from 'react'
import "./translator.css"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faThumbsDown,
  faThumbsUp,
  faArrowsRotate,
  faArrowRightArrowLeft,
  faArrowRight,
  faLock,
  faVolumeHigh,
  faStop,
  faSpinner,
  faMicrophone,
  faPlus,
  faPaperPlane, 
  faXmark,
  faComment
} from "@fortawesome/free-solid-svg-icons";
import Card from "../components/card/card.jsx"
import FeedbackModal from '../components/feedbackModal/feedbackModal.jsx'
import LangsModal from '../components/langsModal/langsModal.jsx'
import { isTranslationRestricted, isASRRestricted, isTTSRestricted, MAX_WORDS_TRANSLATION, AUTOFILL_TRANSCRIPT, MAX_AUDIO_MB, TTS_ENABLED, ASR_ENABLED } from '../constants';
import { VARIANT_LANG } from "@/app/constants";
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAnalytics } from '@/hooks/useAnalytics';
import { AuthContext } from '../contexts';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import { useWaveform } from '../../hooks/useWaveform';
import { validateTranscriptionApi } from '../services/asrService';
import { useASR } from '../../hooks/useASR';
import { getLanguages, translateText, submitPositiveFeedback } from '../services/translationService';

export default function Translator() {

  const [srcText, setSrcText] = useState('');
  const [showSrcTextMessage, setShowSrcTextMessage] = useState(false);
  const [dstText, setDstText] = useState('');
  const [srcLang, setSrcLang] = useState({
    "name": "Español",
    "writing": "Latn",
    "code": "spa_Latn",
    "dialect": null
  });
  const [dstLang, setDstLang] = useState(VARIANT_LANG === 'arn'? {
    "name": "Huilliche Azümchefe",
    "writing": "a0",
    "code": 'arn_a0_h',
    "dialect": "n"
  } : {
    "name": "Rapa Nui",
    "writing": "Latn",
    "code": "rap_Latn",
    "dialect": null
  });
  
  const { isSpeaking, ttsError, isLoadingAudio, handleSpeak: handleSpeakBase, stopSpeaking: stopSpeakingBase, getAudioContext } = useAudioPlayer();

  const { trackEvent } = useAnalytics();

  
  const {
    isRecording, asrStatus, recordingSeconds, reviewTranscript, transcribeChoice, currentAsrId,
    setTranscribeChoice, setReviewTranscript, setCurrentAsrId, setAsrStatus,
    mediaRecorderRef, mediaStreamRef, prevStopAtRef, recorderBusyRef, chunksRef,
    lastRecordingUrl, lastRecordingBlobRef, reviewAudioRef, dropFirstChunkRef,
    recordingTimeoutRef, recordingStartedAtRef, recordingIntervalRef, stopSafeguardRef, asrAbortRef,
    asrWarmupDoneRef, lastAsrActivityRef,
    startRecording, stopRecording, cancelTranscription, resetAudioState, handleTranscribeBlob,
    transcribeForReview, triggerASRWarmupIfNeeded, getPreferredMime, waitForTrackUnmute,
    waitForInputEnergy, safeUnloadReviewAudio, stopMicTracksNow, getBlobDuration
  } = useASR({ getAudioContext, trackEvent });

  const [langModalMode, setLangModalMode] = useState(false);
  const [modalBtnSide, setModalBtnSide] = useState('');

  const [feedbackData, setFeedbackData] = useState(null);
  const [modelData, setModelData] = useState(null);
  const [isSuggestionOnlyMode, setIsSuggestionOnlyMode] = useState(false);

  const [loadingState, setLoadingState] = useState(false);
  const [copyReady, setCopyReady] = useState(false);
  const [suppressNextAutoTranslate, setSuppressNextAutoTranslate] = useState(false);

  const [showDevModal, setShowDevModal] = useState(true);
  
  // Record modal
  const [showRecordModal, setShowRecordModal] = useState(false);
  const {
    waveCanvasRef,
    pulseRef,
    startWaveformVisualization,
    stopWaveformVisualization,
    waveAnalyserRef
  } = useWaveform(getAudioContext);

  const router = useRouter()

  const [isMobile, setIsMobile] = useState(false);

  const currentUser = useContext(AuthContext);
  const isLoggedIn = !!currentUser;

  // Check if translation is restricted for current user
  const translationRestricted = isTranslationRestricted(currentUser);
  const [translationRestrictedDialogOpen, setTranslationRestrictedDialogOpen] = useState(translationRestricted);


  // Check if ASR and TTS are restricted for current user
  const ASRRestricted = isASRRestricted(currentUser);
  const TTSRestricted = isTTSRestricted(currentUser);

  // --- Language helpers for button visibility---
  const codeOf = (l) => (l?.code || '').toLowerCase(); // 'spa_Latn','eng_Latn','rap_Latn',…
  const isES  = (l) => codeOf(l).startsWith('spa');
  const isEN  = (l) => codeOf(l).startsWith('eng');
  const isRAP = (l) => codeOf(l).startsWith('rap');

  // TTS (API-only): Only RAP if TTS_ENABLED
  const isTTSSideAllowed = (l) => TTS_ENABLED && isRAP(l);

  // ASR helpers - only if ASR_ENABLED
  const isASRLang = (l) => ASR_ENABLED && (isES(l) || isRAP(l)); // ASR works for Spanish and Rapa Nui
  const isASRSourceAllowed = (l) => ASR_ENABLED && isES(l); // Upload audio only available for Spanish source

  // --- dinamics flags ---

  // TTS buttons: only show if not restricted OR user is logged in
  // const TTS_ENABLED_SRC_D = !TTSRestricted && isTTSSideAllowed(srcLang);
  // const TTS_ENABLED_DST_D = !TTSRestricted && isTTSSideAllowed(dstLang);
  // Make visibility depend on being logged in to avoid dead clicks.
  const TTS_ENABLED_SRC_D = isTTSSideAllowed(srcLang);
  const TTS_ENABLED_DST_D = isTTSSideAllowed(dstLang);
  
  const ANY_TTS_VISIBLE = TTS_ENABLED_SRC_D || TTS_ENABLED_DST_D;

  // ASR buttons: show if language is supported
  const ASR_MIC_VISIBLE_D = isASRLang(srcLang) || isASRLang(dstLang);
  const ASR_UPLOAD_VISIBLE_D = isASRSourceAllowed(srcLang);

  const getLangs = async (code, script, dialect) => {
    try {
      const data = await getLanguages(code, script, dialect);
      console.log(data);
      return data;
    } catch (error) {
      console.log('Error getting languages');
    }
  }  

  const handleSrcLang = lang =>{
    setSrcLang(lang);
  };

  const handleDstLang = lang => {
    setDstLang(lang);
  };

  const handleLangModalBtnLeft = () => {
    setModalBtnSide('left');
    setLangModalMode(true);
  };

  const handleLangModalBtnRight = () => {
    setModalBtnSide('right');
    setLangModalMode(true);
  };

  const handleCrossLang = async () => {
    if(loadingState === false && !isLoadingAudio){
      setLoadingState(true);
      setSrcText(dstText);
      setSrcLang(dstLang);
      setDstLang(srcLang);
      await new Promise(resolve => setTimeout(resolve, 1000));
      setDstText(srcText);
      setLoadingState(false);
      trackEvent('button_cross_lang_click', {
        src_lang: srcLang,
        dst_lang: dstLang,
        page: 'translator'
      });
    }
  };
 
  const handleSelectedLangModal = (lang) => {
    if (modalBtnSide === 'left'){
      setSrcLang(lang);
    }
    else{
      setDstLang(lang);
    }
    setModalBtnSide('');
    setLangModalMode(false);
  };

  const handleNegativeFeedback = () => {
    if (dstText.length != 0 && !loadingState){
      setIsSuggestionOnlyMode(false);
      setFeedbackData({
        'src_text': srcText,
        'dst_text': dstText,
        'src_lang': srcLang,
        'dst_lang': dstLang,
        'suggestion': dstText,
        'is_uncertain': false
      });
    }
  };

  const handlePositiveFeedback = async () => {
    if (dstText.length != 0 && !loadingState){
      try {
        await submitPositiveFeedback(
          srcText,
          dstText,
          srcLang,
          dstLang,
          modelData.modelName,
          modelData.modelVersion
        );

        toast("Sugerencia enviada con éxito",{
          description: "Gracias por su retroalimentación",
          cancel: {
            label: 'Cerrar',
            onClick: () => console.log('Pop up cerrado'),
          },
        });
        trackEvent('positive_feedback_submit_success', {
          model_name: modelData.modelName,
          model_version: modelData.modelVersion,
          page: 'translator'
        });
      } catch(error) {
        if (error.response.status === 401){
          toast("Error",{
            description: "Debe ingresar su usuario para ocupar todas las funcionalidades de la aplicación",
            cancel: {
              label: 'Cerrar',
              onClick: () => console.log('Pop up cerrado'),
            },
          })
        }
        console.log(error) 
        trackEvent('positive_feedback_submit_error', {
          page: 'translator',
          error: error.response.status
        });
      }
    }
  };

  const handleSuggestionFeedback = () => {
    if (!loadingState){
      setIsSuggestionOnlyMode(true);
      setFeedbackData({
        'comment': '', 
      });
      trackEvent('suggestion_feedback_click', {
        page: 'translator'
      });
    }
  };

  const reqIdRef = useRef(null);
  const autoTranslateTimerRef = useRef(null);   // NEW
  const translateLockRef = useRef(false);       // NEW

  // Ensure manual click doesn’t collide with the auto-translate effect
  const handleTranslate = async () => {
    // Check if translation is restricted FIRST
    if (translationRestricted) {
      setTranslationRestrictedDialogOpen(true);
      return;
    }
    
    if (translateLockRef.current) return;     // prevent double-click
    translateLockRef.current = true;

    // cancel any pending auto-translate
    if (autoTranslateTimerRef.current) {
      clearTimeout(autoTranslateTimerRef.current);
      autoTranslateTimerRef.current = null;
    }

    setSuppressNextAutoTranslate(true);
    await translate();
    translateLockRef.current = false;
  }

  const handleLogin = () => {
    router.push('/login');
  }

  function limitWordsPreserveLines(text, maxWords) {
    let wordCount = 0;
    let inWord = false; // if we are in a word
    let i = 0;
    for (; i < text.length; i++) {
      if (/\S/.test(text[i])) { // not whitespace
        if (!inWord) { // then start of a word
          wordCount++;
          inWord = true;
          if (wordCount > maxWords) break;
        }
      } else { // then end of a word 
        inWord = false;
      }
    }
    return text.slice(0, i);
  }

  // MODIFY: handleSrcText to trigger warmup on first typing
  const handleSrcText = (text) => {
    console.log(text);
    console.log(text.trim().split(/\n+/).length);
    const textList = text.trim().split(/\s+/).filter(word => word.length > 0);
    const wordCount = textList.length;
    console.log(wordCount);
    
    // NEW: Trigger ASR warmup when user starts typing (if ASR is available)
    if (text.length > 0 && (isASRLang(srcLang) || isASRLang(dstLang))) {
      triggerASRWarmupIfNeeded();
    }
    
    // if the text is longer than the max words, limit the text to the max words
    // while preserving the structure (newlines)
    if (wordCount > MAX_WORDS_TRANSLATION){
      text = limitWordsPreserveLines(text, MAX_WORDS_TRANSLATION);
      setSrcText(text);
      setShowSrcTextMessage(true);
      setTimeout(() => {
        setShowSrcTextMessage(false);
        console.log(text.split(/\n+/).length);
      }, 3000);
    }
    else{
      setShowSrcTextMessage(false);
      setSrcText(text);
      console.log(text.split(/\n+/).length);
    }
  }

  const handleCopyText = async () => {
    if (dstText && dstText.length > 0) {
      try {
        await navigator.clipboard.writeText(dstText);
        setCopyReady(true);
        setTimeout(() => {
          setCopyReady(false);
        }, 2000);
      }
      catch (error) {
        toast("Error al copiar", {
          description: "No se pudo copiar el texto al portapapeles",
          cancel: {
            label: 'Cerrar',
            onClick: () => console.log('Pop up cerrado'),
          },
        });
      }
    }
  }
  
  // Fully cancel the voice flow: abort ASR, stop recording, reset, and close
  const handleFullCancel = () => {
    try { asrAbortRef.current?.abort(); } catch {}
    asrAbortRef.current = null;
    if (isRecording) {
      try { stopRecording(); } catch {}
    }
    resetAudioState();
    setShowRecordModal(false);
  };
  
  // TTS Wrapper Functions
  async function handleSpeak({ text, lang = 'es-ES', gender }) {
    if (TTSRestricted) {
      setTranslationRestrictedDialogOpen(true);
      toast("Debe iniciar sesión para usar la síntesis de voz", { duration: 4000 });
      return;
    }
    if (loadingState || isLoadingAudio) return; // prevent TTS while translating or already loading TTS
    
    // Give a notification if fetching takes longer than 3 seconds
    const timeoutId = setTimeout(() => {
      toast("El modelo de voz se está cargando...", { duration: 20000 });
    }, 3000);

    try {
      await handleSpeakBase({ text, lang, gender });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  function stopSpeaking() {
    stopSpeakingBase();
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
  }

  const translate = async () => {
    if (translationRestricted) { setTranslationRestrictedDialogOpen(true); return; }
    if (loadingState || isLoadingAudio) return;                      // extra guard
    if (srcText.length === 0) { setDstText(''); return; }
    setLoadingState(true);
    const startTime = performance.now();
    let timeoutId = setTimeout(() => {
      toast("La traducción está tardando más tiempo de lo esperado...", { duration: 20000 });
    }, 5000);

    try {
      const requestId = (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2));
      reqIdRef.current = requestId;

      const data = await translateText(
        srcText,
        srcLang,
        dstLang,
        requestId
      );

      clearTimeout(timeoutId);
      setDstText(data.dst_text);
      setModelData({ modelName: data.model_name, modelVersion: data.model_version });
      const endTime = performance.now();
      trackEvent('translation_success', { translation_time_ms: endTime - startTime, page: 'translator' });
    } catch (error) {
      clearTimeout(timeoutId);
      console.log('Request error:', error);
      if (!error?.response) {
        toast("No hay conexión con el backend", { description: "Verifique la URL del servidor." });
      } else if (error.response.status === 400) {
        toast("Error", { description: "Por favor reintente la traducción" });
      }
    } finally {
      setLoadingState(false);
    }
  }

  useEffect(() => {
    // Don't auto-translate if translation is restricted and user is not authenticated
    if (translationRestricted) {
      // Don't open dialog here - only show lock icon
      return;
    }

    // Don't auto-translate if explicitly suppressed (after ASR)
    if (suppressNextAutoTranslate) {
      setSuppressNextAutoTranslate(false);
      if (autoTranslateTimerRef.current) {
        clearTimeout(autoTranslateTimerRef.current);
        autoTranslateTimerRef.current = null;
      }
      return;
    }

    if (autoTranslateTimerRef.current) {
      clearTimeout(autoTranslateTimerRef.current);
      autoTranslateTimerRef.current = null;
    }
    autoTranslateTimerRef.current = setTimeout(() => {
      translate();
      autoTranslateTimerRef.current = null;
    }, 1500);

    return () => {
      if (autoTranslateTimerRef.current) {
        clearTimeout(autoTranslateTimerRef.current);
        autoTranslateTimerRef.current = null;
      }
    };
  }, [srcText, srcLang, dstLang, translationRestricted, suppressNextAutoTranslate]);
  
  // Start/attach the waveform once the modal is open, recording is true, and the canvas is mounted
  useEffect(() => {
    if (showRecordModal && isRecording && mediaStreamRef.current && waveCanvasRef.current && !waveAnalyserRef.current) {
      startWaveformVisualization(mediaStreamRef.current);
    }
  }, [showRecordModal, isRecording]);

  function inferHintFromSrcLang() {
    const code = (srcLang?.code || '').toLowerCase();
    if (code.includes('spa')) return 'spa_Latn';
    if (code.includes('rap')) return 'rap_Latn';
    if (code.includes('arn')) return 'arn_Latn';
    if (VARIANT_LANG === 'rap') return 'rap_Latn';
    if (VARIANT_LANG === 'arn') return 'arn_Latn';
    return 'spa_Latn';
  }
  
  function getHintForLang(l) {
    const c = (l?.code || '').toLowerCase();
    if (c.includes('spa')) return 'spa_Latn';
    if (c.includes('rap')) return 'rap_Latn';
    return null; // not transcribable
  }
  
  const srcHint = getHintForLang(srcLang);
  const dstHint = getHintForLang(dstLang);
  const srcDisplay = srcLang?.name || 'Fuente';
  const dstDisplay = dstLang?.name || 'Destino';

  const [isSubmittingValidation, setIsSubmittingValidation] = useState(false);

  // Function to validate transcription
  async function validateTranscription(asrId, editedText) {
    if (!asrId || !editedText?.trim() || isSubmittingValidation) return;
    
    setIsSubmittingValidation(true);
    try {
      const data = await validateTranscriptionApi(asrId, editedText.trim());
      
      console.log('Validation successful:', data);
      trackEvent('asr_transcription_validated', {
        asr_id: asrId,
        was_edited: editedText !== reviewTranscript,
        page: 'translator'
      });
      return true;
    } catch (err) {
      console.error('Failed to validate transcription:', err);
      if (err?.response?.status && err.response.status !== 200) {
        toast('No se pudo guardar la validación', {
          description: 'La transcripción se usará de todas formas.',
        });
      }
      return false;
    } finally {
      setIsSubmittingValidation(false);
    }
  }

  // Start translation from the review text ---
  async function startTranslationFromReview() {
    if (isSubmittingValidation) return; // Prevent double-submit
    
    const chosenText = (reviewTranscript || '').trim();
    if (!chosenText) {
      toast('No hay texto para traducir.');
      return;
    }
    
    // NEW: Validate transcription before translating
    if (currentAsrId) {
      const validated = await validateTranscription(currentAsrId, chosenText);
      console.log('Validation result:', validated);
    }
    
    // If user chose to transcribe the target side, swap langs before translating
    if (transcribeChoice === 'target') {
      const prevSrc = srcLang, prevDst = dstLang;
      setSrcLang(prevDst);
      setDstLang(prevSrc);
    }
    
    // Populate src text and trigger translation
    setSuppressNextAutoTranslate(true);
    setSrcText(chosenText);
    setShowRecordModal(false);
    
    // Clean audio state
    resetAudioState();
    setCurrentAsrId(null);
    
    // Trigger translation
    setTimeout(() => translate(), 0);
  }

  useEffect(() => {
    return () => {
      if (lastRecordingUrl.current) {
        URL.revokeObjectURL(lastRecordingUrl.current);
      }
    };
  }, []);
  
  const handleClearTexts = () => {
    setSrcText('');
    setDstText('');
    setShowSrcTextMessage(false);
  };

  const isBusy = asrStatus === 'transcribing' || asrStatus === 'processing';

  return (
    <div className="translator-container relative min-h-[100dvh] overflow-hidden">
      <Dialog open={showDevModal} onOpenChange={setShowDevModal}>
      <DialogContent className='h-fit w-1/2 gap-y-4 py-5 max-[850px]:w-5/6'>
        <DialogHeader>
          <DialogTitle>Modelo en desarrollo</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p>
          El traductor se encuentra en desarrollo y esta es una <strong>versión operativa de prueba</strong>.
            Se encuentra en un proceso de <strong>mejora continua</strong>, por lo que puede cometer errores o
            producir resultados inesperados. Los <strong>resultados siempre deben ser verificados por hablantes</strong>. Agradecemos su comprensión y su retroalimentación,
            que nos ayuda a mejorar su precisión y utilidad.
          </p>
        </div>
        </DialogContent>
      </Dialog>
      <Dialog open={translationRestrictedDialogOpen} onOpenChange={setTranslationRestrictedDialogOpen}>
      <DialogContent className='h-fit w-1/2 gap-y-4 py-5 max-[850px]:w-3/4'>
        <DialogHeader>
          <DialogTitle>Acceso restringido</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p>
            El traductor se encuentra en una fase preliminar de prueba por lo que 
            debe <strong>iniciar sesión</strong> para usar el traductor en esta versión.
          </p>
        </div>
        <div className="flex justify-center">
          <Button 
            className='bg-[#068cdc1a] 
                text-default text-xs font-bold 
                hover:bg-default hover:text-white' 
            onClick={() => handleLogin()}
          >
            Iniciar sesión
          </Button>
        </div>
        </DialogContent>
      </Dialog>
      
      <TooltipProvider>
        <div className="relative">
          <Card
            side={"left"}
            srcText={srcText}
            lang={srcLang}
            handleSrcText={handleSrcText}
            handleSrcLang={handleSrcLang}
            showTextMessage={showSrcTextMessage}
            handleLangModalBtn={handleLangModalBtnLeft}
            ttsEnabled={TTS_ENABLED_SRC_D}
            ttsText={srcText}
            ttsLangCode={srcLang?.code}
            isSpeaking={isSpeaking}
            isLoadingAudio={isLoadingAudio}
            onSpeak={(gender) => handleSpeak({ text: srcText, lang: srcLang?.code, gender })}
            onStop={stopSpeaking}
			onClearTexts={handleClearTexts}
          />

          {/* LEFT: keep Upload*/}
          <div className="absolute left-4 bottom-4 z-[3] flex gap-2 items-center max-[850px]:left-3 max-[850px]:bottom-14 max-[480px]:flex-col">
            {/* Upload button */}
            {ASR_UPLOAD_VISIBLE_D && (
              <label
                className="max-[850px]:hidden w-[40px] h-[40px] rounded-full flex justify-center items-center bg-white shadow-[0px_0px_hsla(0,100%,100%,0.333)] hover:scale-110 transition cursor-pointer"
                title="Subir audio"
                aria-label="Subir audio"
              >
                <input
                  type="file"
                  accept="audio/*"
                  hidden
                  onChange={async (e) => {
                    if (translationRestricted) {
                      setTranslationRestrictedDialogOpen(true);
                      e.currentTarget.value = "";
                      return;
                    }
                    const files = e.currentTarget.files;
                    if (!files || files.length === 0) return;
                    const file = files[0];
                    e.currentTarget.value = ""; // Reset file input

                    // --- RE-ADD MIME TYPE VALIDATION ---
                    const okTypes = ['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/m4a'];
                    if (file.type && !okTypes.includes(file.type)) {
                      toast('Formato no soportado.', {
                        description: `El formato '${file.type}' no es compatible. Intente con webm, ogg, mp3, o wav.`,
                      });
                      return;
                    }
                    // --- END RE-ADD ---

                    // --- DURATION VALIDATION START ---
                    const audioURL = URL.createObjectURL(file);
                    const tempAudio = document.createElement('audio');
                    tempAudio.preload = 'metadata';

                    const cleanup = () => {
                      URL.revokeObjectURL(audioURL);
                      tempAudio.removeEventListener('loadedmetadata', onMetadataLoaded);
                      tempAudio.removeEventListener('error', onError);
                    };

                    const onMetadataLoaded = () => {
                      const duration = tempAudio.duration;
                      cleanup();
                      
                      if (duration > 30) {
                        toast('El audio no debe superar los 30 segundos.', {
                          description: `Duración detectada: ${Math.round(duration)}s`,
                        });
                        setAsrStatus('idle'); // Reset status
                        return;
                      }
                      
                      // If duration is valid, proceed to transcribe
                      setAsrStatus('uploading');
                      handleTranscribeBlob(file, file.name || 'audio.subido').catch(err => {
                        console.error(err);
                        setAsrStatus('error');
                        toast('No se pudo procesar el archivo.');
                      });
                    };

                    const onError = () => {
                      cleanup();
                      toast('Error al leer el archivo de audio.', {
                        description: 'El archivo podría estar dañado o en un formato no soportado.',
                      });
                      setAsrStatus('idle');
                    };

                    tempAudio.addEventListener('loadedmetadata', onMetadataLoaded);
                    tempAudio.addEventListener('error', onError);
                    tempAudio.src = audioURL;
                    // --- DURATION VALIDATION END ---
                  }}
                />
                <FontAwesomeIcon icon={faPlus} className="fa-lg" color="#0a8cde" />
              </label>
            )}
          </div>

          {/* RIGHT: Mic + compact review next to it (bottom-right of white card) */}
            <div className=" absolute right-4 bottom-4 z-[40] flex items-center gap-2 max-[850px]:fixed max-[850px]:inset-x-0 max-[850px]:bottom-0 max-[850px]:justify-center max-[850px]:gap-4 max-[850px]:bg-[#f3f4f6] max-[850px]:py-3 max-[850px]:px-6 max-[850px]:rounded-tl-[2rem] max-[850px]:rounded-tr-[2rem] max-[850px]:border-t max-[850px]:border-slate-200 max-[850px]:shadow-[0_-8px_24px_rgba(0,0,0,0.08)] max-[850px]:pb-[env(safe-area-inset-bottom)]">
            
			{/* Mic button (center-bottom) */}
			{ASR_MIC_VISIBLE_D && (
			  <div
				className={`box-content w-[50px] h-[50px] rounded-full flex justify-center items-center bg-white z-[3] cursor-pointer border-[8px] border-[#0a8cde] shadow-[0px_0px_hsla(0,100%,100%,0.333)] transform transition-all duration-300 hover:scale-110 max-[850px]:-translate-y-1 ${showRecordModal ? 'hidden' : ''}`}
				onClick={async () => {
				  if (ASRRestricted) {
					setTranslationRestrictedDialogOpen(true);
					return;
				  }
				  
				  // Trigger warmup only if needed (smart check)
				  triggerASRWarmupIfNeeded();
				  
				  // Open modal in "ready" state (do NOT start recording yet)
				  setTranscribeChoice(srcHint ? 'source' : (dstHint ? 'target' : 'source'));
				  setReviewTranscript('');
				  setShowRecordModal(true);
				  setAsrStatus('ready'); // start screen
				}}
				aria-label="Grabar audio"
				title="Grabar audio"
				disabled={loadingState || asrStatus === 'transcribing' || asrStatus === 'reviewing'}
				style={{ pointerEvents: (loadingState || asrStatus === 'transcribing' || asrStatus === 'reviewing') ? 'none' : 'auto' }}
			  >
				<FontAwesomeIcon
				  icon={isRecording ? faMicrophone : (asrStatus === 'transcribing' || asrStatus === 'processing' ? faSpinner : faMicrophone)}
				  className={`text-[1.5em] ${asrStatus === 'transcribing' || asrStatus === 'processing' ? 'fa-spin' : ''}`}
				  color={isRecording ? "#d40000" : "#0a8cde"}
				/>
			  </div>
			)}
			
            {/* --- NEW: Timer --- */}
            {isRecording && (
              <span className="text-xs font-mono px-2 py-1 rounded bg-white/80 border border-slate-200">
                {String(recordingSeconds).padStart(2, '0')}s
              </span>
            )}
          </div>
		  
        </div>

        <div
          className="delayed-fade-in w-[40px] h-[40px] rounded-full flex justify-center items-center bg-white absolute max-[850px]:top-1/2 max-[850px]:left-[45px] left-1/2 top-[100px] z-[2] cursor-pointer shadow-[0px_0px_hsla(0,100%,100%,0.333)] transform transition-all duration-300 hover:scale-110 hover:shadow-[8px_8px_#0005]"
          onClick={() => handleCrossLang()}
        >
          <FontAwesomeIcon
            icon={faArrowRightArrowLeft }
            className={`fa-xl max-[850px]:rotate-90 transform transition-all duration-300 hover:scale-110`}
            color="#0a8cde"
          />
        </div>

        <div
          className={`delayed-fade-in w-[50px] h-[50px] rounded-full flex justify-center items-center bg-white absolute left-1/2 top-1/2 z-[2] cursor-pointer shadow-[0px_0px_hsla(0,100%,100%,0.333)] transform transition-all duration-300 hover:scale-110 hover:shadow-[8px_8px_#0005] ${(translationRestricted || isLoadingAudio || loadingState) ? 'opacity-50' : ''}`}
          onClick={() => handleTranslate()}
          style={{ pointerEvents: (loadingState || isLoadingAudio) ? 'none' : 'auto' }}
        >
          <FontAwesomeIcon
            icon={loadingState ? faArrowsRotate : (translationRestricted ? faLock : faArrowRight)}
            className={`fa-2xl transform transition-all duration-300 hover:scale-110 max-[850px]:rotate-90 ${translationRestricted ? 'opacity-50' : ''}`}
            color={translationRestricted ? "#666" : "#0a8cde"}
            style={loadingState ? { animation: 'spin 1s linear infinite' } : {}}
          />
        </div>
		
        

        <div className="relative">
          <Card
            side={"right"}
            dstText={dstText}
            lang={dstLang}
            handleDstLang={handleDstLang}
            handleLangModalBtn={handleLangModalBtnRight}
            handleCopyText={handleCopyText}
            copyReady={copyReady}
            ttsEnabled={TTS_ENABLED_DST_D}
            ttsText={dstText}
            ttsLangCode={dstLang?.code}
            isSpeaking={isSpeaking}
            isLoadingAudio={isLoadingAudio}
            onSpeak={(gender) => handleSpeak({ text: dstText, lang: dstLang?.code, gender })}
            onStop={stopSpeaking}
          />
        </div>
        
        {ANY_TTS_VISIBLE && ttsError && (
          <div className="fixed right-4 bottom-28 z-[3] text-sm text-red-600">
            {ttsError}
          </div>
        )}
      </TooltipProvider>

      <div className="translator-footer max-[850px]:mb-[84px]">
        {translationRestricted ? (<></>) : (
          <>
            <strong className="max-[850px]:hidden">Déjanos tu opinión</strong>

            <FontAwesomeIcon
              icon={faThumbsUp}
              size="lg"
              onClick={() => handlePositiveFeedback()}
            />

            <FontAwesomeIcon
              icon={faThumbsDown}
              size="lg"
              onClick={() => handleNegativeFeedback()}
            />

            <FontAwesomeIcon
              icon={faComment}
              size="lg"
              onClick={() => handleSuggestionFeedback()}
            />

          </>


        )}
      </div>

      <LangsModal
        isOpen={langModalMode}
        langModalSelected={modalBtnSide === 'right'? dstLang : srcLang}
        handleCloseModal={setLangModalMode}
        handleSelectedLanguage={handleSelectedLangModal}
      />

      <FeedbackModal
        editingTranslation={feedbackData}
        setEditingTranslation={setFeedbackData}
        modelData={modelData}
        suggestionId={null}
        isSuggestionOnly={isSuggestionOnlyMode}
      />
	  
      <Dialog
        open={showRecordModal}
        onOpenChange={(open) => {
          if (!open) {
            handleFullCancel();      // clicking the default X will hit this
          } else {
            setShowRecordModal(true);
            setTranscribeChoice(srcHint ? 'source' : (dstHint ? 'target' : 'source'));
            setReviewTranscript('');
            setAsrStatus((prev) => (prev === 'recording' ? prev : 'ready'));
          }
        }}
      >

      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}  // ignore outside clicks
        onEscapeKeyDown={() => handleFullCancel()}    // Esc = full cancel
        className="w-[min(800px,90vw)] max-w-none gap-y-4 py-5"
      >	
			{/* READY VIEW: blue mic button + helper + source/target selector */}
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


			{/* RECORDING VIEW: live waveform */}
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
			
            {/* REVIEW VIEW: textarea + player + actions */}
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
                        // Return to READY: user will click mic and choose language again
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
                      disabled={isSubmittingValidation} // Add disabled state
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

    </div>
  );
}