import api from '../api';
import { API_ENDPOINTS } from '../constants';

export const runOCR = async (formData) => {
  try {
    const response = await api.post(API_ENDPOINTS.OCR, formData);
    return response.data;
  } catch (error) {
    console.error('OCR request failed:', error);
    throw error;
  }
};
