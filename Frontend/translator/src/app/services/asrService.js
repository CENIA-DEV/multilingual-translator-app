import api from '../api';
import { API_ENDPOINTS } from '../constants';

export const generateText = async (audio, language, model_name = "mms_meta_asr", model_version = "v1", fileName = "audio.webm") => {
  try {
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