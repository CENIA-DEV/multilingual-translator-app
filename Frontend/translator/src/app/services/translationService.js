import api from '../api';
import { API_ENDPOINTS } from '../constants';

export const getLanguages = async (code = null, script = null, dialect = null) => {
  let params = {};
  if (code !== null) params.code = code;
  if (script !== null) params.script = script;
  if (dialect !== null) params.dialect = dialect;

  const res = await api.get(API_ENDPOINTS.LANGUAGES, { params });
  return res.data;
};

export const translateText = async (srcText, srcLang, dstLang, requestId) => {
  const res = await api.post(
    API_ENDPOINTS.TRANSLATION,
    {
      src_text: srcText,
      src_lang: srcLang,
      dst_lang: dstLang,
      request_id: requestId,
    }
  );
  return res.data;
};

export const submitPositiveFeedback = async (srcText, dstText, srcLang, dstLang, modelName, modelVersion) => {
  const res = await api.post(
    API_ENDPOINTS.SUGGESTIONS + 'accept_translation/',
    {
      src_text: srcText,
      dst_text: dstText,
      src_lang: srcLang,
      dst_lang: dstLang,
      model_name: modelName,
      model_version: modelVersion
    }
  );
  return res.data;
};
