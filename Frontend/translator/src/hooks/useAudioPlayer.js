import { useState, useRef, useEffect } from 'react';
import { generateSpeech } from '../app/services/ttsService';

const MAX_AUDIO_CACHE_SIZE = 5; // Limit to 5 audio clips

export const useAudioPlayer = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsError, setTtsError] = useState('');
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  
  const audioRef = useRef(null);
  const currentAudioUrlRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioCache = useRef(new Map());

  // This function ensures we have a single, running AudioContext.
  const getAudioContext = async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    return audioContextRef.current;
  };

  // Helper function to play audio from buffer data
  const playAudioFromBuffer = async (waveformData) => {
    try {
      const audioContext = await getAudioContext();
      if (!audioContext) {
        console.error("Could not get a running AudioContext.");
        setIsSpeaking(false);
        return;
      }

      const sampleRate = 16000; // Hardcoded from backend knowledge
      
      const audioBuffer = audioContext.createBuffer(1, waveformData.length, sampleRate);
      const channelData = audioBuffer.getChannelData(0);
      
      for (let i = 0; i < waveformData.length; i++) {
        channelData[i] = waveformData[i];
      }
      
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      
      source.onended = () => setIsSpeaking(false);
      audioRef.current = source;
      source.start(0);
    } catch (err) {
      console.error('Error playing audio:', err);
      setIsSpeaking(false);
    }
  };

  const stopSpeaking = () => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
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
    setIsSpeaking(false);
  };

  const handleSpeak = async ({ text, lang = 'es-ES' }) => {
    if (!text?.trim()) return;

    setTtsError('');
    setIsSpeaking(true);
    
    const cacheKey = `${lang}_${text}`;
    
    if (audioRef.current) {
      try { audioRef.current.stop(); } catch (err) { console.log("Audio already stopped"); }
      audioRef.current = null;
    }
    
    if (currentAudioUrlRef.current) {
      URL.revokeObjectURL(currentAudioUrlRef.current);
      currentAudioUrlRef.current = null;
    }

    if (audioCache.current.has(cacheKey)) {
      console.log("Using cached audio");
      const cachedData = audioCache.current.get(cacheKey);
      playAudioFromBuffer(cachedData);
      return;
    }

    setIsLoadingAudio(true);
    
    try {
      const response = await generateSpeech(text, lang);
      setIsLoadingAudio(false);
      
      audioCache.current.set(cacheKey, response.waveform);
      
      if (audioCache.current.size > MAX_AUDIO_CACHE_SIZE) {
        const oldestKey = audioCache.current.keys().next().value;
        audioCache.current.delete(oldestKey);
      }
      
      playAudioFromBuffer(response.waveform);
    } catch (err) {
      setIsLoadingAudio(false);
      console.error('TTS error:', err);
      setTtsError(err?.message || 'Error al sintetizar');
      setIsSpeaking(false);
    }
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        try { audioRef.current.stop(); } catch (err) {}
      }
      if (currentAudioUrlRef.current) {
        URL.revokeObjectURL(currentAudioUrlRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  return {
    isSpeaking,
    ttsError,
    isLoadingAudio,
    handleSpeak,
    stopSpeaking,
    getAudioContext
  };
};