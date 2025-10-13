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
  faSpinner 
} from "@fortawesome/free-solid-svg-icons";
import Card from "../components/card/card.jsx"
import FeedbackModal from '../components/feedbackModal/feedbackModal.jsx'
import api from '../api';
import LangsModal from '../components/langsModal/langsModal.jsx'
import { API_ENDPOINTS, isTranslationRestricted, MAX_WORDS_TRANSLATION, TTS_ENABLED } from '../constants';
import { VARIANT_LANG } from "@/app/constants";
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAnalytics } from '@/hooks/useAnalytics';
import { AuthContext } from '../contexts';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { generateSpeech } from '../services/ttsService';

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
  
  // Add audio cache reference and cache size constant
  const audioCache = useRef(new Map());
  const MAX_AUDIO_CACHE_SIZE = 5; // Limit to 5 audio clips
  
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
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContext.close();
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

    const timeoutId = setTimeout(() => {
      translate();
    }, 1500);

    return () => clearTimeout(timeoutId);
  }, [srcText, srcLang, dstLang, translationRestricted]);

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
          
          {/* TTS Controls for Source Text */}
          <div className="absolute left-4 bottom-4 z-[3] flex gap-2 items-center max-[850px]:left-3 max-[850px]:bottom-3">
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
          <div className="absolute left-4 bottom-4 z-[3]">
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
        
        {/* TTS Status Indicators */}
        {ANY_TTS_VISIBLE && isSpeaking && (
          <div className="fixed right-4 bottom-16 z-[3] text-sm text-gray-500 flex items-center gap-2">
            <FontAwesomeIcon icon={faSpinner} spin />
            <span>Reproduciendo…</span>
          </div>
        )}
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