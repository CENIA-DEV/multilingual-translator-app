import api from '../api';
import { API_ENDPOINTS, MAX_AUDIO_MB } from '../constants';

export const generateText = async (audio, language, model_name = "mms_meta_asr", model_version = "v1", fileName = "audio.webm") => {
  try {
    // Validate file size
    const maxBytes = MAX_AUDIO_MB * 1024 * 1024;
    if (audio.size > maxBytes) {
      throw new Error(`El archivo supera ${MAX_AUDIO_MB} MB.`);
    }

    const formData = new FormData();
    formData.append('audio', audio, fileName);
    formData.append('language', language);
    formData.append('model_name', model_name);
    formData.append('model_version', model_version);

    const response = await api.post(API_ENDPOINTS.SPEECH_TO_TEXT, formData);
    return response.data;
  } catch (error) {
    console.error('Speech-to-Text generation failed:', error);
    throw error;
  }
};

/**
 * Send a tiny dummy audio to wake up the ASR model
 * Runs silently in background when user clicks mic button
 * @param {string} language - Language hint (e.g., 'spa_Latn', 'rap_Latn')
 */
export const warmupASRModel = async (language = 'spa_Latn') => {
  try {
    // Create a tiny silent audio blob (1 second of silence at 16kHz)
    const sampleRate = 16000;
    const duration = 1; // 1 second
    const numSamples = sampleRate * duration;
    
    // Create silent PCM data
    const silentData = new Int16Array(numSamples).fill(0);
    
    // Encode as WAV
    const wavBuffer = encodeWAV(silentData, sampleRate);
    const blob = new Blob([wavBuffer], { type: 'audio/wav' });
    
    // Send warmup request (ignore response)
    await generateText(blob, language, "mms_meta_asr", "v1", "warmup.wav");
    console.debug('✓ ASR model warmup completed for', language);
  } catch (err) {
    // Silent failure - don't alert user, model will load on actual request
    console.debug('ASR warmup skipped:', err.message);
  }
};

// Helper to encode WAV from PCM samples
function encodeWAV(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  
  // WAV header (RIFF format)
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  
  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);         // Chunk size (16 for PCM)
  view.setUint16(20, 1, true);          // Audio format (1 = PCM)
  view.setUint16(22, 1, true);          // Number of channels (1 = mono)
  view.setUint32(24, sampleRate, true); // Sample rate
  view.setUint32(28, sampleRate * 2, true); // Byte rate
  view.setUint16(32, 2, true);          // Block align
  view.setUint16(34, 16, true);         // Bits per sample
  
  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);
  
  // Write PCM samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    view.setInt16(offset, samples[i], true);
  }
  
  return buffer;
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}