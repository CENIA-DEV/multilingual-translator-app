import logging
import os
from abc import ABC, abstractmethod

import torch
from dotenv import load_dotenv
from transformers import AutoTokenizer, VitsModel

load_dotenv()
HF_TOKEN = os.getenv("HF_TOKEN")

nllb_language_token_map = {"rap_Latn": "rap", "spa_Latn": "spa", "eng_Latn": "eng"}


class SpeechModelWrapper(ABC):
    """
    Abstract base class for speech models, similar to ModelWrapper.
    Preloads models in __init__ to avoid reloading on each inference.
    """

    def __init__(
        self, logger: logging.Logger, gpu: bool = True, model_base_path: str = None
    ):
        self.logger = logger
        self._device = torch.device(
            "cuda" if gpu and torch.cuda.is_available() else "cpu"
        )
        self.models = {}  # Cache for loaded models
        self.tokenizers = {}  # Cache for loaded tokenizers
        self.model_base_path = model_base_path
        self._preload_models()  # Preload all supported models

    def _preload_models(self):
        """Preload models for all supported languages."""
        self.logger.info("=== STARTING MODEL LOADING ===")
        self.logger.info(f"Device: {self._device}")
        self.logger.info(f"Model base path: {self.model_base_path}")

        # Check if we're in a container with downloaded models
        tts_rap_dir = os.path.join(os.getcwd(), "tts-rap")
        if os.path.exists(tts_rap_dir) and os.path.isdir(tts_rap_dir):
            self.logger.info(f"Found local tts-rap directory at {tts_rap_dir}")

            # List contents to verify what's available
            contents = os.listdir(tts_rap_dir)
            self.logger.info(f"Contents of tts-rap directory: {contents}")

            # Use this local path instead of the provided model_base_path
            self.model_base_path = os.path.dirname(tts_rap_dir)
            self.logger.info(f"Using local model path: {self.model_base_path}")

        for lang_code, lang in nllb_language_token_map.items():
            if self.model_base_path:
                # Load from local path - models are already downloaded by the workflow
                model_path = os.path.join(self.model_base_path, "tts-rap", lang)
                self.logger.info(f"ATTEMPTING TO LOAD FROM LOCAL PATH: {model_path}")

                # Check if directory exists
                if not os.path.exists(model_path):
                    self.logger.warning(f"Path does not exist: {model_path}")
                    # Try to list parent directory to see what's available
                    parent_dir = os.path.dirname(model_path)
                    if os.path.exists(parent_dir):
                        self.logger.info(f"{parent_dir}: {os.listdir(parent_dir)}")

                try:
                    self.models[lang] = VitsModel.from_pretrained(model_path).to(
                        self._device
                    )
                    self.tokenizers[lang] = AutoTokenizer.from_pretrained(model_path)
                    self.logger.info(f"{lang} loaded from: {model_path}")
                except Exception as e:
                    self.logger.error(f"✗{lang} from {model_path}: {str(e)}")

        self.logger.info("=== MODEL LOADING SUMMARY ===")
        for lang in nllb_language_token_map.values():
            config_path = None
            if hasattr(self.models[lang], "config") and hasattr(
                self.models[lang].config, "_name_or_path"
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
