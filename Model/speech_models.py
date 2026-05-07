import logging
import os
from abc import ABC, abstractmethod

import torch
from dotenv import load_dotenv
from transformers import AutoTokenizer, VitsModel

load_dotenv()
HF_TOKEN = os.getenv("HF_TOKEN")

nllb_language_token_map = {"rap_female": "rap/female", "rap_male": "rap/male"}


class SpeechModelWrapper(ABC):
    """
    Abstract base class for speech models.
    Uses a CLASS-LEVEL cache to ensure models are only loaded from disk ONCE
    even if multiple copies of the wrapper are created.
    """

    _model_cache = {}
    _tokenizer_cache = {}

    def __init__(
        self, logger: logging.Logger, gpu: bool = True, model_base_path: str = None
    ):
        self.logger = logger
        self._device = torch.device(
            "cuda" if gpu and torch.cuda.is_available() else "cpu"
        )
        self.model_base_path = model_base_path
        self._preload_models()

    def _preload_models(self):
        """Preload models for all supported languages with caching."""
        self.logger.info("=== STARTING MODEL LOADING ===")

        # Check local directory (common in Docker)
        tts_rap_dir = os.path.join(os.getcwd(), "tts-rap")
        if os.path.exists(tts_rap_dir):
            self.model_base_path = os.path.dirname(tts_rap_dir)

        for lang_code, lang in nllb_language_token_map.items():
            if lang in SpeechModelWrapper._model_cache:
                self.logger.info(f"Using cached model for {lang}")
                continue

            if self.model_base_path:
                model_path = os.path.join(self.model_base_path, "tts-rap", lang)
                self.logger.info(f"LOADING FROM DISK: {model_path}")

                try:
                    # low_cpu_mem_usage=True speeds up loading significantly
                    SpeechModelWrapper._model_cache[lang] = VitsModel.from_pretrained(
                        model_path, low_cpu_mem_usage=True, torch_dtype=torch.float32
                    ).to(self._device)

                    SpeechModelWrapper._tokenizer_cache[lang] = (
                        AutoTokenizer.from_pretrained(model_path)
                    )
                    self.logger.info(f"✓ {lang} loaded successfully.")
                except Exception as e:
                    self.logger.error(f"✗ Failed to load {lang}: {str(e)}")

        self.log_model_summary()

    @property
    def models(self):
        return SpeechModelWrapper._model_cache

    @property
    def tokenizers(self):
        return SpeechModelWrapper._tokenizer_cache

    def log_model_summary(self):
        self.logger.info("=== MODEL LOADING SUMMARY ===")
        for lang in nllb_language_token_map.values():
            config_path = None
            if (
                lang in self.models
                and hasattr(self.models[lang], "config")
                and hasattr(self.models[lang].config, "_name_or_path")
            ):
                config_path = self.models[lang].config._name_or_path
            self.logger.info(f"Model for {lang} loaded from: {config_path}")
        self.logger.info("===========================")
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

    def __init__(
        self, logger: logging.Logger, gpu: bool = True, model_base_path: str = None
    ):
        super().__init__(logger, gpu, model_base_path)

    def tokenize(self, text: str, lang: str):
        tokenizer = self.tokenizers[lang]
        return tokenizer(text, return_tensors="pt").to(self._device)

    def synthesize(self, inputs, lang: str):
        model = self.models[lang]
        with torch.no_grad():
            return model(**inputs).waveform
