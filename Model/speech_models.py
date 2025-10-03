import logging
import os
from abc import ABC, abstractmethod

import torch
from dotenv import load_dotenv
from transformers import AutoTokenizer, VitsModel

load_dotenv()
HF_TOKEN = os.getenv("HF_TOKEN")

nllb_language_token_map = {"mri_Latn": "rap", "spa_Latn": "spa", "eng_Latn": "eng"}


class SpeechModelWrapper(ABC):
    """
    Abstract base class for speech models, similar to ModelWrapper.
    Preloads models in __init__ to avoid reloading on each inference.
    """

    def __init__(self, logger: logging.Logger, gpu: bool = True):
        self.logger = logger
        self._device = torch.device(
            "cuda" if gpu and torch.cuda.is_available() else "cpu"
        )
        self.models = {}  # Cache for loaded models
        self.tokenizers = {}  # Cache for loaded tokenizers
        self._preload_models()  # Preload all supported models

    def _preload_models(self):
        """Preload models for all supported languages."""
        for lang_code, lang in nllb_language_token_map.items():
            if lang == "rap":
                model_name = "agustinghent/mms-tts-rap-train1_1"
            else:
                model_name = f"facebook/mms-tts-{lang}"
            self.logger.info(f"Preloading MMS TTS model for {lang}...")
            self.models[lang] = VitsModel.from_pretrained(model_name).to(self._device)
            self.tokenizers[lang] = AutoTokenizer.from_pretrained(model_name)
        self.logger.info("All TTS models preloaded.")

    @abstractmethod
    def tokenize(self, text: str, lang: str):
        pass

    @abstractmethod
    def synthesize(self, inputs, lang: str):
        pass

    def predict(self, text: str, lang_code: str) -> torch.Tensor:
        """
        Predict speech waveform from text and language code.
        """
        if lang_code not in nllb_language_token_map:
            raise ValueError(f"Unsupported language: {lang_code}")
        lang = nllb_language_token_map[lang_code]
        inputs = self.tokenize(text, lang)
        return self.synthesize(inputs, lang)


class MMSTTSWrapper(SpeechModelWrapper):
    """
    Wrapper for MMS TTS models.
    """

    def tokenize(self, text: str, lang: str):
        tokenizer = self.tokenizers[lang]
        return tokenizer(text, return_tensors="pt").to(self._device)

    def synthesize(self, inputs, lang: str):
        model = self.models[lang]
        with torch.no_grad():
            return model(**inputs).waveform
