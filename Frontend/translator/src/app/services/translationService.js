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

// `commune`: the comuna picked in "Ayúdame a decidir", or null
export const translateText = async (srcText, srcLang, dstLang, requestId, commune = null) => {
  const res = await api.post(
    API_ENDPOINTS.TRANSLATION,
    {
      src_text: srcText,
      src_lang: srcLang,
      dst_lang: dstLang,
      request_id: requestId,
      commune,
    }
  );
  return res.data;
};

export const submitPositiveFeedback = async (srcText, dstText, srcLang, dstLang, modelName, modelVersion, commune = null) => {
  const res = await api.post(
    API_ENDPOINTS.SUGGESTIONS + 'accept_translation/',
    {
      src_text: srcText,
      dst_text: dstText,
      src_lang: srcLang,
      dst_lang: dstLang,
      model_name: modelName,
      model_version: modelVersion,
      commune,
    }
  );
  return res.data;
};
