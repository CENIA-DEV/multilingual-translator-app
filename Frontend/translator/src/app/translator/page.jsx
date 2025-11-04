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
import api from '../api';
import LangsModal from '../components/langsModal/langsModal.jsx'
import { API_ENDPOINTS, isTranslationRestricted,isASRRestricted, isTTSRestricted, MAX_WORDS_TRANSLATION, AUTOFILL_TRANSCRIPT, MAX_AUDIO_MB } from '../constants';
import { VARIANT_LANG } from "@/app/constants";
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAnalytics } from '@/hooks/useAnalytics';
import { AuthContext } from '../contexts';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { generateSpeech } from '../services/ttsService';
import { generateText } from '../services/asrService';

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

  // TTS (API-only): ES/EN/RAP
  const isTTSSideAllowed = (l) => isES(l) || isEN(l) || isRAP(l);

  // --- dinamics flags ---

  // TODO: BLOCK FOR USERS NOT AUTHENTICATED

  //const TTS_ENABLED_SRC_D = !translationRestricted && TTS_ENABLED && isTTSSideAllowed(srcLang); // speaker izquierda
  //const TTS_ENABLED_DST_D = !translationRestricted && TTS_ENABLED && isTTSSideAllowed(dstLang); // speaker derecha
  
  const TTS_ENABLED_SRC_D = isLoggedIn && !TTSRestricted && isTTSSideAllowed(srcLang); // speaker izquierda
  const TTS_ENABLED_DST_D = isLoggedIn && !TTSRestricted && isTTSSideAllowed(dstLang); // speaker derecha
  
  const ANY_TTS_VISIBLE = TTS_ENABLED_SRC_D || TTS_ENABLED_DST_D;

  // Add ASR dynamic flags
  const isASRSourceAllowed = (l) => isES(l) || isEN(l) || isRAP(l);   // ES/EN/RAP accepted by ASR
  const isASRLang          = (l) => isES(l) || isRAP(l);              // ES/RAP only (your rule)
  const ASR_MIC_VISIBLE_D    = isLoggedIn && !ASRRestricted && (isASRLang(srcLang) || isASRLang(dstLang));
  const ASR_UPLOAD_VISIBLE_D = isLoggedIn && !ASRRestricted && isASRSourceAllowed(srcLang);

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

  const handleTranslate = async () => {
    translate();
    trackEvent('translation_button_click', {
      page: 'translator'
    });
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

  const handleSrcText = (text) => {
    console.log(text);
    console.log(text.trim().split(/\n+/).length);
    const textList = text.trim().split(/\s+/).filter(word => word.length > 0);
    const wordCount = textList.length;
    console.log(wordCount);
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
    if (!isLoggedIn || TTSRestricted || !text?.trim()) return;

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
    if(translationRestricted){
      setTranslationRestrictedDialogOpen(true);
      return;
    }
    if(!loadingState){
      if(srcText.length === 0){
        setDstText('');
      }
      else{
        setLoadingState(true);
        
        const startTime = performance.now();
        try {
          // Add timer for long-running request
          let timeoutId = setTimeout(() => {
            toast("La traducción está tardando más tiempo de lo esperado...", {
              description: "Por favor, espere un momento mientras el modelo se carga",
              duration: 20000,
              cancel: {
                label: 'Cerrar',
                onClick: () => console.log('Pop up cerrado'),
              },
            });
          }, 5000);
          const res = await api.post(
            API_ENDPOINTS.TRANSLATION,
            {
              src_text: srcText,
              src_lang: srcLang,
              dst_lang: dstLang,
            },
          );
          
          setDstText(res.data.dst_text);
          setModelData({
            modelName: res.data.model_name,
            modelVersion: res.data.model_version
          });
          clearTimeout(timeoutId);
          const endTime = performance.now();
          const translationTime = endTime - startTime;
          trackEvent('translation_success', {
            src_text: srcText.slice(0, 100),
            dst_text: res.data.dst_text.slice(0, 100),
            src_lang: srcLang,
            dst_lang: dstLang,
            model_name: res.data.model_name,
            model_version: res.data.model_version,
            translation_time_ms: translationTime,
            is_timeout: translationTime > 5000,
            is_mobile: window.innerWidth <= 850,
            is_question: srcText.includes('?'),
            word_count: srcText.split(/\s+/).length,
            page: 'translator'
          });
        } 
        catch (error) {
          console.log(error)
          if (error.response.status === 400){
            toast("Error",{
              description: "Por favor reintente la traducción",
              cancel: {
                label: 'Cerrar',
                onClick: () => console.log('Pop up cerrado'),
              },
            })
            trackEvent('translation_error', {
              status: error.response.status,
              page: 'translator'
            }); 
          }
          console.log('Error in translation')
        } 
        finally {
          setLoadingState(false);
        }
      }
    }
    else{
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
      setTranslationRestrictedDialogOpen(true);
      return;
    }

    // Don't auto-translate if explicitly suppressed (after ASR)
    if (suppressNextAutoTranslate) {
      setSuppressNextAutoTranslate(false);
      return;
    }

    const timeoutId = setTimeout(() => {
      translate();
    }, 1500);

    return () => clearTimeout(timeoutId);
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
    }
    const hint = which === 'target' ? dstHint : srcHint;
    if (!hint) return; // guard
    setAsrStatus('transcribing');
    handleTranscribeBlob(lastRecordingBlobRef.current, 'grabacion.webm', hint)
      .catch(() => setAsrStatus('error'));
  }

  async function handleTranscribeBlob(blob, filename = 'audio.webm', overrideHint) {
    const maxBytes = (Number(process.env.NEXT_PUBLIC_MAX_AUDIO_MB ?? 25)) * 1024 * 1024;
    if (blob.size > maxBytes) {
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
      // Direct call to ASR service (no auto-reset here)
      const data = await generateText(blob, hint, "mms_meta_asr", "v1", filename);
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

  // NEW: Function to validate transcription
  async function validateTranscription(asrId, editedText) {
    if (!asrId || !editedText?.trim()) return;
    
    try {
      await api.patch(
        `${API_ENDPOINTS.SPEECH_TO_TEXT}${asrId}/validate_transcription/`,
        { text: editedText.trim() }
      );
      
      logger.info(`Transcription ${asrId} validated with edited text`);
      trackEvent('asr_transcription_validated', {
        asr_id: asrId,
        was_edited: editedText !== reviewTranscript,
        page: 'translator'
      });
    } catch (err) {
      console.error('Failed to validate transcription:', err);
      toast('No se pudo guardar la validación', {
        description: 'La transcripción se usará de todas formas.',
      });
    }
  }

  // Start translation from the review text ---
  async function startTranslationFromReview() {
    const chosenText = (reviewTranscript || '').trim();
    if (!chosenText) {
      toast('No hay texto para traducir.');
      return;
    }
    
    // NEW: Validate transcription before translating
    if (currentAsrId) {
      await validateTranscription(currentAsrId, chosenText);
    }
    
    // If user chose to transcribe the target side, swap langs before translating
    if (transcribeChoice === 'target') {
      const prevSrc = srcLang, prevDst = dstLang;
      setSrcLang(prevDst);
      setDstLang(prevSrc);
    }
    // Populate src text and trigger translation
    setSuppressNextAutoTranslate(true); // avoid double-auto
    setSrcText(chosenText);
    setShowRecordModal(false);
    // Give state a tick to settle then translate
    setTimeout(() => translate(), 0);
    // Clean audio state (keeps text/langs)
    resetAudioState();
    setCurrentAsrId(null); // NEW: Clear ASR ID
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
      recordingStartedAtRef.current = performance.now(); // NEW: Log start time
	  
      // --- NEW: Start timer ---
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
                  if (translationRestricted) {
                    setTranslationRestrictedDialogOpen(true);
                    return;
                  }
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