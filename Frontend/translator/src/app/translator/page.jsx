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
  faPlus
} from "@fortawesome/free-solid-svg-icons";
import Card from "../components/card/card.jsx"
import FeedbackModal from '../components/feedbackModal/feedbackModal.jsx'
import api from '../api';
import LangsModal from '../components/langsModal/langsModal.jsx'
import { API_ENDPOINTS, isTranslationRestricted, MAX_WORDS_TRANSLATION, TTS_ENABLED, ASR_ENABLED, AUTOFILL_TRANSCRIPT, MAX_AUDIO_MB } from '../constants';
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
  const audioContextRef = useRef(null); // Add this line
  
  // Add audio cache reference and cache size constant
  const audioCache = useRef(new Map());
  const MAX_AUDIO_CACHE_SIZE = 5; // Limit to 5 audio clips

  // ASR state & refs (must be declared before useEffect that uses them)
  const [isRecording, setIsRecording] = useState(false);
  const [asrStatus, setAsrStatus] = useState('idle');
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [suppressNextAutoTranslate, setSuppressNextAutoTranslate] = useState(false);
  
  const [langModalMode, setLangModalMode] = useState(false);
  const [modalBtnSide, setModalBtnSide] = useState('');

  const [feedbackData, setFeedbackData] = useState(null);
  const [modelData, setModelData] = useState(null);

  const [loadingState, setLoadingState] = useState(false);
  const [copyReady, setCopyReady] = useState(false);

  const [showDevModal, setShowDevModal] = useState(true);

  const router = useRouter()

  const [isMobile, setIsMobile] = useState(false);

  const { trackEvent } = useAnalytics();
  const currentUser = useContext(AuthContext);

  // Check if translation is restricted for current user
  const translationRestricted = isTranslationRestricted(currentUser);
  const [translationRestrictedDialogOpen, setTranslationRestrictedDialogOpen] = useState(translationRestricted);

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
  
  const TTS_ENABLED_SRC_D = TTS_ENABLED && isTTSSideAllowed(srcLang); // speaker izquierda
  const TTS_ENABLED_DST_D = TTS_ENABLED && isTTSSideAllowed(dstLang); // speaker derecha
  
  const ANY_TTS_VISIBLE = TTS_ENABLED_SRC_D || TTS_ENABLED_DST_D;

  // Add ASR dynamic flag
  const isASRSourceAllowed = (l) => isES(l) || isEN(l) || isRAP(l);
  const ASR_ENABLED_D = !translationRestricted && ASR_ENABLED && isASRSourceAllowed(srcLang);

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
      setFeedbackData({
        'src_text': srcText,
        'dst_text': dstText,
        'src_lang': srcLang,
        'dst_lang': dstLang,
        'suggestion': dstText
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
  
  // TTS Functions
  async function handleSpeak({ text, lang = 'es-ES' }) {
    if (!TTS_ENABLED || !text?.trim()) return;

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
  
  // Helper function to play audio from buffer data
  function playAudioFromBuffer(waveformData) {
    try {
      // Create audio context
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
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

  // Enable audio context on first user interaction
  useEffect(() => {
    const enableAudio = () => {
      // Create and close an audio context to enable future audio
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      document.removeEventListener('click', enableAudio);
      document.removeEventListener('touchstart', enableAudio);
    };
    
    document.addEventListener('click', enableAudio);
    document.addEventListener('touchstart', enableAudio);
    
    return () => {
      document.removeEventListener('click', enableAudio);
      document.removeEventListener('touchstart', enableAudio);
    };
  }, []);

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

  async function handleTranscribeBlob(blob, filename = 'audio.webm') {
    const maxBytes = (Number(process.env.NEXT_PUBLIC_MAX_AUDIO_MB ?? 25)) * 1024 * 1024;
    if (blob.size > maxBytes) {
      setAsrStatus('error');
      toast(`El archivo supera ${process.env.NEXT_PUBLIC_MAX_AUDIO_MB || 25} MB.`);
      return;
    }

    const hint = inferHintFromSrcLang();
    setAsrStatus('transcribing');

    try {
      // Use our asrService instead of direct API call
      //const data = await generateText(blob, hint, "mms_meta_asr", "v1");
      const data = await generateText(blob, hint, "mms_meta_asr", "v1", filename);

      const transcript = data?.text || '';

      if (AUTOFILL_TRANSCRIPT !== false) {
        // Avoid the auto-translate from the useEffect
        setSuppressNextAutoTranslate(true);
        setSrcText(transcript);
      }
      setAsrStatus('done');
      toast('Transcripción lista.');
    } catch (err) {
      console.error(err);
      setAsrStatus('error');
      toast('Error al transcribir.', {
        description: err?.response?.data?.error || 'Reintenta con otro archivo.',
      });
    }
  }

  async function startRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast('Tu navegador no soporta grabación de audio.');
      return;
    }
    
    const mime = getPreferredMime();
    
    try {
      // Request audio with more explicit constraints
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1
        }
      });
      
      // First few packets can be problematic - "warm up" the microphone
      // by starting and stopping a quick recording that we discard
      try {
        const warmupRecorder = new MediaRecorder(stream, {mimeType: mime});
        warmupRecorder.start();
        await new Promise(r => setTimeout(r, 100));
        warmupRecorder.stop();
        // We don't need to do anything with this data
        await new Promise(r => setTimeout(r, 200));
      } catch (e) {
        // Ignore errors in warm-up
        console.log("Microphone warm-up failed, continuing anyway");
      }
      
      // Configure MediaRecorder with more explicit options
      const recorder = new MediaRecorder(stream, { 
        mimeType: mime,
        audioBitsPerSecond: 128000 
      });
      
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      
      recorder.onstop = async () => {
        // Add small delay before processing to ensure all internal buffers are flushed
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Make sure we have chunks with content
        if (chunksRef.current.length === 0 || chunksRef.current.every(chunk => chunk.size === 0)) {
          toast('No se grabó audio. Intente nuevamente.');
          setIsRecording(false);
          setAsrStatus('idle');
          return;
        }
        
        const ext = mime.includes('ogg') ? 'ogg' : 'webm';
        const blob = new Blob(chunksRef.current, { type: mime.includes('ogg') ? 'audio/ogg' : 'audio/webm' });
        
        if (blob.size < 1000) { // Less than 1KB is suspiciously small
          toast('Grabación muy corta. Intente hablar más tiempo.');
          setIsRecording(false);
          setAsrStatus('idle');
          return;
        }

        recorder.stream.getTracks().forEach(t => t.stop());
        setIsRecording(false);
        await handleTranscribeBlob(blob, `grabacion.${ext}`);
      };

      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setAsrStatus('recording');
      
      // Start with timeslice to get data periodically (every 1000ms)
      // This helps ensure we get valid chunks even with short recordings
      recorder.start(500); // 500ms chunks instead of 1000ms
      
      // Add a visual/audio indicator that recording has started
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const audioContext = audioContextRef.current;

      // Resume context if it's suspended
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.frequency.value = 440;
      gain.gain.value = 0.1;
      oscillator.start();
      setTimeout(() => oscillator.stop(), 200);
      
      toast('Grabación iniciada.');
    } catch (err) {
      console.error('Error starting recording:', err);
      toast('Error al iniciar grabación: ' + (err.message || err.name));
    }
  }

  function stopRecording() {
    const r = mediaRecorderRef.current;
    if (r && r.state !== 'inactive') {
      r.stop();
      toast('Grabación detenida.');
    }
  }

  // Add this function to request user permission before recording
  function preloadMicrophone() {
    if (navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          // Just stop tracks immediately - this is just to trigger permission dialog
          stream.getTracks().forEach(track => track.stop());
          console.log('Microphone access granted');
        })
        .catch(err => console.log('Microphone permission not granted:', err));
    }
  }

  // Call this in a useEffect that runs once
  useEffect(() => {
    preloadMicrophone();
  }, []);

  return (
    <div className="translator-container">
      <Dialog open={showDevModal} onOpenChange={setShowDevModal}>
      <DialogContent className='h-fit w-1/2 gap-y-4 py-5 max-[850px]:w-3/4'>
        <DialogHeader>
          <DialogTitle>Modelo en fase de desarrollo</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p>
          El traductor se encuentra en desarrollo y esta es su <strong>primera versión operativa</strong>.
            Se encuentra en un proceso de <strong>mejora continua</strong>, por lo que puede cometer errores o
            producir resultados inesperados. Agradecemos su comprensión y su retroalimentación,
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
          />
          
          {/* ASR + TTS Controls for Source Text */}
          <div className="absolute left-4 bottom-4 z-[3] flex gap-2 items-center max-[850px]:left-3 max-[850px]:bottom-14 max-[480px]:flex-col">
            {/* Record button */}
            {ASR_ENABLED_D && (
              <button
                type="button"
                className="w-[40px] h-[40px] rounded-full flex justify-center items-center bg-white shadow-[0px_0px_hsla(0,100%,100%,0.333)] hover:scale-110 transition"
                onClick={async () => {
                  if (translationRestricted) {
                    setTranslationRestrictedDialogOpen(true);
                    return;
                  }
                  if (!isRecording) {
                    try {
                      await startRecording();
                    } catch (e) {
                      setAsrStatus('error');
                      toast('No se pudo iniciar la grabación.');
                    }
                  } else {
                    stopRecording();
                  }
                }}
                aria-label="Grabar audio"
                title="Grabar audio"
                disabled={loadingState}
                style={{ pointerEvents: loadingState ? 'none' : 'auto' }}
              >
                <FontAwesomeIcon
                  icon={faMicrophone}
                  className="fa-lg"
                  color={isRecording ? "#d40000" : "#0a8cde"}
                />
              </button>
            )}

            {/* Upload button */}
            {ASR_ENABLED_D && (
              <label
                className="w-[40px] h-[40px] rounded-full flex justify-center items-center bg-white shadow-[0px_0px_hsla(0,100%,100%,0.333)] hover:scale-110 transition cursor-pointer"
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
                    e.currentTarget.value = "";

                    setAsrStatus('uploading');

                    try {
                      const okTypes = ['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4'];
                      if (file.type && !okTypes.includes(file.type)) {
                        toast('Formato no soportado. Sube webm/ogg/mp3/wav.');
                        setAsrStatus('error');
                        return;
                      }
                      await handleTranscribeBlob(file, file.name || 'audio.subido');
                    } catch (err) {
                      console.error(err);
                      setAsrStatus('error');
                      toast('No se pudo procesar el archivo.');
                    }
                  }}
                />
                <FontAwesomeIcon icon={faPlus} className="fa-lg" color="#0a8cde" />
              </label>
            )}

            {/* TTS button */}
            {TTS_ENABLED_SRC_D && (
              <button
                type="button"
                onClick={() => (isSpeaking ? stopSpeaking() : handleSpeak({ text: srcText, lang: srcLang.code }))}
                disabled={!srcText?.trim() || isLoadingAudio}
                className="w-[40px] h-[40px] rounded-full flex justify-center items-center bg-white shadow-[0px_0px_hsla(0,100%,100%,0.333)] hover:scale-110 transition disabled:opacity-100"
                aria-label={isSpeaking ? "Detener lectura" : "Reproducir lectura"}
                title={isSpeaking ? "Detener" : "Escuchar"}
              >
                <FontAwesomeIcon icon={isSpeaking ? faStop : isLoadingAudio ? faSpinner : faVolumeHigh} className={isLoadingAudio ? "fa-spin" : ""} color="#0a8cde" />
              </button>
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
          />
          
          {/* TTS Controls for Destination Text */}
          <div className="absolute left-4 bottom-4 z-[3] max-[850px]:left-3 max-[850px]:bottom-14">
            {TTS_ENABLED_DST_D && (
              <button
                type="button"
                onClick={() => (isSpeaking ? stopSpeaking() : handleSpeak({ text: dstText, lang: dstLang.code }))}
                disabled={!dstText?.trim()}
                className="w-[40px] h-[40px] rounded-full flex justify-center items-center bg-white shadow-[0px_0px_hsla(0,100%,100%,0.333)] hover:scale-110 transition disabled:opacity-100"
                aria-label={isSpeaking ? "Detener lectura" : "Reproducir lectura"}
                title={isSpeaking ? "Detener" : "Escuchar"}
              >
                <FontAwesomeIcon icon={isSpeaking ? faStop : faVolumeHigh} className="fa-lg" color="#0a8cde" />
              </button>
            )}
          </div>
        </div>
        
        {ANY_TTS_VISIBLE && ttsError && (
          <div className="fixed right-4 bottom-28 z-[3] text-sm text-red-600">
            {ttsError}
          </div>
        )}
      </TooltipProvider>

      <div className="translator-footer">
        {translationRestricted ? (<></>) : (
          <>
            <strong>¿Qué te ha parecido esta traducción?</strong>

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
      />
    </div>
  );
}