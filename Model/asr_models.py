import logging
import os
from abc import ABC, abstractmethod

import numpy as np
import torch
from dotenv import load_dotenv
from transformers import (
    AutoProcessor,
    Wav2Vec2ForCTC,
    WhisperForConditionalGeneration,
    WhisperProcessor,
)

load_dotenv()

# Language map for consistency with other parts of the app
nllb_language_token_map = {"rap_Latn": "rap", "spa_Latn": "spa", "eng_Latn": "eng"}


class ASRModelWrapper(ABC):
    """
    Abstract base class for ASR models.
    Preloads models in __init__ to avoid reloading on each inference.
    """

    def __init__(
        self, logger: logging.Logger, gpu: bool = True, model_base_path: str = None
    ):
        self.logger = logger
        self._device = torch.device(
            "cuda" if gpu and torch.cuda.is_available() else "cpu"
        )
        self.model = None
        self.processor = None
        self.model_base_path = model_base_path
        self._preload_models()

    @abstractmethod
    def _preload_models(self):
        """Preload models for all supported languages."""
        pass

    @abstractmethod
    def process_audio(self, audio, sampling_rate: int):
        """Process audio input for the model."""
        pass

    @abstractmethod
    def transcribe(self, inputs, lang: str):
        """Transcribe processed audio inputs to text."""
        pass

    def predict(self, audio, sampling_rate: int, lang_code: str) -> str:
        """
        Predict text from audio and language code.
        """
        if lang_code not in nllb_language_token_map:
            raise ValueError(f"Unsupported language: {lang_code}")
        lang = nllb_language_token_map[lang_code]
        inputs = self.process_audio(audio, sampling_rate)
        return self.transcribe(inputs, lang)

    def optimize(self, tf32: bool = True):
        """
        Optimize the model for inference.
        """
        device_is_cuda = (
            hasattr(self._device, "type") and self._device.type == "cuda"
        ) or ("cuda" == self._device)
        if tf32:
            if device_is_cuda and min(torch.cuda.get_device_capability()) >= 7:
                self.logger.info("Setting TensorFloat32 precision...")
                torch.set_float32_matmul_precision("high")
            else:
                self.logger.warning(
                    "TensorFloat32 precision not available. Using default precision."
                )


class OptimizedASRWrapper(ASRModelWrapper):
    """
    Consolidated and optimized ASR wrapper.
    Uses Whisper for English and Spanish (spa, eng).
    Uses MMS with Language Adapters for Rapa Nui (rap).
    Supports bfloat16 and TensorFloat32 for enhanced performance.
    """

    def __init__(
        self,
        logger: logging.Logger,
        gpu: bool = True,
        model_base_path: str = None,  # Whisper path
        mms_base_path: str = None,  # MMS-1b-all path
        rap_adapter_path: str = None,  # Path to rap-adapter.bin
        use_bf16: bool = False,
        use_tf32: bool = True,
        whisper_model_id: str = "openai/whisper-base",
        hf_token: str = None,
    ):
        self.mms_base_path = mms_base_path or "facebook/mms-1b-all"
        self.rap_adapter_path = rap_adapter_path
        self.use_bf16 = use_bf16 and gpu and torch.cuda.is_available()
        self.use_tf32 = use_tf32
        self.whisper_model_id = whisper_model_id
        self.hf_token = hf_token

        # Internal state
        self.whisper_model = None
        self.whisper_processor = None
        self.rap_model = None
        self.rap_processor = None

        super().__init__(logger, gpu, model_base_path)

    def _preload_models(self):
        self.logger.info("=== STARTING OPTIMIZED ASR MODEL LOADING ===")
        self.logger.info(f"Device: {self._device}, bf16: {self.use_bf16}")

        # 1. Load Whisper for Spanish and English
        self._load_whisper()

        # 2. Load MMS with Rapa Nui Adapter
        self._load_mms_rap()

        self.logger.info("=== OPTIMIZED ASR MODEL LOADING COMPLETE ===")
        self.optimize(tf32=self.use_tf32)

    def _load_whisper(self):
        try:
            whisper_path = self.model_base_path or self.whisper_model_id
            self.logger.info(f"Loading Whisper model from: {whisper_path}")
            local_files_only = (
                os.path.exists(whisper_path) if isinstance(whisper_path, str) else False
            )

            self.whisper_processor = WhisperProcessor.from_pretrained(
                whisper_path, token=self.hf_token, local_files_only=local_files_only
            )

            dtype = torch.bfloat16 if self.use_bf16 else torch.float32
            self.whisper_model = WhisperForConditionalGeneration.from_pretrained(
                whisper_path,
                token=self.hf_token,
                local_files_only=local_files_only,
                torch_dtype=dtype,
            ).to(self._device)

            self.whisper_model.eval()
            self.logger.info(f"Whisper model ({dtype}) loaded successfully.")
        except Exception as e:
            self.logger.error(f"Failed to load Whisper model: {e}")
            raise

    def _load_mms_rap(self):
        try:
            self.logger.info(f"Loading MMS base model from: {self.mms_base_path}")
            local_files_only = (
                os.path.exists(self.mms_base_path)
                if isinstance(self.mms_base_path, str)
                else False
            )

            self.rap_processor = AutoProcessor.from_pretrained(
                self.mms_base_path, local_files_only=local_files_only
            )

            dtype = torch.bfloat16 if self.use_bf16 else torch.float32
            self.rap_model = Wav2Vec2ForCTC.from_pretrained(
                self.mms_base_path, local_files_only=local_files_only, torch_dtype=dtype
            ).to(self._device)

            # Set Rapa Nui target
            self.rap_processor.tokenizer.set_target_lang("rap")

            # Load Adapter
            # load_adapter expects 'adapter.rap.bin' in the model directory.
            # If rap_adapter_path is provided, we check if it's already there.
            if self.rap_adapter_path and os.path.exists(self.rap_adapter_path):
                # We assume the user knows what they are doing if they passed a path.
                # However, load_adapter("rap") is the standard way for MMS.
                self.logger.info(
                    f"Using Rapa Nui adapter from: {self.rap_adapter_path}"
                )

            self.rap_model.load_adapter("rap")

            self.rap_model.eval()
            self.logger.info("MMS Rapa Nui (adapter) loaded successfully.")
        except Exception as e:
            self.logger.error(f"Failed to load MMS Rapa Nui model: {e}")
            raise

    def process_audio(self, audio, sampling_rate: int):
        return {"audio": audio, "sampling_rate": sampling_rate}

    def transcribe(self, inputs, lang: str) -> str:
        audio = inputs["audio"]
        sampling_rate = inputs["sampling_rate"]

        # Basic sanitization
        if isinstance(audio, np.ndarray):
            if np.isnan(audio).any() or np.isinf(audio).any():
                audio = np.nan_to_num(audio)
            audio = audio.astype(np.float32, copy=False)

        if lang == "rap":
            self.logger.info(
                f"Inference: Invoking MMS model for Rapa Nui (lang: {lang})"
            )
            return self._transcribe_rap(audio, sampling_rate)
        else:
            self.logger.info(f"Inference: Invoking Whisper model (lang: {lang})")
            return self._transcribe_whisper(audio, sampling_rate, lang)

    def _transcribe_rap(self, audio, sampling_rate):
        processed = self.rap_processor(
            audio, sampling_rate=sampling_rate, return_tensors="pt"
        )
        input_values = processed.input_values.to(self._device)

        if self.use_bf16:
            input_values = input_values.to(torch.bfloat16)

        with torch.no_grad():
            logits = self.rap_model(input_values).logits

        pred_ids = torch.argmax(logits, dim=-1)
        return self.rap_processor.batch_decode(pred_ids)[0]

    def _transcribe_whisper(self, audio, sampling_rate, lang):
        whisper_lang_map = {"spa": "es", "eng": "en"}
        input_features = self.whisper_processor(
            audio, sampling_rate=sampling_rate, return_tensors="pt"
        ).input_features.to(self._device)

        if self.use_bf16:
            input_features = input_features.to(torch.bfloat16)

        with torch.no_grad():
            predicted_ids = self.whisper_model.generate(
                input_features,
                task="transcribe",
                language=whisper_lang_map.get(lang, "es"),
            )

        return self.whisper_processor.batch_decode(
            predicted_ids, skip_special_tokens=True
        )[0]
