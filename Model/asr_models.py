import logging
import os
from abc import ABC, abstractmethod

import numpy as np
import torch
from dotenv import load_dotenv
from transformers import AutoProcessor, Wav2Vec2ForCTC

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
    Uses MMS with Language Adapters for Rapa Nui (rap) and Spanish (spa).
    Supports bfloat16 and TensorFloat32 for enhanced performance.
    """

    def __init__(
        self,
        logger: logging.Logger,
        gpu: bool = True,
        model_base_path: str = None,  # MMS-1b-all path (compatibility)
        rap_adapter_path: str = None,  # Path to rap-adapter.bin
        spa_adapter_path: str = None,  # Path to spa-adapter.bin
        use_bf16: bool = False,
        use_tf32: bool = True,
        hf_token: str = None,
    ):
        self.mms_base_path = model_base_path or "facebook/mms-1b-all"
        self.rap_adapter_path = rap_adapter_path
        self.spa_adapter_path = spa_adapter_path
        self.use_bf16 = use_bf16 and gpu and torch.cuda.is_available()
        self.use_tf32 = use_tf32
        self.hf_token = hf_token

        # Internal state
        self.mms_model = None
        self.mms_processor = None

        super().__init__(logger, gpu, model_base_path)

    def _preload_models(self):
        self.logger.info("=== STARTING OPTIMIZED MMS ASR MODEL LOADING ===")
        self.logger.info(f"Device: {self._device}, bf16: {self.use_bf16}")

        # Load MMS for all supported languages (spa, rap)
        self._load_mms()

        self.logger.info("=== OPTIMIZED ASR MODEL LOADING COMPLETE ===")
        self.optimize(tf32=self.use_tf32)

    def _load_mms(self):
        try:
            self.logger.info(f"Loading MMS base model from: {self.mms_base_path}")
            local_files_only = (
                os.path.exists(self.mms_base_path)
                if isinstance(self.mms_base_path, str)
                else False
            )

            self.mms_processor = AutoProcessor.from_pretrained(
                self.mms_base_path,
                local_files_only=local_files_only,
                token=self.hf_token,
            )

            dtype = torch.bfloat16 if self.use_bf16 else torch.float32

            # Use low_cpu_mem_usage and device_map for faster loading
            device_map = {"": self._device} if self._device.type == "cuda" else None
            self.mms_model = Wav2Vec2ForCTC.from_pretrained(
                self.mms_base_path,
                local_files_only=local_files_only,
                torch_dtype=dtype,
                token=self.hf_token,
                low_cpu_mem_usage=True,
                device_map=device_map,
            )

            # Load Adapters
            self.logger.info("Loading Rapa Nui adapter...")
            try:
                self.mms_model.load_adapter("rap")
                self.logger.info("MMS Rapa Nui adapter loaded.")
            except Exception as e:
                self.logger.warning(f"Could not load rap adapter: {e}")

            self.logger.info("Loading Spanish adapter...")
            try:
                self.mms_model.load_adapter("spa")
                self.logger.info("MMS Spanish adapter loaded.")
            except Exception as e:
                self.logger.warning(f"Could not load spa adapter: {e}")

            self.mms_model.eval()

            # Apply torch.compile for faster inference if available (PyTorch 2.0+)
            if False and hasattr(torch, "compile") and self._device.type == "cuda":
                self.logger.info(
                    "Compiling MMS model with torch.compile for maximum "
                    "inference speed..."
                )
                try:
                    # Using 'reduce-overhead' can give better results for ASR models
                    self.mms_model = torch.compile(
                        self.mms_model, mode="reduce-overhead"
                    )
                    self.logger.info("torch.compile applied successfully.")
                except Exception as e:
                    self.logger.warning(
                        f"Failed to compile model: {e}. Proceeding without compilation."
                    )

            # Warmup the model to avoid latency on the first real request
            self._warmup()

            self.logger.info("MMS model initialized and warmed up successfully.")
        except Exception as e:
            self.logger.error(f"Failed to load MMS model: {e}")
            raise

    def _warmup(self):
        """Perform a dummy inference to warm up CUDA and compilation kernels."""
        try:
            self.logger.info("Warming up MMS model...")
            dummy_audio = np.zeros(16000, dtype=np.float32)
            # Use 'spa' as default warmup lang
            self.mms_processor.tokenizer.set_target_lang("spa")

            # CHANGED: load_adapter instead of set_adapter
            if hasattr(self.mms_model, "load_adapter"):
                self.mms_model.load_adapter("spa")

            processed = self.mms_processor(
                dummy_audio, sampling_rate=16000, return_tensors="pt"
            )
            input_values = processed.input_values.to(self._device)
            if self.use_bf16:
                input_values = input_values.to(torch.bfloat16)

            with torch.no_grad():
                _ = self.mms_model(input_values).logits
            self.logger.info("Warmup complete.")
        except Exception as e:
            self.logger.warning(f"Warmup failed: {e}")

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

        self.logger.info(f"Inference: Invoking MMS model for {lang}")

        # Set target language for tokenizer
        self.mms_processor.tokenizer.set_target_lang(lang)

        # PYTRITON FIX: Force the worker process to load the adapter from disk
        # before trying to set it, curing the "memory loss" from multiprocessing.
        try:
            self.mms_model.load_adapter(lang)
            self.mms_model.set_adapter(lang)
        except Exception as e:
            self.logger.warning(f"CRITICAL: Could not load/set adapter for {lang}: {e}")

        processed = self.mms_processor(
            audio, sampling_rate=sampling_rate, return_tensors="pt"
        )
        input_values = processed.input_values.to(self._device)

        if self.use_bf16:
            input_values = input_values.to(torch.bfloat16)

        with torch.no_grad():
            logits = self.mms_model(input_values).logits

        pred_ids = torch.argmax(logits, dim=-1)
        return self.mms_processor.batch_decode(pred_ids)[0]
