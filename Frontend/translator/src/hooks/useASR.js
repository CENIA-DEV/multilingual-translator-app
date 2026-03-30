import { useState, useRef } from 'react';
import { generateText, warmupASRModel, validateTranscriptionApi } from '../app/services/asrService';
import { toast } from 'sonner';

export function useASR({ getAudioContext, trackEvent }) {
  const [isRecording, setIsRecording] = useState(false);
  const [asrStatus, setAsrStatus] = useState('idle');
  const [transcribeChoice, setTranscribeChoice] = useState('source');
  const [reviewTranscript, setReviewTranscript] = useState('');
  const [currentAsrId, setCurrentAsrId] = useState(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const prevStopAtRef = useRef(0);
  const recorderBusyRef = useRef(false);
  const chunksRef = useRef([]);
  const lastRecordingUrl = useRef(null);
  const lastRecordingBlobRef = useRef(null);
  const reviewAudioRef = useRef(null);
  const dropFirstChunkRef = useRef(false);
  const recordingTimeoutRef = useRef(null);
  const recordingStartedAtRef = useRef(0);
  const recordingIntervalRef = useRef(null);
  const stopSafeguardRef = useRef(null);
  const asrAbortRef = useRef(null);
  
  const asrWarmupDoneRef = useRef(false);
  const lastAsrActivityRef = useRef(0);
  const WARMUP_COOLDOWN_MS = 5 * 60 * 1000;
  const COOLDOWN_MS = 700;

  const [_, forceUpdate] = useState(0);

  const shouldWarmupASR = () => {
    const now = Date.now();
    const timeSinceLastActivity = now - lastAsrActivityRef.current;
    return !asrWarmupDoneRef.current || timeSinceLastActivity > WARMUP_COOLDOWN_MS;
  };

  const triggerASRWarmupIfNeeded = async (hintForWarmup = 'spa_Latn') => {
    if (!shouldWarmupASR()) {
      console.debug('ASR warmup skipped - server still warm');
      return;
    }
    
    console.debug('Triggering ASR warmup...');
    asrWarmupDoneRef.current = true;
    lastAsrActivityRef.current = Date.now();
    
    warmupASRModel(hintForWarmup).catch(() => {});
  };

  const updateASRActivity = () => {
    lastAsrActivityRef.current = Date.now();
  };

  function getPreferredMime() {
    if (typeof window !== 'undefined' && window.MediaRecorder && MediaRecorder.isTypeSupported) {
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
      if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) return 'audio/ogg;codecs=opus';
    }
    return 'audio/webm';
  }

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
        resolve(); 
      }, timeoutMs);
      track.addEventListener('unmute', onUnmute, { once: true });
    });
  }

  async function waitForInputEnergy(stream, threshold = 0.008, windowMs = 800, stepMs = 80) {
    try {
      const ctx = await getAudioContext();
      if (!ctx) return;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      const data = new Uint8Array(analyser.fftSize);
      const steps = Math.max(1, Math.floor(windowMs / stepMs));
      for (let i = 0; i < steps; i++) {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let j = 0; j < data.length; j++) {
          const v = (data[j] - 128) / 128; 
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        if (rms >= threshold) {
          try { source.disconnect(); } catch {}
          try { analyser.disconnect && analyser.disconnect(); } catch {}
          return;
        }
        await new Promise(r => setTimeout(r, stepMs));
      }
      try { source.disconnect(); } catch {}
      try { analyser.disconnect && analyser.disconnect(); } catch {}
    } catch (_) {
    }
  }

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

  function stopMicTracksNow() {
    const s = mediaStreamRef.current;
    if (s) {
      try { s.getTracks().forEach(t => t.stop()); } catch {}
      mediaStreamRef.current = null;
    }
  }

  async function getBlobDuration(blob, timeoutMs = 2000) {
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
    }

    try {
      const ctx = await getAudioContext();
      if (!ctx) return null;
      const buf = await blob.arrayBuffer();
      const decoded = await ctx.decodeAudioData(buf.slice(0)); 
      return decoded.duration ?? null;
    } catch {
      return null;
    }
  }

  const resetAudioState = (onResetCallback) => {
    if (onResetCallback) onResetCallback();

    if (stopSafeguardRef.current) { clearTimeout(stopSafeguardRef.current); stopSafeguardRef.current = null; }

    if (recordingTimeoutRef.current) { clearTimeout(recordingTimeoutRef.current); recordingTimeoutRef.current = null; }
    if (recordingIntervalRef.current) { clearInterval(recordingIntervalRef.current); recordingIntervalRef.current = null; }
    setRecordingSeconds(0);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      try { mediaRecorderRef.current.stop(); } catch {}
    }
    mediaRecorderRef.current = null;

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }

    safeUnloadReviewAudio();
    lastRecordingBlobRef.current = null;

    setIsRecording(false);
    setAsrStatus('idle');
    dropFirstChunkRef.current = true;
    prevStopAtRef.current = performance.now();
    recorderBusyRef.current = false;
    setCurrentAsrId(null); 
    forceUpdate(x => x + 1);
  };

  async function transcribeForReview(blob, hint, filename = 'audio.webm') {
    setAsrStatus('transcribing');
    try {
      const data = await generateText(blob, hint, "mms_meta_asr", "v1", filename);
      updateASRActivity();
      setReviewTranscript((data?.text || '').trim());
      setCurrentAsrId(data?.id || null);
      setAsrStatus('reviewing');
    } catch (err) {
      console.error(err);
      setAsrStatus('error');
      toast('Error al transcribir.', {
        description: err?.response?.data?.error || 'Reintenta con otro archivo.',
      });
    }
  }
  
  async function handleTranscribeBlob(blob, hint, filename, onSuccess, onReset) {
      setAsrStatus('transcribing');
      let timeoutId = null; 
      const controller = new AbortController();
      asrAbortRef.current = controller;

      try {
        timeoutId = setTimeout(() => {
          toast("La transcripción está tardando más tiempo de lo esperado...", {
            description: "Por favor, espere un momento",
            duration: 20000,
          });
        }, 5000);

        const data = await generateText(blob, hint, "mms_meta_asr", "v1", filename, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        updateASRActivity();

        const transcript = data?.text || '';
        
        if (onSuccess) onSuccess(transcript);
        toast('Transcripción lista.');
      } catch (err) {
        clearTimeout(timeoutId);
        console.error(err);
        if (err?.name === 'AbortError') {
          toast('Transcripción cancelada.');
          return;
        }
        toast('Error al transcribir.', {
          description: err?.response?.data?.error || 'Reintenta con otro archivo.',
        });
      } finally {
        asrAbortRef.current = null;
        await new Promise(r => setTimeout(r, COOLDOWN_MS));
        if (asrStatus !== 'idle' && onReset) onReset();
      }
  }

  function cancelTranscription(onReset) {
    try { asrAbortRef.current?.abort(); } catch {}
    asrAbortRef.current = null;
    resetAudioState(onReset);
  }

  async function validateTranscription(asrId, editedText, isSubmittingValidationRef, setIsSubmittingValidation) {
    if (!asrId || !editedText?.trim() || isSubmittingValidationRef.current) return;
    setIsSubmittingValidation(true);
    isSubmittingValidationRef.current = true;
    try {
      const data = await validateTranscriptionApi(asrId, editedText.trim());
      if (trackEvent) {
        trackEvent('asr_transcription_validated', {
          asr_id: asrId,
          was_edited: editedText !== reviewTranscript,
          page: 'translator'
        });
      }
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
      isSubmittingValidationRef.current = false;
    }
  }

  async function startRecording(opts = {}) {
    const {
      onShowModal,
      onStopWaveformVisualization,
      onStopMicTracksNow,
      hintChosen
    } = opts;

    if (recorderBusyRef.current) return;
    recorderBusyRef.current = true;

    try {
      setIsRecording(false);
      if (onShowModal) onShowModal();
	  
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast('Tu navegador no soporta grabación de audio.');
        recorderBusyRef.current = false;
        return;
      }

      const elapsed = performance.now() - (prevStopAtRef.current || 0);
      if (elapsed < COOLDOWN_MS) {
        await new Promise(r => setTimeout(r, COOLDOWN_MS - elapsed));
      }

      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        }
      };

      const mime = getPreferredMime();
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;

      const track = stream.getAudioTracks()[0];
      await waitForTrackUnmute(track, 1500);
      await waitForInputEnergy(stream, 0.008, 800, 80);
      await new Promise(r => setTimeout(r, 150));

      const recorder = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 160000 });
      chunksRef.current = [];
      dropFirstChunkRef.current = false;

      recorder.ondataavailable = (e) => {
        if (!e.data || e.data.size === 0) return;
        chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        if (onShowModal) onShowModal();
        if (onStopWaveformVisualization) onStopWaveformVisualization();
        if (onStopMicTracksNow) onStopMicTracksNow();
        else stopMicTracksNow();
		
        if (stopSafeguardRef.current) { clearTimeout(stopSafeguardRef.current); stopSafeguardRef.current = null; }

        await new Promise(resolve => setTimeout(resolve, 120)); 

        if (!chunksRef.current.length || chunksRef.current.every(c => c.size === 0)) {
          toast('No se grabó audio. Intente nuevamente.');
          resetAudioState();
          return;
        }

        try {
          const blob = new Blob(chunksRef.current, { type: mime.includes('ogg') ? 'audio/ogg' : 'audio/webm' });
          const duration = await getBlobDuration(blob);

          let finalBlob = blob;
          let finalAudioURL = URL.createObjectURL(finalBlob);
          let wasTruncated = false;

          if (duration != null && duration > 30) {
            const ctx = await getAudioContext();
            if (ctx) {
              const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
              const sampleRate = decoded.sampleRate;
              const frames = Math.min(decoded.length, Math.floor(sampleRate * 30));
              const trimmed = ctx.createBuffer(decoded.numberOfChannels, frames, sampleRate);
              for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
                trimmed.copyToChannel(decoded.getChannelData(ch).slice(0, frames), ch);
              }

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
          }

          lastRecordingBlobRef.current = finalBlob;
          if (lastRecordingUrl.current) URL.revokeObjectURL(lastRecordingUrl.current);
          lastRecordingUrl.current = finalAudioURL;
          forceUpdate(x => x + 1);
          recorderBusyRef.current = false;

          if (wasTruncated) toast('El audio fue truncado a 30 segundos.');

          await transcribeForReview(finalBlob, hintChosen || 'spa_Latn', 'grabacion.webm');
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

      recorder.start(200);
      toast('Grabación iniciada');

      if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = setTimeout(() => {
        stopRecording();
        toast('El audio no debe superar los 30 segundos.');
      }, 30000);
    } catch (err) {
      console.error('Error starting recording:', err);
      toast('Error al iniciar grabación: ' + (err.message || err.name));
      if (onStopMicTracksNow) onStopMicTracksNow();
      else stopMicTracksNow();
	  recorderBusyRef.current = false;
    }
  }

  function stopRecording(onStopMic) {
    const r = mediaRecorderRef.current;

    if (recordingTimeoutRef.current) { clearTimeout(recordingTimeoutRef.current); recordingTimeoutRef.current = null; }
    if (recordingIntervalRef.current) { clearInterval(recordingIntervalRef.current); recordingIntervalRef.current = null; }
    setRecordingSeconds(0);

    const duration = performance.now() - recordingStartedAtRef.current;
    if (r && r.state === 'recording' && duration < 500) {
      resetAudioState();
      toast('Grabación cancelada.');
      return;
    }

    if (r && r.state === 'recording') {
      setIsRecording(false);
      setAsrStatus('processing');
      r.stop();
	  if (onStopMic) onStopMic();
      else stopMicTracksNow();
	  
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

  return {
    isRecording, asrStatus, recordingSeconds, reviewTranscript, transcribeChoice, currentAsrId,
    setTranscribeChoice, setReviewTranscript, setCurrentAsrId, setAsrStatus,
    mediaRecorderRef, mediaStreamRef, prevStopAtRef, recorderBusyRef, chunksRef,
    lastRecordingUrl, lastRecordingBlobRef, reviewAudioRef, dropFirstChunkRef,
    recordingTimeoutRef, recordingStartedAtRef, recordingIntervalRef, stopSafeguardRef, asrAbortRef,
    asrWarmupDoneRef, lastAsrActivityRef,
    startRecording, stopRecording, cancelTranscription, resetAudioState, handleTranscribeBlob,
    transcribeForReview, triggerASRWarmupIfNeeded, getPreferredMime, waitForTrackUnmute,
    waitForInputEnergy, safeUnloadReviewAudio, stopMicTracksNow, getBlobDuration, validateTranscription
  };
}
