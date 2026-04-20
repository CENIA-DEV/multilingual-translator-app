// filepath: /Users/agusghent/Desktop/cenia/web/rap/multilingual-translator-app/Frontend/translator/src/app/services/ttsService.js
import api from '../api';
import { API_ENDPOINTS } from '../constants';

export const generateSpeech = async (text, language, gender, model_name = "mms_meta", model_version = "v1") => {
  try {
    const payload = {
      text,
      language,
      model_name,
      model_version
    };
    if (gender) payload.gender = gender;
    
    const response = await api.post(API_ENDPOINTS.TEXT_TO_SPEECH, payload);
    
    // Return the waveform data and metadata
    return response.data;
  } catch (error) {
    console.error('Text-to-speech generation failed:', error);
    throw error;
  }
};