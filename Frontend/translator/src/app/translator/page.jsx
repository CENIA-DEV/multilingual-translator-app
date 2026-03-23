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
  faFileArrowUp,
  faMagnifyingGlassPlus,
  faMagnifyingGlassMinus,
  faRotateRight,
  faArrowRotateLeft,
  faCrop,
  faCamera,
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faPaperPlane, 
  faXmark,
  faComment
} from "@fortawesome/free-solid-svg-icons";
import Card from "../components/card/card.jsx"
import FeedbackModal from '../components/feedbackModal/feedbackModal.jsx'
import api from '../api';
import LangsModal from '../components/langsModal/langsModal.jsx'
import { API_ENDPOINTS, isTranslationRestricted, isASRRestricted, isTTSRestricted, MAX_WORDS_TRANSLATION, AUTOFILL_TRANSCRIPT, MAX_AUDIO_MB, TTS_ENABLED, ASR_ENABLED } from '../constants';
import { VARIANT_LANG } from "@/app/constants";
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAnalytics } from '@/hooks/useAnalytics';
import { AuthContext } from '../contexts';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { generateSpeech } from '../services/ttsService';
import { generateText, warmupASRModel } from '../services/asrService'; // ADD warmupASRModel
import * as pdfjsStatic from 'pdfjs-dist/build/pdf';
import 'pdfjs-dist/build/pdf.worker.entry';

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
  
  // TTS state variables
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsError, setTtsError] = useState('');
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const audioRef = useRef(null);
  const currentAudioUrlRef = useRef(null);
  const audioContextRef = useRef(null); // This ref will be our single source of truth

  // Add audio cache reference and cache size constant
  const audioCache = useRef(new Map());
  const MAX_AUDIO_CACHE_SIZE = 5; // Limit to 5 audio clips

  // ASR state & refs (must be declared before useEffect that uses them)
  const [isRecording, setIsRecording] = useState(false);
  const [asrStatus, setAsrStatus] = useState('idle');
  
  const [transcribeChoice, setTranscribeChoice] = useState('source'); // which side to transcribe in the modal ("source" | "target")
  const [reviewTranscript, setReviewTranscript] = useState('');
  const [currentAsrId, setCurrentAsrId] = useState(null);

  
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const prevStopAtRef = useRef(0);          // cooldown between sessions
  const recorderBusyRef = useRef(false);    // prevent double starts
  const COOLDOWN_MS = 700;                  // NEW: conservative cooldown after stop/transcribe
  const chunksRef = useRef([]);
  const [suppressNextAutoTranslate, setSuppressNextAutoTranslate] = useState(false);
  const lastRecordingUrl = useRef(null);
  const lastRecordingBlobRef = useRef(null);
  const reviewAudioRef = useRef(null); // NEW: control the <audio> element
  const [_, forceUpdate] = useState(0); // Helper to force re-render for URL changes
  const dropFirstChunkRef = useRef(false);  
  const recordingTimeoutRef = useRef(null); // Add near other refs
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingStartedAtRef = useRef(0); // NEW: Track start time
  const recordingIntervalRef = useRef(null);
  const stopSafeguardRef = useRef(null);    // NEW: force-reset if onstop never fires

  const [langModalMode, setLangModalMode] = useState(false);
  const [modalBtnSide, setModalBtnSide] = useState('');

  const [feedbackData, setFeedbackData] = useState(null);
  const [modelData, setModelData] = useState(null);
  const [isSuggestionOnlyMode, setIsSuggestionOnlyMode] = useState(false);

  const [loadingState, setLoadingState] = useState(false);
  const [copyReady, setCopyReady] = useState(false);

  const [showDevModal, setShowDevModal] = useState(true);
  
  // Record modal
  const [showRecordModal, setShowRecordModal] = useState(false);
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
  const [documentIsRunning, setDocumentIsRunning] = useState(false);
  const [documentProcessingFiles, setDocumentProcessingFiles] = useState(false);
  const [documentTargetLanguages, setDocumentTargetLanguages] = useState([]);
  const pdfjsRef = useRef(null);
  const docInputRef = useRef(null);
  const documentViewportRef = useRef(null);
  const documentImageRef = useRef(null);
  const documentPanStartRef = useRef(null);
  const waveCanvasRef = useRef(null);
  const waveRAFRef = useRef(null);
  const waveAnalyserRef = useRef(null);
  const waveSourceRef = useRef(null);
  const pulseRef = useRef(null);
  const asrAbortRef = useRef(null);

  const router = useRouter()

  const [isMobile, setIsMobile] = useState(false);

  const { trackEvent } = useAnalytics();
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

  // TTS (API-only): ES/EN/RAP - but only if TTS_ENABLED
  const isTTSSideAllowed = (l) => TTS_ENABLED && (isES(l) || isEN(l) || isRAP(l));

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
    let params = {};

    if (code !== null) {
      params.code = code;
    }
    if (script !== null) {
        params.script = script;
    }
    if (dialect !== null) {
      params.dialect = dialect;
    }
    try {
      const res = await api.get(API_ENDPOINTS.LANGUAGES,
        {
          params: params
        }
      );
      console.log(res.data);
      return res.data;
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
    if(loadingState === false){
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
        await api.post(
          API_ENDPOINTS.SUGGESTIONS+'accept_translation/',
          {
            src_text: srcText,
            dst_text: dstText,
            src_lang: srcLang,
            dst_lang: dstLang,
            model_name: modelData.modelName,
            model_version: modelData.modelVersion
          },
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
  
  // TTS Functions
  async function handleSpeak({ text, lang = 'es-ES' }) {
    // Early return only for empty text
    if (!text?.trim()) return;

    // If user cannot use TTS, show the same login dialog used by translation (and a toast)
    if (TTSRestricted) {
      setTranslationRestrictedDialogOpen(true);
      toast("Debe iniciar sesión para usar la síntesis de voz", { duration: 4000 });
      return;
    }

    setTtsError('');
    setIsSpeaking(true);
    
    // Create cache key based on text and language
    const cacheKey = `${lang}_${text}`;
    
    // Clean up any previous playback
    if (audioRef.current) {
      try {
        audioRef.current.stop();
      } catch (err) {
        console.log("Audio already stopped");
      }
      audioRef.current = null;
    }
    
    if (currentAudioUrlRef.current) {
      URL.revokeObjectURL(currentAudioUrlRef.current);
      currentAudioUrlRef.current = null;
    }

    // Check if we have this audio in cache
    if (audioCache.current.has(cacheKey)) {
      console.log("Using cached audio");
      const cachedData = audioCache.current.get(cacheKey);
      playAudioFromBuffer(cachedData);
      return;
    }

    // If not in cache, generate new audio
    setIsLoadingAudio(true);
    
    try {
      const response = await generateSpeech(text, lang);
      setIsLoadingAudio(false);
      
      // Cache the waveform data
      audioCache.current.set(cacheKey, response.waveform);
      
      // Limit cache size to prevent memory issues (keep last 5 items)
      if (audioCache.current.size > MAX_AUDIO_CACHE_SIZE) {
        const oldestKey = audioCache.current.keys().next().value;
        audioCache.current.delete(oldestKey);
      }
      
      // Play the audio
      playAudioFromBuffer(response.waveform);
    } catch (err) {
      setIsLoadingAudio(false);
      console.error('TTS error:', err);
      setTtsError(err?.message || 'Error al sintetizar');
      setIsSpeaking(false);
    }
  }
  
  // This function ensures we have a single, running AudioContext.
  const getAudioContext = async () => {
    if (!audioContextRef.current) {
      // Create it if it doesn't exist
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Always try to resume it, as it can be suspended by the browser.
    // This is safe to call even if it's already running.
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    return audioContextRef.current;
  };

  // Helper function to play audio from buffer data
  async function playAudioFromBuffer(waveformData) {
    try {
      const audioContext = await getAudioContext();
      if (!audioContext) {
        console.error("Could not get a running AudioContext.");
        setIsSpeaking(false);
        return;
      }

      const sampleRate = 16000; // Hardcoded from backend knowledge
      
      // Create buffer from float data
      const audioBuffer = audioContext.createBuffer(1, waveformData.length, sampleRate);
      const channelData = audioBuffer.getChannelData(0);
      
      // Copy data to buffer
      for (let i = 0; i < waveformData.length; i++) {
        channelData[i] = waveformData[i];
      }
      
      // Play the audio
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      
      // Track state and handle cleanup
      source.onended = () => setIsSpeaking(false);
      audioRef.current = source;
      source.start(0);
    } catch (err) {
      console.error('Error playing audio:', err);
      setIsSpeaking(false);
    }
  }
  
  function stopSpeaking() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (audioRef.current) {
      try {
        audioRef.current.stop();
      } catch (err) {
        // AudioBufferSourceNode may have already stopped/ended
        console.log("Audio already stopped");
      }
      audioRef.current = null;
    }
    if (currentAudioUrlRef.current) {
      URL.revokeObjectURL(currentAudioUrlRef.current);
      currentAudioUrlRef.current = null;
    }
    setIsSpeaking(false);
    // Ensure any lingering media streams are stopped
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
  }

  const translate = async () => {
    if (translationRestricted) { setTranslationRestrictedDialogOpen(true); return; }
    if (loadingState) return;                      // extra guard
    if (srcText.length === 0) { setDstText(''); return; }
    setLoadingState(true);
    const startTime = performance.now();
    let timeoutId = setTimeout(() => {
      toast("La traducción está tardando más tiempo de lo esperado...", { duration: 20000 });
    }, 5000);

    try {
      const requestId = (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2));
      reqIdRef.current = requestId;

      const res = await api.post(
        API_ENDPOINTS.TRANSLATION,
        {
          src_text: srcText,
          src_lang: srcLang,
          dst_lang: dstLang,
          request_id: requestId,        // body-only idempotency key
        }
        // REMOVED: headers: { 'X-Idempotency-Key': requestId }
      );

      clearTimeout(timeoutId);
      setDstText(res.data.dst_text);
      setModelData({ modelName: res.data.model_name, modelVersion: res.data.model_version });
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

  // Robust duration getter with timeout + fallback to WebAudio decode
  async function getBlobDuration(blob, timeoutMs = 2000) {
    // 1) Try HTMLAudio metadata quickly
    const durationFromTag = () =>
      new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob);
        const audio = document.createElement('audio');
        let done = false;

        const cleanup = () => {
          if (!done) {
            done = true;
            audio.removeEventListener('loadedmetadata', onLoaded);
            audio.removeEventListener('error', onError);
            URL.revokeObjectURL(url);
          }
        };
        const onLoaded = () => { const d = audio.duration; cleanup(); resolve(Number.isFinite(d) ? d : null); };
        const onError = () => { cleanup(); reject(new Error('metadata error')); };

        const t = setTimeout(() => { cleanup(); reject(new Error('metadata timeout')); }, timeoutMs);
        audio.addEventListener('loadedmetadata', () => { clearTimeout(t); onLoaded(); });
        audio.addEventListener('error', () => { clearTimeout(t); onError(); });
        audio.preload = 'metadata';
        audio.src = url;
      });

    try {
      const d = await durationFromTag();
      if (d != null) return d;
    } catch (_) {
      // fallthrough
    }

    // 2) Fallback: decode with WebAudio (more reliable, heavier)
    try {
      const ctx = await getAudioContext();
      const buf = await blob.arrayBuffer();
      const decoded = await ctx.decodeAudioData(buf.slice(0)); // slice avoids Safari reuse issues
      return decoded.duration ?? null;
    } catch {
      return null;
    }
  }

  const resetAudioState = () => {
    stopWaveformVisualization();
    setShowRecordModal(false);

    console.log("Resetting all audio states.");

    if (stopSafeguardRef.current) { clearTimeout(stopSafeguardRef.current); stopSafeguardRef.current = null; }

    // timers
    if (recordingTimeoutRef.current) { clearTimeout(recordingTimeoutRef.current); recordingTimeoutRef.current = null; }
    if (recordingIntervalRef.current) { clearInterval(recordingIntervalRef.current); recordingIntervalRef.current = null; }
    setRecordingSeconds(0);

    // recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      try { mediaRecorderRef.current.stop(); } catch {}
    }
    mediaRecorderRef.current = null;

    // stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }

    // audio element
    safeUnloadReviewAudio();
    lastRecordingBlobRef.current = null;

    setIsRecording(false);
    setAsrStatus('idle');
    dropFirstChunkRef.current = true;
    prevStopAtRef.current = performance.now();
    recorderBusyRef.current = false;
    setCurrentAsrId(null); // NEW: Clear ASR ID on reset
    forceUpdate(x => x + 1);
  };

  // Clean up audio resources on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        try {
          audioRef.current.stop();
        } catch (err) {
          // AudioBufferSourceNode may have already stopped
        }
      }
      if (currentAudioUrlRef.current) URL.revokeObjectURL(currentAudioUrlRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      // Also clean up any active media stream on unmount
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

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

  // ASR helper functions (single copy inside component)
  function getPreferredMime() {
    if (typeof window !== 'undefined' && window.MediaRecorder && MediaRecorder.isTypeSupported) {
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
      if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) return 'audio/ogg;codecs=opus';
    }
    return 'audio/webm';
  }

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

  async function performTranscribe(which) {
    if (!lastRecordingBlobRef.current) return;
    // If user chose the TARGET button, swap langs in the UI first
    if (which === 'target') {
      // prevent auto-translate side-effect on swap
      setSuppressNextAutoTranslate(true);
      const prevSrc = srcLang, prevDst = dstLang;
      setSrcLang(prevDst);
      setDstLang(prevSrc);
      setAsrStatus('error');
      toast(`El archivo supera ${process.env.NEXT_PUBLIC_MAX_AUDIO_MB || 25} MB.`);
      return;
    }

	const hint = overrideHint || inferHintFromSrcLang();
    setAsrStatus('transcribing');

    let timeoutId = null; // To hold the timer

    // Abort ASR
    const controller = new AbortController();
    asrAbortRef.current = controller;

    try {
      // Set a timer to show a message if transcription takes too long
      timeoutId = setTimeout(() => {
        toast("La transcripción está tardando más tiempo de lo esperado...", {
          description: "Por favor, espere un momento mientras el modelo se carga",
          duration: 20000,
          cancel: {
            label: 'Cerrar',
            onClick: () => console.log('Pop up cerrado'),
          },
        });
      }, 5000);

      // Use our asrService; pass AbortSignal if supported (extra arg is safe if ignored)
      const data = await generateText(blob, hint, "mms_meta_asr", "v1", filename, { signal: controller.signal });

      // If we get here, transcription was fast enough, so clear the timer
      clearTimeout(timeoutId);

      const transcript = data?.text || '';

      if (AUTOFILL_TRANSCRIPT !== false) {
        // Avoid the auto-translate from the useEffect
        setSuppressNextAutoTranslate(true);
        setSrcText(transcript);
      }
      toast('Transcripción lista.');
    } catch (err) {
      // If an error occurs, also clear the timer
      clearTimeout(timeoutId);
      console.error(err);
	  if (err?.name === 'AbortError') {
        toast('Transcripción cancelada.');
        return; // don't reset again in finally
      }
      toast('Error al transcribir.', {
        description: err?.response?.data?.error || 'Reintenta con otro archivo.',
      });
    } finally {
	  asrAbortRef.current = null;
      // small post-transcribe cooldown, then reset
      await new Promise(r => setTimeout(r, COOLDOWN_MS));
      // Only reset if not aborted earlier by Cancel
      if (asrStatus !== 'idle') resetAudioState();
    }
  }
  
  // Transcribe for modal review (no auto-reset) ---
  async function transcribeForReview(blob, hint, filename = 'audio.webm') {
    setAsrStatus('transcribing');
    try {
      // Direct call to ASR service
      const data = await generateText(blob, hint, "mms_meta_asr", "v1", filename);
      
      // NEW: Mark that we just used ASR (keep server warm)
      updateASRActivity();
      
      setReviewTranscript((data?.text || '').trim());
      setCurrentAsrId(data?.id || null); // NEW: Store ASR record ID
      setAsrStatus('reviewing');
    } catch (err) {
      console.error(err);
      setAsrStatus('error');
      toast('Error al transcribir.', {
        description: err?.response?.data?.error || 'Reintenta con otro archivo.',
      });
    }
  }

  const [isSubmittingValidation, setIsSubmittingValidation] = useState(false);

  // Function to validate transcription
  async function validateTranscription(asrId, editedText) {
    if (!asrId || !editedText?.trim() || isSubmittingValidation) return;
    
    setIsSubmittingValidation(true);
    try {
      const response = await api.post(  //CHANGED: patch → post
        `${API_ENDPOINTS.SPEECH_TO_TEXT}${asrId}/validate_transcription/`,
        { text: editedText.trim() }
      );
      
      console.log('Validation successful:', response.data);
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

  async function startRecording() {
    if (recorderBusyRef.current) return;
    recorderBusyRef.current = true;

    try {
      setIsRecording(false);            // explicit
      setShowRecordModal(true);
	  
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast('Tu navegador no soporta grabación de audio.');
        recorderBusyRef.current = false;
        return;
      }

      const elapsed = performance.now() - (prevStopAtRef.current || 0);
      if (elapsed < COOLDOWN_MS) {
        await new Promise(r => setTimeout(r, COOLDOWN_MS - elapsed));
      }

      // IMPORTANT: re-enable suppression/AGC to reduce “static/hiss”
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          // Safari-only enhancement (ignored elsewhere)
          // @ts-ignore
          voiceIsolation: true,
          // Chrome legacy flags (ignored if not supported)
          // @ts-ignore
          googEchoCancellation: true,
          // @ts-ignore
          googNoiseSuppression: true,
          // @ts-ignore
          googAutoGainControl: true,
        }
      };

      const mime = getPreferredMime();
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;

      const track = stream.getAudioTracks()[0];
      await waitForTrackUnmute(track, 1500);
      await waitForInputEnergy(stream, 0.008, 800, 80);
      await new Promise(r => setTimeout(r, 150)); // small pre-roll

      const recorder = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 160000 });
      chunksRef.current = [];
      dropFirstChunkRef.current = false; // keep first chunk (header)

      recorder.ondataavailable = (e) => {
        if (!e.data || e.data.size === 0) return;
        // IMPORTANT: keep the first chunk (container header); do not drop it
        chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
		setShowRecordModal(true);
		stopWaveformVisualization();
		stopMicTracksNow();
		
        // Clear safeguard if set
        if (stopSafeguardRef.current) { clearTimeout(stopSafeguardRef.current); stopSafeguardRef.current = null; }

        await new Promise(resolve => setTimeout(resolve, 120)); // flush

        if (!chunksRef.current.length || chunksRef.current.every(c => c.size === 0)) {
          toast('No se grabó audio. Intente nuevamente.');
          resetAudioState();
          return;
        }

        try {
          const blob = new Blob(chunksRef.current, { type: mime.includes('ogg') ? 'audio/ogg' : 'audio/webm' });

          // Robust duration
          const duration = await getBlobDuration(blob);

          let finalBlob = blob;
          let finalAudioURL = URL.createObjectURL(finalBlob);
          let wasTruncated = false;

          if (duration != null && duration > 30) {
            // Decode to trim exactly 30s
            const ctx = await getAudioContext();
            const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
            const sampleRate = decoded.sampleRate;
            const frames = Math.min(decoded.length, Math.floor(sampleRate * 30));
            const trimmed = ctx.createBuffer(decoded.numberOfChannels, frames, sampleRate);
            for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
              trimmed.copyToChannel(decoded.getChannelData(ch).slice(0, frames), ch);
            }

            // WAV encoder (pcm16)
            function encodeWAV(buffer) {
              const numCh = buffer.numberOfChannels;
              const sr = buffer.sampleRate;
              const len = buffer.length * numCh * 2 + 44;
              const ab = new ArrayBuffer(len);
              const view = new DataView(ab);
              const w = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };

              w(0, 'RIFF'); view.setUint32(4, 36 + buffer.length * numCh * 2, true);
              w(8, 'WAVE'); w(12, 'fmt '); view.setUint32(16, 16, true);
              view.setUint16(20, 1, true); view.setUint16(22, numCh, true);
              view.setUint32(24, sr, true); view.setUint32(28, sr * numCh * 2, true);
              view.setUint16(32, numCh * 2, true); view.setUint16(34, 16, true);
              w(36, 'data'); view.setUint32(40, buffer.length * numCh * 2, true);

              let off = 44;
              for (let i = 0; i < buffer.length; i++) {
                for (let ch = 0; ch < numCh; ch++) {
                  let s = buffer.getChannelData(ch)[i];
                  s = Math.max(-1, Math.min(1, s));
                  view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
                  off += 2;
                }
              }
              return new Blob([ab], { type: 'audio/wav' });
            }

            if (finalAudioURL) URL.revokeObjectURL(finalAudioURL);
            finalBlob = encodeWAV(trimmed);
            finalAudioURL = URL.createObjectURL(finalBlob);
            wasTruncated = true;
          }

          lastRecordingBlobRef.current = finalBlob;
          if (lastRecordingUrl.current) URL.revokeObjectURL(lastRecordingUrl.current);
          lastRecordingUrl.current = finalAudioURL;
          forceUpdate(x => x + 1);
          recorderBusyRef.current = false;

          if (wasTruncated) toast('El audio fue truncado a 30 segundos.');

          // immediately transcribe for review with the chosen side
          const hintChosen =
            transcribeChoice === 'target'
              ? (dstHint || inferHintFromSrcLang())
              : (srcHint || inferHintFromSrcLang());
          await transcribeForReview(finalBlob, hintChosen, 'grabacion.webm');
        } catch (err) {
          console.error('Finalizing recording failed:', err);
          toast('No se pudo procesar la grabación.');
          resetAudioState();
        }
      };

      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setAsrStatus('recording');
      recordingStartedAtRef.current = performance.now();
	  
      setRecordingSeconds(0);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingSeconds(sec => sec + 1);
      }, 1000);

      // Start with small timeslice so first usable audio arrives quickly
      recorder.start(200);
      toast('Grabación iniciada');

      // Auto-stop after 30s
      if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = setTimeout(() => {
        stopRecording();
        toast('El audio no debe superar los 30 segundos.');
      }, 30000);
    } catch (err) {
      console.error('Error starting recording:', err);
      toast('Error al iniciar grabación: ' + (err.message || err.name));
      stopMicTracksNow();
	  recorderBusyRef.current = false;
    }
  }

  function stopRecording() {
    const r = mediaRecorderRef.current;

    // Clear timers
    if (recordingTimeoutRef.current) { clearTimeout(recordingTimeoutRef.current); recordingTimeoutRef.current = null; }
    if (recordingIntervalRef.current) { clearInterval(recordingIntervalRef.current); recordingIntervalRef.current = null; }
    setRecordingSeconds(0);

    // Quick-cancel
    const duration = performance.now() - recordingStartedAtRef.current;
    if (r && r.state === 'recording' && duration < 500) {
      resetAudioState();
      toast('Grabación cancelada.');
      return;
    }

    // Normal stop + safeguard if onstop never fires
    if (r && r.state === 'recording') {
      setIsRecording(false);
      setAsrStatus('processing');
      r.stop();
	  stopMicTracksNow();
	  
	  // visualizer will be stopped in onstop, but ensure no double RAF
      // stopWaveformVisualization(); <-- uncomment if we want to stop immediately

      if (stopSafeguardRef.current) clearTimeout(stopSafeguardRef.current);
      stopSafeguardRef.current = setTimeout(() => {
        if (asrStatus === 'processing') {
          console.warn('MediaRecorder onstop did not fire, forcing reset.');
          resetAudioState();
        }
      }, 4000);
    } else {
      resetAudioState();
    }
  }
  
  function cancelTranscription() {
    try { asrAbortRef.current?.abort(); } catch {}
    asrAbortRef.current = null;
    resetAudioState();
  }

  useEffect(() => {

    return () => {
      if (lastRecordingUrl.current) {
        URL.revokeObjectURL(lastRecordingUrl.current);
      }
    };
  }, []);


  // Wait until the mic track is actually unmuted (Chrome can start muted briefly)
  function waitForTrackUnmute(track, timeoutMs = 1500) {
    return new Promise((resolve) => {
      if (!track.muted) return resolve();
      let done = false;
      const onUnmute = () => {
        if (done) return;
        done = true;
        track.removeEventListener('unmute', onUnmute);
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        track.removeEventListener('unmute', onUnmute);
        resolve(); // continue even if still muted after timeout
      }, timeoutMs);
      track.addEventListener('unmute', onUnmute, { once: true });
    });
  }

  // Wait until there is detectable input energy to avoid silent first seconds
  async function waitForInputEnergy(stream, threshold = 0.008, windowMs = 800, stepMs = 80) {
    try {
      const ctx = await getAudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      const data = new Uint8Array(analyser.fftSize);
      const steps = Math.max(1, Math.floor(windowMs / stepMs));
      for (let i = 0; i < steps; i++) {
        analyser.getByteTimeDomainData(data);
        // simple RMS
        let sum = 0;
        for (let j = 0; j < data.length; j++) {
          const v = (data[j] - 128) / 128; // [-1,1]
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        if (rms >= threshold) {
          try { source.disconnect(); } catch {}
          try { analyser.disconnect && analyser.disconnect(); } catch {}
          return;
        }
        // eslint-disable-next-line no-await-in-loop
        await new Promise(r => setTimeout(r, stepMs));
      }
      try { source.disconnect(); } catch {}
      try { analyser.disconnect && analyser.disconnect(); } catch {}
    } catch (_) {
      // ignore analyser errors (fallback to no wait)
    }
  }

  // Add this helper once (used by resetAudioState)
  function safeUnloadReviewAudio() {
    const el = reviewAudioRef.current;
    const url = lastRecordingUrl.current;
    if (!el) {
      if (url) { try { URL.revokeObjectURL(url); } catch {} lastRecordingUrl.current = null; }
      return;
    }
    try {
      const p = el.pause?.();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch {}
    const clearNow = () => {
      try { el.removeAttribute('src'); el.srcObject = null; el.load(); } catch {}
      if (url) {
        try { URL.revokeObjectURL(url); } catch {}
        if (lastRecordingUrl.current === url) lastRecordingUrl.current = null;
      }
      el.removeEventListener('pause', clearNow);
      el.removeEventListener('ended', clearNow);
      el.removeEventListener('emptied', clearNow);
    };
    if (el.paused || el.ended) {
      setTimeout(clearNow, 0);
    } else {
      el.addEventListener('pause', clearNow, { once: true });
      el.addEventListener('ended', clearNow, { once: true });
      el.addEventListener('emptied', clearNow, { once: true });
      try { el.pause(); } catch {}
    }
  }
  
  function stopWaveformVisualization() {
	  try { if (waveRAFRef.current) cancelAnimationFrame(waveRAFRef.current); } catch {}
	  waveRAFRef.current = null;
	  try { waveSourceRef.current && waveSourceRef.current.disconnect(); } catch {}
	  try { waveAnalyserRef.current && waveAnalyserRef.current.disconnect && waveAnalyserRef.current.disconnect(); } catch {}
	  waveSourceRef.current = null;
	  waveAnalyserRef.current = null;
  }
  
  function stopMicTracksNow() {
      const s = mediaStreamRef.current;
      if (s) {
        try { s.getTracks().forEach(t => t.stop()); } catch {}
        mediaStreamRef.current = null;
      }
  }
  
  const handleClearTexts = () => {
    setSrcText('');
    setDstText('');
    setShowSrcTextMessage(false);
  };

  const DOCUMENT_LANGUAGE_OPTIONS = [
    { code: 'eng', label: 'English' },
    { code: 'spa', label: 'Spanish' },
    { code: 'fra', label: 'French' },
    { code: 'deu', label: 'German' },
    { code: 'auto', label: 'Auto Detect' },
  ];

  const resetDocumentState = () => {
    if (documentPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(documentPreviewUrl);
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
    setDocumentIsRunning(false);
    setDocumentProcessingFiles(false);
    setDocumentTargetLanguages([]);
    if (docInputRef.current) docInputRef.current.value = '';
  };

  const isSupportedDocument = (file) => {
    const supportedMime = ['application/pdf', 'image/jpeg', 'image/png'];
    const name = (file?.name || '').toLowerCase();
    return supportedMime.includes(file?.type) || /\.(pdf|jpe?g|png)$/i.test(name);
  };

  const isPdfDocument = (file) => {
    if (!file) return false;
    return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  };

  const currentDocumentPageUrl = documentPages[documentPageIndex] || documentPreviewUrl;
  const currentDocumentResultText = documentOcrByPage[documentPageIndex] || '';
  const isPdfObjectFallback = !!documentFile && isPdfDocument(documentFile) && documentPages.length === 0 && !!documentPreviewUrl;

  const clampDocumentPageIndex = (nextIndex) => {
    if (!documentPages.length) return 0;
    return Math.max(0, Math.min(nextIndex, documentPages.length - 1));
  };

  const goToDocumentPage = (nextIndex) => {
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
  };

  const handleDocumentZoomIn = () => {
    setDocumentZoom((z) => Math.min(3, Number((z + 0.2).toFixed(2))));
  };

  const handleDocumentZoomOut = () => {
    setDocumentZoom((z) => Math.max(0.5, Number((z - 0.2).toFixed(2))));
  };

  const pushDocumentHistoryForCurrentPage = (sourceUrl) => {
    if (!sourceUrl) return;
    setDocumentPageHistory((prev) => ({
      ...prev,
      [documentPageIndex]: [...(prev[documentPageIndex] || []), sourceUrl],
    }));
  };

  const handleDocumentRotate = async () => {
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
      const updatedPages = [...documentPages];
      if (updatedPages.length) {
        updatedPages[documentPageIndex] = rotatedUrl;
        setDocumentPages(updatedPages);
      } else {
        setDocumentPages([rotatedUrl]);
        setDocumentPageIndex(0);
      }
      setDocumentPreviewUrl(rotatedUrl);
      setDocumentRotation(0);
      setDocumentCropSelection(null);
      setDocumentCropMode(false);
      setDocumentPan({ x: 0, y: 0 });
      setDocumentPanDragging(false);
      documentPanStartRef.current = null;
    } catch (error) {
      console.error('Document rotate failed', error);
      toast('No se pudo rotar la pagina.');
    }
  };

  const handleDocumentClear = () => {
    if (documentPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(documentPreviewUrl);
    setDocumentFile(null);
    setDocumentPreviewUrl('');
    setDocumentPages([]);
    setDocumentPageIndex(0);
    setDocumentZoom(1);
    setDocumentRotation(0);
    setDocumentCropSelection(null);
    setDocumentCropDragging(false);
    setDocumentCropStart(null);
    setDocumentPan({ x: 0, y: 0 });
    setDocumentPanDragging(false);
    documentPanStartRef.current = null;
    setDocumentPageHistory({});
    setDocumentOcrByPage({});
  };

  const handleDocumentUndoCurrentPage = () => {
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
    setDocumentPan({ x: 0, y: 0 });
    setDocumentPanDragging(false);
    documentPanStartRef.current = null;
  };

  const applyDocumentSelectionCrop = async () => {
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

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, sWidth);
      canvas.height = Math.max(1, sHeight);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(imgEl, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
      const croppedUrl = canvas.toDataURL('image/png');
      const srcUrl = documentPages[documentPageIndex] || documentPreviewUrl;
      pushDocumentHistoryForCurrentPage(srcUrl);

      const updatedPages = [...documentPages];
      if (updatedPages.length) {
        updatedPages[documentPageIndex] = croppedUrl;
        setDocumentPages(updatedPages);
      } else {
        setDocumentPages([croppedUrl]);
        setDocumentPageIndex(0);
      }
      setDocumentPreviewUrl(croppedUrl);
      setDocumentCropMode(false);
      setDocumentCropSelection(null);
      setDocumentCropDragging(false);
      setDocumentCropStart(null);
      setDocumentPan({ x: 0, y: 0 });
      setDocumentPanDragging(false);
      documentPanStartRef.current = null;
    } catch (error) {
      console.error('Document crop failed', error);
      toast('No se pudo recortar la pagina.');
    }
  };

  const handleDocumentCropMouseDown = (event) => {
    if (!documentCropMode || isPdfObjectFallback) return;
    const viewportEl = documentViewportRef.current;
    if (!viewportEl) return;
    const rect = viewportEl.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    setDocumentCropStart({ x, y });
    setDocumentCropSelection({ x, y, w: 0, h: 0 });
    setDocumentCropDragging(true);
  };

  const handleDocumentCropMouseMove = (event) => {
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
  };

  const handleDocumentCropMouseUp = async () => {
    if (!documentCropMode) return;
    if (!documentCropDragging) return;
    setDocumentCropDragging(false);
    if (!documentCropSelection || documentCropSelection.w < 8 || documentCropSelection.h < 8) {
      setDocumentCropSelection(null);
      return;
    }
    await applyDocumentSelectionCrop();
  };

  const handleDocumentPanMouseDown = (event) => {
    if (documentCropMode || isPdfObjectFallback || !currentDocumentPageUrl) return;
    event.preventDefault();
    documentPanStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      originX: documentPan.x,
      originY: documentPan.y,
    };
    setDocumentPanDragging(true);
  };

  const handleDocumentPanMouseMove = (event) => {
    if (!documentPanDragging || !documentPanStartRef.current) return;
    const start = documentPanStartRef.current;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    setDocumentPan({ x: start.originX + dx, y: start.originY + dy });
  };

  const handleDocumentPanMouseUp = () => {
    if (!documentPanDragging) return;
    setDocumentPanDragging(false);
    documentPanStartRef.current = null;
  };

  const handleDocumentViewportMouseDown = (event) => {
    if (documentCropMode) {
      handleDocumentCropMouseDown(event);
      return;
    }
    handleDocumentPanMouseDown(event);
  };

  const handleDocumentViewportMouseMove = (event) => {
    if (documentCropMode) {
      handleDocumentCropMouseMove(event);
      return;
    }
    handleDocumentPanMouseMove(event);
  };

  const handleDocumentViewportMouseUp = async () => {
    if (documentCropMode) {
      await handleDocumentCropMouseUp();
      return;
    }
    handleDocumentPanMouseUp();
  };

  const getPdfJs = async () => {
    if (pdfjsRef.current) return pdfjsRef.current;
    const pdfjsLib = pdfjsStatic?.getDocument ? pdfjsStatic : pdfjsStatic?.default;
    if (!pdfjsLib?.getDocument) {
      throw new Error('PDF.js static build could not be loaded.');
    }

    pdfjsRef.current = pdfjsLib;
    return pdfjsLib;
  };

  const loadPdfDocument = async (pdfjsLib, arrayBuffer) => {
    const data = new Uint8Array(arrayBuffer);
    const attempts = [
      { disableWorker: false },
      { disableWorker: true },
    ];

    let lastError = null;
    for (const options of attempts) {
      try {
        return await pdfjsLib.getDocument({ data, ...options }).promise;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error('PDF document could not be parsed.');
  };

  const handleDocumentPicked = async (file) => {
    if (!file) return;
    if (!isSupportedDocument(file)) {
      toast('Formato no soportado', {
        description: 'Sube un archivo PDF, JPG, JPEG o PNG.',
      });
      return;
    }

    setDocumentProcessingFiles(true);
    if (documentPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(documentPreviewUrl);
    
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
    setDocumentPages([]);
    setDocumentPageIndex(0);
    
    let previewReady = false;
    try {
      if (isPdfDocument(file)) {
        const pdfjsLib = await getPdfJs();
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await loadPdfDocument(pdfjsLib, arrayBuffer);
        const pageImages = [];
        const maxPages = Math.min(pdf.numPages, 10); // Extract up to 10 pages for preview
        
        for (let i = 1; i <= maxPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          
          if (context) {
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await page.render({ canvasContext: context, viewport: viewport }).promise;
            pageImages.push(canvas.toDataURL('image/png'));
          }
        }
        
        if (pageImages.length > 0) {
          setDocumentPages(pageImages);
          setDocumentPageIndex(0);
          setDocumentPreviewUrl(pageImages[0]);
          previewReady = true;
        } else {
          setDocumentPages([]);
          setDocumentPageIndex(0);
          setDocumentPreviewUrl('');
          previewReady = false;
          toast('No se pudo generar vista previa editable del PDF.', {
            description: 'Intenta con otro PDF o vuelve a exportarlo como PDF estándar.',
          });
        }
      } else {
        const previewUrl = URL.createObjectURL(file);
        setDocumentPreviewUrl(previewUrl);
        setDocumentPageIndex(0);
        setDocumentPages([previewUrl]);
        previewReady = true;
      }
    } catch (e) {
      console.error("Error processing document:", e);
      if (isPdfDocument(file)) {
        setDocumentPreviewUrl('');
        setDocumentPageIndex(0);
        setDocumentPages([]);
        previewReady = false;
        toast('PDF no compatible con editor.', {
          description: 'No se pudo rasterizar este archivo para recortar/rotar. Prueba otro PDF.',
        });
      } else {
        // Fallback for images only.
        const previewUrl = URL.createObjectURL(file);
        setDocumentPreviewUrl(previewUrl);
        setDocumentPageIndex(0);
        setDocumentPages([previewUrl]);
        previewReady = true;
      }
    }
    
    setDocumentProcessingFiles(false);

    if (previewReady) {
      toast('Documento cargado', {
        description: file.name,
      });
    }
  };

  const openDocumentUploadModal = () => {
    if (translationRestricted) {
      setTranslationRestrictedDialogOpen(true);
      return;
    }
    setShowDocumentModal(true);
  };

  const runDocumentOCR = async () => {
    if (!documentFile) {
      toast('No hay documento', { description: 'Sube un documento antes de ejecutar OCR.' });
      return;
    }
    setDocumentIsRunning(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setDocumentOcrByPage((prev) => ({
      ...prev,
      [documentPageIndex]: `No se encontró texto en página ${documentPageIndex + 1}.`,
    }));
    setDocumentIsRunning(false);
  };

  const toggleDocumentLang = (code) => {
    setDocumentTargetLanguages((prev) =>
      prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code]
    );
  };

  async function startWaveformVisualization(stream) {
    try {
      const ctx = await getAudioContext();
      if (ctx.state === 'suspended') await ctx.resume();
  
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.85;
  
      const timeData = new Uint8Array(analyser.fftSize);
      const freqData = new Uint8Array(analyser.frequencyBinCount);
  
      waveSourceRef.current = source;
      waveAnalyserRef.current = analyser;
      source.connect(analyser);
  
      const canvas = waveCanvasRef.current;
      if (!canvas) return;
      const g = canvas.getContext('2d');
  
      function resize() {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width  = Math.max(1, Math.floor(rect.width * dpr));
        canvas.height = Math.max(1, Math.floor(rect.height * dpr));
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.scale(dpr, dpr);
      }
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(canvas);
  
      const draw = () => {
        waveRAFRef.current = requestAnimationFrame(draw);
        analyser.getByteTimeDomainData(timeData);
        analyser.getByteFrequencyData(freqData);
  
        const { width, height } = canvas.getBoundingClientRect();
        g.clearRect(0, 0, width, height);
        g.fillStyle = '#fff';
        g.fillRect(0, 0, width, height);
  
        // midline
        g.strokeStyle = '#e5e7eb';
        g.lineWidth = 1;
        const mid = height / 2;
        g.beginPath();
        g.moveTo(0, mid);
        g.lineTo(width, mid);
        g.stroke();
  
        // waveform
        g.strokeStyle = '#0a8cde';
        g.lineWidth = 2;
        g.beginPath();
        for (let i = 0; i < timeData.length; i++) {
          const x = (i / (timeData.length - 1)) * width;
          const y = mid + ((timeData[i] - 128) / 128) * (height * 0.42);
          if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.stroke();
  
        // VU bars (bottom)
        const bars = 16;
        const step = Math.floor(freqData.length / bars);
        const barW = Math.max(6, width / (bars * 1.5));
        for (let b = 0; b < bars; b++) {
          const slice = freqData.subarray(b * step, (b + 1) * step);
          let avg = 0;
          for (let j = 0; j < slice.length; j++) avg += slice[j];
          avg /= slice.length || 1;
          const barH = (avg / 255) * (height * 0.35);
          const x = 10 + b * (barW + 6);
          const y = height - 10 - barH;
          g.fillStyle = '#0a8cde';
          g.fillRect(x, y, barW, barH);
        }
  
        // RMS pulse
        let sum = 0;
        for (let i = 0; i < timeData.length; i++) {
          const v = (timeData[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / timeData.length);
        if (pulseRef.current) {
          const s = 1 + Math.min(1.4, rms * 2.2);
          pulseRef.current.style.transform = `scale(${s})`;
          pulseRef.current.style.boxShadow = `0 0 ${8 + rms * 36}px rgba(10,140,222,0.65)`;
          pulseRef.current.style.opacity = `${0.6 + Math.min(0.4, rms * 0.8)}`;
        }
      };
      draw();
    } catch (e) {
      console.debug('Visualizer error', e);
    }
  }

  // Add refs to track warmup state (already exists)
  const asrWarmupDoneRef = useRef(false);
  const lastAsrActivityRef = useRef(0);
  const WARMUP_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

  // Helper to check if warmup is needed (already exists)
  const shouldWarmupASR = () => {
    const now = Date.now();
    const timeSinceLastActivity = now - lastAsrActivityRef.current;
    return !asrWarmupDoneRef.current || timeSinceLastActivity > WARMUP_COOLDOWN_MS;
  };

  // Helper to trigger warmup (already exists - unchanged)
  const triggerASRWarmupIfNeeded = async () => {
    if (!shouldWarmupASR()) {
      console.debug('ASR warmup skipped - server still warm');
      return;
    }
    
    console.debug('Triggering ASR warmup...');
    asrWarmupDoneRef.current = true;
    lastAsrActivityRef.current = Date.now();
    
    const hintForWarmup = srcHint || dstHint || 'spa_Latn';
    warmupASRModel(hintForWarmup).catch(() => {}); // Fire and forget
  };

  // Update lastAsrActivityRef after EVERY real ASR call (already exists)
  const updateASRActivity = () => {
    lastAsrActivityRef.current = Date.now();
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
            onSpeak={() => handleSpeak({ text: srcText, lang: srcLang?.code })}
            onStop={stopSpeaking}
			onClearTexts={handleClearTexts}
          />

          {/* LEFT: keep Upload*/}
          <div className="absolute left-4 bottom-4 z-[3] flex gap-2 items-center max-[850px]:left-3 max-[850px]:bottom-14 max-[480px]:flex-col">
            {/* Document upload button */}
            {ASR_UPLOAD_VISIBLE_D && (
              <button
                type="button"
                className="max-[850px]:hidden box-content w-[50px] h-[50px] rounded-full flex justify-center items-center bg-white z-[3] cursor-pointer border-[8px] border-[#0a8cde] shadow-[0px_0px_hsla(0,100%,100%,0.333)] transform transition-all duration-300 hover:scale-110"
                title="Subir documento"
                aria-label="Subir documento"
                onClick={openDocumentUploadModal}
              >
                <FontAwesomeIcon icon={faFileArrowUp} className="text-[1.3em]" color="#0a8cde" />
              </button>
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
          className={`delayed-fade-in w-[50px] h-[50px] rounded-full flex justify-center items-center bg-white absolute left-1/2 top-1/2 z-[2] cursor-pointer shadow-[0px_0px_hsla(0,100%,100%,0.333)] transform transition-all duration-300 hover:scale-110 hover:shadow-[8px_8px_#0005] ${translationRestricted ? 'opacity-50' : ''}`}
          onClick={() => handleTranslate()}
          style={{ pointerEvents: loadingState ? 'none' : 'auto' }}
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
            onSpeak={() => handleSpeak({ text: dstText, lang: dstLang?.code })}
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
        open={showDocumentModal}
        onOpenChange={(open) => {
          if (!open) resetDocumentState();
          setShowDocumentModal(open);
        }}
      >
        <DialogContent className="w-[min(1100px,96vw)] max-w-none p-0 overflow-hidden bg-white border border-slate-200">
          <div className="px-5 pt-5 pb-2 text-[#0f172a]">
            <DialogHeader>
              <DialogTitle className="text-2xl font-semibold text-[#0a8cde]">Extraccion de documento</DialogTitle>
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
                  <p className="text-slate-500 mt-2">Solamente archivos PDF, JPEG ó PNG</p>
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
                          PDF cargado sin páginas editables. Sube un PDF estándar para activar recorte y rotación.
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
                            alt={`Vista previa página ${documentPageIndex + 1}`}
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
                          aria-label="Página anterior"
                          title="Página anterior"
                        >
                          <FontAwesomeIcon icon={faChevronLeft} />
                        </button>
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-[#056fb0] text-white hover:bg-[#045f98]"
                          onClick={() => goToDocumentPage(documentPageIndex + 1)}
                          disabled={documentPageIndex === documentPages.length - 1}
                          aria-label="Página siguiente"
                          title="Página siguiente"
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
                            title={`Página ${index + 1}`}
                            aria-label={`Página ${index + 1}`}
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
                    value={currentDocumentResultText || 'Todavía no se extrae el texto de ésta página'}
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