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

import { useState, useEffect, useContext, useRef, useCallback } from 'react'
import { flushSync } from 'react-dom'
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
import { AUTOFILL_TRANSCRIPT, FORCED_MAINTENANCE, MAX_AUDIO_MB } from '../constants';
import { useAccess } from '@/customization/access';
import { useConfig, useIsPreview } from '@/customization/ConfigProvider';
import { matchesPrefix, prefixOf, useLanguageSides, variantParts } from '@/customization/languages';
import RichText from '@/customization/RichText';
import { useT } from '@/customization/useT';
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

// When to say a translation is slow. A normal one takes up to ~11 s on the
// slowest model (p95 of the Mapuzungun model's inference time, Oct 2026), and
// long texts take longer, so warn only past that: 12 s, plus 0.15 s per word
// beyond the first 30.
function slowTranslationMs(text) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return 12000 + Math.max(0, words - 30) * 150;
}

export default function Translator() {

  const config = useConfig();
  // A language with variants (Mapuzungun) is offered once on the source side;
  // the target side always holds a territory + alphabet (see useLanguageSides)
  const sides = useLanguageSides();
  const { features, translator: texts } = config;
  const t = useT();

  const [srcText, setSrcText] = useState('');
  const [showSrcTextMessage, setShowSrcTextMessage] = useState(false);
  const [dstText, setDstText] = useState('');
  const [srcLang, setSrcLangState] = useState(() => sides.toSource(sides.languageFor(texts.defaultSource)));
  const [dstLang, setDstLangState] = useState(() => sides.toTarget(sides.languageFor(texts.defaultTarget)));

  // Every change of language goes through these, so swapping the cards or
  // picking from the list turns a variant into the plain language on the
  // source side and back into the last variant used on the target side.
  const lastVariantRef = useRef(null);
  const setSrcLang = useCallback((lang) => setSrcLangState(sides.toSource(lang)), [sides]);
  const setDstLang = useCallback((lang) => {
    const next = sides.toTarget(lang, lastVariantRef.current);
    if (sides.showsVariants(next)) lastVariantRef.current = next;
    setDstLangState(next);
  }, [sides]);

  // Follow a change of the default languages (the editor's live preview)
  const defaultsRef = useRef({ src: texts.defaultSource, dst: texts.defaultTarget });
  useEffect(() => {
    const previous = defaultsRef.current;
    if (previous.src !== texts.defaultSource) setSrcLang(sides.languageFor(texts.defaultSource));
    if (previous.dst !== texts.defaultTarget) setDstLang(sides.languageFor(texts.defaultTarget));
    defaultsRef.current = { src: texts.defaultSource, dst: texts.defaultTarget };
  }, [texts.defaultSource, texts.defaultTarget, sides, setSrcLang, setDstLang]);

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
  // The languages the shown translation was made in. Feedback records these, so
  // switching territory or alphabet just before rating it (the new translation
  // waits a moment) still files it under the variant that produced it.
  const [translatedLangs, setTranslatedLangs] = useState(null);
  // The comuna picked in "Ayúdame a decidir" ({ name, territory }), or null. It
  // tags translations and feedback; choosing a territory it isn't in drops it.
  const [commune, setCommune] = useState(null);
  useEffect(() => {
    if (!commune) return;
    const territories = [srcLang, dstLang].map((lang) => variantParts(lang?.code).dialect);
    if (!territories.includes(commune.territory)) setCommune(null);
  }, [commune, srcLang, dstLang]);
  // The two cards and the swap button's arrows, for the swap animation
  const leftCardRef = useRef(null);
  const rightCardRef = useRef(null);
  const swapIconRef = useRef(null);
  const [isSuggestionOnlyMode, setIsSuggestionOnlyMode] = useState(false);

  const [loadingState, setLoadingState] = useState(false);
  const [copyReady, setCopyReady] = useState(false);
  const [suppressNextAutoTranslate, setSuppressNextAutoTranslate] = useState(false);

  // On arrival, a language with territory help (Mapuzungun) opens "Ayúdame a
  // decidir" first; the notice follows once it is closed. Without it, the
  // notice shows right away, as before.
  const [helpFirst, setHelpFirst] = useState(() =>
    (config.languages.variantSelector.territoryHelp || []).length > 0 &&
    (sides.showsVariants(srcLang) || sides.showsVariants(dstLang))
  );
  const [showDevModal, setShowDevModal] = useState(texts.notice.enabled && !helpFirst);
  // Inside the editor's preview the notice would cover the cards being edited
  const isPreview = useIsPreview();
  useEffect(() => {
    if (isPreview) {
      setShowDevModal(false);
      setHelpFirst(false);
    }
  }, [isPreview]);
  const handleHelpClosed = () => {
    if (!helpFirst) return;
    setHelpFirst(false);
    if (texts.notice.enabled && !isPreview) setShowDevModal(true);
  };
  // maintenance and who may use what: "Visibilidad" in Administrar Traductor
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(FORCED_MAINTENANCE || Boolean(config.access?.maintenance));
  
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

  // Who may use what ("Visibilidad"): the API enforces it, this shows it
  const access = useAccess(currentUser || null);
  const translationRestricted = !access.can('translation');
  const [translationRestrictedDialogOpen, setTranslationRestrictedDialogOpen] = useState(false);
  // A logged-in user kept out by a role can't fix it by logging in: say so
  const openRestricted = () => {
    if (currentUser) toast(t('access.noRole'));
    else setTranslationRestrictedDialogOpen(true);
  };
  // The page itself can be for logged-in users or some roles only
  const pageAllowed = access.can('translatorPage');
  useEffect(() => {
    if (!pageAllowed && currentUser === false) router.replace('/login');
  }, [pageAllowed, currentUser, router]);

  // The page renders before the login check finishes (currentUser is null
  // until then), so open the dialog once we know the visitor isn't logged in.
  useEffect(() => {
    setTranslationRestrictedDialogOpen(translationRestricted && currentUser === false);
  }, [translationRestricted, currentUser]);


  // Check if ASR and TTS are restricted for current user
  const ASRRestricted = !access.can('asr');
  const TTSRestricted = !access.can('tts');

  // --- Which languages get voice features ("Idiomas y funciones" in Administrar Traductor) ---
  // TTS reads languages by prefix ('rap' covers every Rapa Nui variant)
  const isTTSSideAllowed = (l) => features.tts.enabled && matchesPrefix(l, features.tts.languages);

  // ASR transcribes the languages it has a model hint for; audio upload only from the listed sources
  const isASRLang = (l) => features.asr.enabled && matchesPrefix(l, features.asr.languages);
  const isASRSourceAllowed = (l) => features.asr.enabled && matchesPrefix(l, features.asr.uploadLanguages);

  // The language hint the ASR model expects ('spa_Latn', 'rap_Latn', ...), or null
  function getHintForLang(l) {
    if (!features.asr.enabled) return null;
    const prefix = prefixOf(l?.code);
    return features.asr.languages.find((code) => prefixOf(code) === prefix) || null;
  }

  const srcHint = getHintForLang(srcLang);
  const dstHint = getHintForLang(dstLang);
  const srcDisplay = t.langName(srcLang) || t('translator.source');
  const dstDisplay = t.langName(dstLang) || t('translator.target');
  // Languages where "you are speaking X" is one word get a whole sentence per
  // language ("asr.speaking.<prefix>" in the customization), without the label
  const srcSpeaking = t.strict(`asr.speaking.${prefixOf(srcLang?.code)}`);
  const dstSpeaking = t.strict(`asr.speaking.${prefixOf(dstLang?.code)}`);
  const speakingSentences = Boolean(srcSpeaking && (dstSpeaking || !dstHint));

  // --- dinamics flags ---

  // TTS buttons: only show if not restricted OR user is logged in
  // const TTS_ENABLED_SRC_D = !TTSRestricted && isTTSSideAllowed(srcLang);
  // const TTS_ENABLED_DST_D = !TTSRestricted && isTTSSideAllowed(dstLang);
  // Make visibility depend on being logged in to avoid dead clicks.
  const TTS_ENABLED_SRC_D = isTTSSideAllowed(srcLang);
  const TTS_ENABLED_DST_D = isTTSSideAllowed(dstLang);
  
  const ANY_TTS_VISIBLE = TTS_ENABLED_SRC_D || TTS_ENABLED_DST_D;

  const WORD_INFORMATION_VISIBLE_D = access.can('wordInformation');
  
  // Separate (male / female) voices: their own rule
  const SEPARATE_GENDERS_ALLOWED_D = access.can('separateGenders');

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

  // The swap is animated so it can't be missed: each card's language, selectors
  // and text ([data-swap]) slide toward the other card and fade, the contents
  // trade places, and the new ones slide in from the other card's side, while
  // the button's arrows spin. Horizontal on desktop, vertical on phones, where
  // the cards are stacked. The Web Animations API leaves the elements' own CSS
  // fade-in alone (toggling animation classes would replay it).
  const handleCrossLang = async () => {
    if(loadingState === false && !isLoadingAudio){
      setLoadingState(true);
      const animate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const stacked = window.matchMedia('(max-width: 850px)').matches;
      // +1: the left (top) card's content, which travels right (down); -1: the other
      const shift = (sign) => stacked ? `translateY(${sign * 48}px)` : `translateX(${sign * 96}px)`;
      const parts = (ref) => Array.from(ref.current?.querySelectorAll('[data-swap]') || []);
      const play = (sign, ref, keyframes, options) =>
        parts(ref).map((el) => el.animate(keyframes(shift(sign)), options));

      let leaving = [];
      if (animate) {
        swapIconRef.current?.animate(
          [{ transform: 'rotate(0deg) scale(1)' }, { transform: 'rotate(90deg) scale(1.35)' }, { transform: 'rotate(180deg) scale(1)' }],
          { duration: 600, easing: 'cubic-bezier(.65,0,.35,1)', composite: 'add' }
        );
        const out = (to) => [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: to }];
        const options = { duration: 250, easing: 'cubic-bezier(.55,0,1,.45)', fill: 'forwards' };
        leaving = [...play(1, leftCardRef, out, options), ...play(-1, rightCardRef, out, options)];
        await Promise.all(leaving.map((a) => a.finished.catch(() => {})));
      }

      flushSync(() => {
        setSrcText(dstText);
        setSrcLang(dstLang);
        setDstLang(srcLang);
        setDstText(srcText);
        setTranslatedLangs((langs) => langs && { ...langs, src: langs.dst, dst: langs.src });
      });

      if (animate) {
        // The new content arrives from where it came: the left card's from the right
        leaving.forEach((a) => a.cancel());
        const into = (from) => [{ opacity: 0, transform: from }, { opacity: 1, transform: 'none' }];
        const options = { duration: 350, easing: 'cubic-bezier(.2,.8,.2,1)' };
        const arriving = [...play(1, leftCardRef, into, options), ...play(-1, rightCardRef, into, options)];
        await Promise.all(arriving.map((a) => a.finished.catch(() => {})));
      }
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
        'src_lang': translatedLangs?.src || srcLang,
        'dst_lang': translatedLangs?.dst || dstLang,
        'suggestion': dstText,
        'is_uncertain': false,
        'commune': translatedLangs ? translatedLangs.commune : commune?.name || null
      });
    }
  };

  const handlePositiveFeedback = async () => {
    if (dstText.length != 0 && !loadingState){
      try {
        await submitPositiveFeedback(
          srcText,
          dstText,
          translatedLangs?.src || srcLang,
          translatedLangs?.dst || dstLang,
          modelData.modelName,
          modelData.modelVersion,
          translatedLangs ? translatedLangs.commune : commune?.name || null
        );

        toast(t('translator.positiveSent'),{
          description: t('translator.feedbackThanks'),
          cancel: {
            label: t('common.close'),
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
          toast(t('common.error'),{
            description: t('common.loginRequired'),
            cancel: {
              label: t('common.close'),
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
        'src_lang': srcLang,
        'dst_lang': dstLang,
        'commune': commune?.name || null,
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
      openRestricted();
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

  // Source text input handler
  const handleSrcText = (text) => {
    console.log(text);
    console.log(text.trim().split(/\n+/).length);
    const textList = text.trim().split(/\s+/).filter(word => word.length > 0);
    const wordCount = textList.length;
    console.log(wordCount);
    
    // if the text is longer than the max words, limit the text to the max words
    // while preserving the structure (newlines)
    if (wordCount > access.maxWords){
      text = limitWordsPreserveLines(text, access.maxWords);
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
        toast(t('translator.copyError'), {
          description: t('translator.copyErrorBody'),
          cancel: {
            label: t('common.close'),
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
      openRestricted();
      toast(t('tts.loginRequired'), { duration: 4000 });
      return;
    }
    if (loadingState || isLoadingAudio) return; // prevent TTS while translating or already loading TTS
    
    // Give a notification if fetching takes longer than 3 seconds
    const timeoutId = setTimeout(() => {
      toast(t('tts.loading'), { id: 'tts-loading', duration: 20000 });
    }, 3000);

    try {
      await handleSpeakBase({ text, lang, gender });
    } finally {
      clearTimeout(timeoutId);
      // the audio is in (or failed): the notice has nothing left to say
      toast.dismiss('tts-loading');
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
    if (translationRestricted) { openRestricted(); return; }
    if (loadingState || isLoadingAudio) return;                      // extra guard
    if (srcText.length === 0) { setDstText(''); return; }
    setLoadingState(true);
    const startTime = performance.now();
    let timeoutId = setTimeout(() => {
      toast(t('translator.slow'), { id: 'translation-slow', duration: 20000 });
    }, slowTranslationMs(srcText));

    try {
      const requestId = (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2));
      reqIdRef.current = requestId;

      const data = await translateText(
        srcText,
        srcLang,
        dstLang,
        requestId,
        commune?.name || null
      );

      clearTimeout(timeoutId);
      setDstText(data.dst_text);
      setModelData({ modelName: data.model_name, modelVersion: data.model_version });
      setTranslatedLangs({ src: srcLang, dst: dstLang, commune: commune?.name || null });
      const endTime = performance.now();
      trackEvent('translation_success', { translation_time_ms: endTime - startTime, page: 'translator' });
    } catch (error) {
      clearTimeout(timeoutId);
      console.log('Request error:', error);
      if (!error?.response) {
        toast(t('translator.noBackend'), { description: t('translator.noBackendBody') });
      } else if (error.response.status === 400) {
        toast(t('common.error'), { description: t('translator.retry') });
      }
    } finally {
      // the translation is in (or failed): stop saying it's taking long
      toast.dismiss('translation-slow');
      setLoadingState(false);
    }
  }

  // `translate` and `startWaveformVisualization` are new functions on every
  // render. The effects below must call the current ones without re-running
  // (and restarting the auto-translate timer) on every render, so they read
  // them through refs that always hold the latest version.
  const translateRef = useRef(translate);
  const startWaveformRef = useRef(startWaveformVisualization);
  useEffect(() => {
    translateRef.current = translate;
    startWaveformRef.current = startWaveformVisualization;
  });

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
      translateRef.current();
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
      startWaveformRef.current(mediaStreamRef.current);
    }
    // The refs are stable objects; listing them doesn't add re-runs.
  }, [showRecordModal, isRecording, mediaStreamRef, waveCanvasRef, waveAnalyserRef]);

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
        toast(t('asr.validationFailed'), {
          description: t('asr.validationFailedBody'),
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
      toast(t('asr.noText'));
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
      // Revoke whichever recording is current when the page unmounts, which is
      // why the ref is read at cleanup time instead of copied earlier.
      const url = lastRecordingUrl.current; // eslint-disable-line react-hooks/exhaustive-deps
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [lastRecordingUrl]);
  
  const handleClearTexts = () => {
    setSrcText('');
    setDstText('');
    setShowSrcTextMessage(false);
  };

  const isBusy = asrStatus === 'transcribing' || asrStatus === 'processing';

  if (!pageAllowed) {
    // a visitor is on the way to the login page; a user without the role stays
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-default p-6 text-center text-white">
        {currentUser && <p className="max-w-md text-lg font-semibold">{t('access.pageNoRole')}</p>}
      </div>
    );
  }

  return (
    <div className="translator-container relative min-h-[100dvh] overflow-hidden">
      <Dialog open={showDevModal} onOpenChange={setShowDevModal}>
      <DialogContent className='h-fit w-1/2 gap-y-4 py-5 max-[850px]:w-5/6'>
        <DialogHeader>
          <DialogTitle>{t.tr(texts.notice.title)}</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p>
            <RichText html={t.tr(texts.notice.body)} />
          </p>
        </div>
        </DialogContent>
      </Dialog>
      <Dialog open={translationRestrictedDialogOpen} onOpenChange={setTranslationRestrictedDialogOpen}>
      <DialogContent className='h-fit w-1/2 gap-y-4 py-5 max-[850px]:w-3/4'>
        <DialogHeader>
          <DialogTitle>{t.tr(texts.restricted.title)}</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p>
            <RichText html={t.tr(texts.restricted.body)} />
          </p>
        </div>
        <div className="flex justify-center">
          <Button 
            className='bg-default/10 
                text-default text-xs font-bold 
                hover:bg-default hover:text-white' 
            onClick={() => handleLogin()}
          >
            {t.tr(texts.restricted.button)}
          </Button>
        </div>
        </DialogContent>
      </Dialog>
      
      <TooltipProvider>
        <div className="relative" ref={leftCardRef}>
          <Card
            side={"left"}
            srcText={srcText}
            lang={srcLang}
            handleSrcText={handleSrcText}
            handleSrcLang={handleSrcLang}
            commune={commune}
            onCommuneChange={setCommune}
            autoOpenHelp={helpFirst}
            onHelpClosed={handleHelpClosed}
            showTextMessage={showSrcTextMessage}
            handleLangModalBtn={handleLangModalBtnLeft}
            ttsEnabled={TTS_ENABLED_SRC_D}
            ttsText={srcText}
            ttsLangCode={srcLang?.code}
            isSpeaking={isSpeaking}
            isLoadingAudio={isLoadingAudio}
            wordInformationEnabled={WORD_INFORMATION_VISIBLE_D}
            separateGendersAllowed={SEPARATE_GENDERS_ALLOWED_D}
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
                title={t('asr.upload')}
                aria-label={t('asr.upload')}
              >
                <input
                  type="file"
                  accept="audio/*"
                  hidden
                  onChange={async (e) => {
                    if (translationRestricted) {
                      openRestricted();
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
                      toast(t('asr.unsupportedFormat'), {
                        description: t('asr.unsupportedFormatBody', { type: file.type }),
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
                        toast(t('asr.tooLong'), {
                          description: t('asr.detectedDuration', { seconds: Math.round(duration) }),
                        });
                        setAsrStatus('idle'); // Reset status
                        return;
                      }
                      
                      // If duration is valid, proceed to transcribe
                      setAsrStatus('uploading');
                      handleTranscribeBlob(file, srcHint, file.name || 'audio.subido').catch(err => {
                        console.error(err);
                        setAsrStatus('error');
                        toast(t('asr.fileFailed'));
                      });
                    };

                    const onError = () => {
                      cleanup();
                      toast(t('asr.readError'), {
                        description: t('asr.readErrorBody'),
                      });
                      setAsrStatus('idle');
                    };

                    tempAudio.addEventListener('loadedmetadata', onMetadataLoaded);
                    tempAudio.addEventListener('error', onError);
                    tempAudio.src = audioURL;
                    // --- DURATION VALIDATION END ---
                  }}
                />
                <FontAwesomeIcon icon={faPlus} className="fa-lg text-default" />
              </label>
            )}
          </div>

          {/* RIGHT: Mic + compact review next to it (bottom-right of white card).
              On phones this is a bar fixed to the bottom of the screen, so it is
              left out entirely where the site has no voice input (Mapuzungun). */}
            {ASR_MIC_VISIBLE_D && (
            <div className=" absolute right-4 bottom-4 z-[40] flex items-center gap-2 max-[850px]:fixed max-[850px]:inset-x-0 max-[850px]:bottom-0 max-[850px]:justify-center max-[850px]:gap-4 max-[850px]:bg-[#f3f4f6] max-[850px]:py-3 max-[850px]:px-6 max-[850px]:rounded-tl-[2rem] max-[850px]:rounded-tr-[2rem] max-[850px]:border-t max-[850px]:border-slate-200 max-[850px]:shadow-[0_-8px_24px_rgba(0,0,0,0.08)] max-[850px]:pb-[env(safe-area-inset-bottom)]">
            
			{/* Mic button (center-bottom) */}
			{ASR_MIC_VISIBLE_D && (
			  <div
				className={`box-content w-[50px] h-[50px] rounded-full flex justify-center items-center bg-white z-[3] cursor-pointer border-[8px] border-default shadow-[0px_0px_hsla(0,100%,100%,0.333)] transform transition-all duration-300 hover:scale-110 max-[850px]:-translate-y-1 ${showRecordModal ? 'hidden' : ''}`}
				onClick={async () => {
				  if (ASRRestricted) {
					openRestricted();
					return;
				  }
				  
				  // Trigger warmup only if needed (smart check)
				  triggerASRWarmupIfNeeded(srcHint || dstHint);
				  
				  // Open modal in "ready" state (do NOT start recording yet)
				  setTranscribeChoice(srcHint ? 'source' : (dstHint ? 'target' : 'source'));
				  setReviewTranscript('');
				  setShowRecordModal(true);
				  setAsrStatus('ready'); // start screen
				}}
				aria-label={t('asr.record')}
				title={t('asr.record')}
				disabled={loadingState || asrStatus === 'transcribing' || asrStatus === 'reviewing'}
				style={{ pointerEvents: (loadingState || asrStatus === 'transcribing' || asrStatus === 'reviewing') ? 'none' : 'auto' }}
			  >
				<FontAwesomeIcon
				  icon={isRecording ? faMicrophone : (asrStatus === 'transcribing' || asrStatus === 'processing' ? faSpinner : faMicrophone)}
				  className={`text-[1.5em] ${asrStatus === 'transcribing' || asrStatus === 'processing' ? 'fa-spin' : ''} ${isRecording ? 'text-[#d40000]' : 'text-default'}`}
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
            )}

        </div>

        <div
          className="delayed-fade-in w-[40px] h-[40px] rounded-full flex justify-center items-center bg-white absolute max-[850px]:top-1/2 max-[850px]:left-[45px] left-1/2 top-[100px] z-[2] cursor-pointer shadow-[0px_0px_hsla(0,100%,100%,0.333)] transform transition-all duration-300 hover:scale-110 hover:shadow-[8px_8px_#0005]"
          onClick={() => handleCrossLang()}
        >
          <span ref={swapIconRef} className="flex">
            <FontAwesomeIcon
              icon={faArrowRightArrowLeft }
              className={`fa-xl max-[850px]:rotate-90 transform transition-all duration-300 hover:scale-110 text-default`}
            />
          </span>
        </div>

        <div
          className={`delayed-fade-in w-[50px] h-[50px] rounded-full flex justify-center items-center bg-white absolute left-1/2 top-1/2 z-[2] cursor-pointer shadow-[0px_0px_hsla(0,100%,100%,0.333)] transform transition-all duration-300 hover:scale-110 hover:shadow-[8px_8px_#0005] ${(translationRestricted || isLoadingAudio || loadingState) ? 'opacity-50' : ''}`}
          onClick={() => handleTranslate()}
          style={{ pointerEvents: (loadingState || isLoadingAudio) ? 'none' : 'auto' }}
        >
          <FontAwesomeIcon
            icon={loadingState ? faArrowsRotate : (translationRestricted ? faLock : faArrowRight)}
            className={`fa-2xl transform transition-all duration-300 hover:scale-110 max-[850px]:rotate-90 ${translationRestricted ? 'opacity-50 text-[#666]' : 'text-default'}`}
            style={loadingState ? { animation: 'spin 1s linear infinite' } : {}}
          />
        </div>
		
        

        <div className="relative" ref={rightCardRef}>
          <Card
            side={"right"}
            dstText={dstText}
            lang={dstLang}
            handleDstLang={handleDstLang}
            commune={commune}
            onCommuneChange={setCommune}
            autoOpenHelp={helpFirst}
            onHelpClosed={handleHelpClosed}
            handleLangModalBtn={handleLangModalBtnRight}
            handleCopyText={handleCopyText}
            copyReady={copyReady}
            ttsEnabled={TTS_ENABLED_DST_D}
            ttsText={dstText}
            ttsLangCode={dstLang?.code}
            isSpeaking={isSpeaking}
            isLoadingAudio={isLoadingAudio}
            wordInformationEnabled={WORD_INFORMATION_VISIBLE_D}
            separateGendersAllowed={SEPARATE_GENDERS_ALLOWED_D}
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

      {/* On phones the feedback icons sit just above the voice bar, or at the
          very bottom when there is none */}
      <div className={`translator-footer ${ASR_MIC_VISIBLE_D ? 'max-[850px]:mb-[84px]' : ''}`}>
        {translationRestricted ? (<></>) : (
          <>
            <strong className="max-[850px]:hidden">{t.tr(texts.feedbackPrompt)}</strong>

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
					onClick={() => startRecording({ 
						hintChosen: transcribeChoice === 'source' ? srcHint : dstHint,
						onStopWaveformVisualization: stopWaveformVisualization
					})}
					className="w-14 h-14 rounded-full bg-default flex items-center justify-center shadow hover:shadow-md transition appearance-none border-0 outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 focus-visible:ring-2 focus-visible:ring-default focus-visible:ring-offset-2 focus-visible:ring-offset-white"
					title={t('asr.start')}
					aria-label={t('asr.start')}
					style={{ WebkitTapHighlightColor: 'transparent' }}
				  >
					<FontAwesomeIcon icon={faMicrophone} className="fa-lg" color="#ffffff" />
				  </button>
				  <div>
					<button
					  onClick={() => startRecording({ 
						  hintChosen: transcribeChoice === 'source' ? srcHint : dstHint,
						  onStopWaveformVisualization: stopWaveformVisualization
					  })}
					  className="text-default font-medium"
					>
					  {t('asr.start')}
					</button>
					<p className="text-xs text-slate-500 mt-1">
					  {t('asr.micReminder')}
					</p>
				  </div>
				</div>

                <div className="pt-1">
                  <div className="flex items-center gap-3">
                    {!speakingSentences && (
                      <span className="text-sm text-slate-600">{t('asr.speakingIn')}</span>
                    )}
                    <div className="inline-flex rounded-full border border-slate-200 bg-white p-1">
                      <button
                        onClick={() => setTranscribeChoice('source')}
                        className={`px-3 py-1 text-sm rounded-full transition border ${
                          transcribeChoice === 'source'
                            ? 'bg-default text-white border-default'
                            : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
                        }`}
                      >
                        {speakingSentences ? srcSpeaking : srcDisplay}
                      </button>
                      <button
                        onClick={() => dstHint && setTranscribeChoice('target')}
                        disabled={!dstHint}
                        className={`ml-1 px-3 py-1 text-sm rounded-full transition border ${
                          transcribeChoice === 'target'
                            ? 'bg-default text-white border-default'
                            : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
                        } ${!dstHint ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {speakingSentences && dstSpeaking ? dstSpeaking : dstDisplay}
                      </button>
                    </div>
                  </div>
                </div>

			  </div>
			)}

            {/* PREPARING VIEW: spinner + helper */}
            {asrStatus === 'preparing' && (
              <div className="flex flex-col items-center justify-center py-12 space-y-4 animate-in fade-in zoom-in duration-300">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-4 border-slate-100 border-t-default animate-spin" />
                  <FontAwesomeIcon 
                    icon={faMicrophone} 
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-default text-xl" 
                  />
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-slate-800">{t('asr.connecting')}</p>
                  <p className="text-sm text-slate-500 mt-1">{t('asr.wait')}</p>
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
                    title={t('asr.stop')}
                    aria-label={t('asr.stop')}
                  >
                    <span className="block w-3.5 h-3.5 bg-white" />
                  </button>
                  <p className="text-sm font-medium text-red-600">{t('asr.stop')}</p>
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
                  <span>{t('asr.transcribing')}</span>
                </div>
                <Button
                  variant="outline"
                  onClick={cancelTranscription}
                  className="ml-auto"
                >
                  {t('common.cancel')}
                </Button>
              </div>
            )}
			
            {/* REVIEW VIEW: textarea + player + actions */}
            {!isRecording && asrStatus === 'reviewing' && lastRecordingUrl.current && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {t('asr.transcription')} ({transcribeChoice === 'source' ? srcDisplay : dstDisplay})
                  </label>
                  <textarea
                    className="w-full h-40 p-3 rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-default"
                    value={reviewTranscript}
                    onChange={(e) => setReviewTranscript(e.target.value)}
                    placeholder={t('asr.reviewPlaceholder')}
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
                    {t('common.cancel')}
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      className="bg-default/10 text-default text-sm font-medium hover:bg-default hover:text-white"
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
                      {t('asr.recordAgain')}
                    </Button>
                    <Button
                      className="bg-default text-white text-sm font-medium hover:bg-defaultStrong"
                      onClick={startTranslationFromReview}
                      disabled={isSubmittingValidation} // Add disabled state
                    >
                      {t('asr.translate')}
                      <FontAwesomeIcon icon={faArrowRight} className="ml-2" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

		  </DialogContent>
	   </Dialog>

      <Dialog open={showMaintenanceModal} onOpenChange={setShowMaintenanceModal}>
        <DialogContent className="bg-white rounded-lg shadow-lg p-6 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-xl font-semibold text-slate-800">
              {t.tr(texts.maintenance.title)}
            </DialogTitle>
          </DialogHeader>
          <div className="text-center space-y-4">
            <p className="text-slate-600">
              <RichText html={t.tr(texts.maintenance.body)} />
            </p>
            <Button
              onClick={() => setShowMaintenanceModal(false)}
              className="bg-default text-white hover:bg-defaultStrong w-full"
            >
              {t.tr(texts.maintenance.button)}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}