import json
import logging
import os
from abc import ABC, abstractmethod

import numpy as np
import torch
from dotenv import load_dotenv
from transformers import (
    AutoProcessor,
    Wav2Vec2CTCTokenizer,
    Wav2Vec2FeatureExtractor,
    Wav2Vec2ForCTC,
    Wav2Vec2Processor,
    WhisperForConditionalGeneration,
    WhisperProcessor,
)

load_dotenv()

# Reusing the same language map from speech_models
nllb_language_token_map = {"rap_Latn": "rap", "spa_Latn": "spa", "eng_Latn": "eng"}


class ASRModelWrapper(ABC):
    """
    Abstract base class for ASR models, similar to SpeechModelWrapper.
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
        self._preload_models()  # Preload all supported models

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


class MMSASRWrapper(ASRModelWrapper):
    """
    Wrapper for MMS ASR models (facebook/mms-1b-all).
    """

    def __init__(
        self, logger: logging.Logger, gpu: bool = True, model_base_path: str = None
    ):
        super().__init__(logger, gpu, model_base_path)

    def _preload_models(self):
        """Preload the MMS model."""
        self.logger.info("=== STARTING ASR MODEL LOADING ===")
        self.logger.info(f"Device: {self._device}")

        if self.model_base_path and os.path.exists(self.model_base_path):
            model_path = self.model_base_path
            self.logger.info(f"Loading ASR model from local path: {model_path}")

            try:
                self.processor = AutoProcessor.from_pretrained(
                    model_path, local_files_only=True
                )
                self.model = Wav2Vec2ForCTC.from_pretrained(
                    model_path, local_files_only=True
                ).to(self._device)
                self.logger.info(f"Loaded MMS ASR from local path: {model_path}")
            except Exception as e:
                self.logger.warning(
                    f"Local MMS load failed: {e}. Falling back to default."
                )
                self._load_default_model()
        else:
            self._load_default_model()

        self.logger.info("=== ASR MODEL LOADING COMPLETE ===")

    def _load_default_model(self):
        """Load the default MMS model from Hugging Face."""
        model_id = "facebook/mms-1b-all"
        self.logger.info(f"Loading default ASR model: {model_id}")

        try:
            self.processor = AutoProcessor.from_pretrained(model_id)
            self.model = Wav2Vec2ForCTC.from_pretrained(model_id).to(self._device)
            self.logger.info(f"Default MMS ASR Model loaded: {model_id}")
        except Exception as e:
            self.logger.error(f"Failed to load default MMS ASR Model: {str(e)}")

    def process_audio(self, audio, sampling_rate: int):
        """Process audio for the ASR model."""
        return self.processor(
            audio, sampling_rate=sampling_rate, return_tensors="pt"
        ).to(self._device)

    def transcribe(self, inputs, lang: str):
        """Transcribe processed audio to text using the selected language."""
        self.processor.tokenizer.set_target_lang(lang)
        self.model.load_adapter(lang)

        with torch.no_grad():
            outputs = self.model(**inputs).logits

        # Use batch_decode for consistency
        pred_ids = torch.argmax(outputs, dim=-1)
        transcription = self.processor.batch_decode(pred_ids)[0]
        return transcription


class CustomRapanuiASRWrapper(ASRModelWrapper):

    def __init__(
        self,
        logger: logging.Logger,
        gpu: bool = True,
        model_base_path: str = None,
        vocab_path: str = None,
        base_checkpoint: str = "facebook/mms-1b-all",
        target_lang: str = "rap",
        use_fp16: bool = True,
    ):
        self.vocab_path = vocab_path
        self.base_checkpoint = base_checkpoint
        self.target_lang = target_lang
        self.use_fp16 = use_fp16 and gpu and torch.cuda.is_available()
        super().__init__(logger, gpu, model_base_path)

    def _load_vocab_file(self, vocab_path: str, target_lang: str = "rap"):
        """
        Loads a vocab.json that may be either flat (token -> id)
        """
        self.logger.info(f"Loading vocabulary from: {vocab_path}")
        with open(vocab_path, "r", encoding="utf-8") as f:
            raw = json.load(f)

        # Detect nested form {lang: {...}} vs flat form {...}
        if (
            isinstance(raw, dict)
            and target_lang in raw
            and isinstance(raw[target_lang], dict)
        ):
            nested = raw
        elif isinstance(raw, dict):
            # assume flat; wrap into nested
            nested = {target_lang: raw}
        else:
            raise ValueError(
                "Invalid vocab.json format: expected a dict (flat or nested)."
            )

        # Basic validation
        flat = nested[target_lang]
        if "[PAD]" not in flat or "[UNK]" not in flat:
            # Ensure specials exist (append at the end if missing)
            next_id = max(flat.values()) + 1 if flat else 0
            if "[UNK]" not in flat:
                flat["[UNK]"] = next_id
                next_id += 1
            if "[PAD]" not in flat:
                flat["[PAD]"] = next_id
            nested[target_lang] = flat

        self.logger.info(f"Loaded vocabulary with {len(flat)} tokens")
        return nested

    def _build_tokenizer_from_vocab(self, nested_vocab, work_dir="./_tmp_tokenizer"):
        os.makedirs(work_dir, exist_ok=True)
        vocab_file = os.path.join(work_dir, "vocab.json")
        with open(vocab_file, "w", encoding="utf-8") as f:
            json.dump(nested_vocab, f, ensure_ascii=False)

        self.logger.info(f"Building tokenizer with target language: {self.target_lang}")
        tokenizer = Wav2Vec2CTCTokenizer.from_pretrained(
            work_dir,
            unk_token="[UNK]",
            pad_token="[PAD]",
            word_delimiter_token="|",
            target_lang=self.target_lang,
        )
        return tokenizer

    def _create_processor(self, tokenizer):
        """
        Creates a processor using base checkpoint
        """
        self.logger.info(
            f"Creating processor from base checkpoint: {self.base_checkpoint}"
        )
        feature_extractor = Wav2Vec2FeatureExtractor.from_pretrained(
            self.base_checkpoint,
            feature_size=1,
            sampling_rate=16000,
            padding_value=0.0,
            do_normalize=True,
            return_attention_mask=True,
        )
        processor = Wav2Vec2Processor(
            feature_extractor=feature_extractor, tokenizer=tokenizer
        )
        return processor

    def _preload_models(self):
        """Preload the specialized Rapa Nui model."""
        self.logger.info("=== STARTING CUSTOM RAPA NUI ASR MODEL LOADING ===")
        self.logger.info(f"Device: {self._device}")

        if not self.model_base_path or not os.path.exists(self.model_base_path):
            self.logger.error("Model path not provided or doesn't exist")
            raise ValueError(f"Invalid model path: {self.model_base_path}")

        if not self.vocab_path or not os.path.exists(self.vocab_path):
            self.logger.error("Vocabulary file not provided or doesn't exist")
            raise ValueError(f"Invalid vocabulary path: {self.vocab_path}")

        try:
            # 1. Load vocabulary and build tokenizer
            nested_vocab = self._load_vocab_file(self.vocab_path, self.target_lang)
            tokenizer = self._build_tokenizer_from_vocab(nested_vocab)

            # 2. Create processor
            self.processor = self._create_processor(tokenizer)

            # 3. Load model from checkpoint
            self.logger.info(f"Loading model from: {self.model_base_path}")
            self.model = Wav2Vec2ForCTC.from_pretrained(
                self.model_base_path,
                pad_token_id=self.processor.tokenizer.pad_token_id,
                vocab_size=len(self.processor.tokenizer),
                ignore_mismatched_sizes=True,
            ).to(self._device)

            self.model.eval()

            self.logger.info("Custom Rapa Nui ASR model loaded successfully")

        except Exception as e:
            self.logger.error(f"Failed to load Custom Rapa Nui ASR Model: {str(e)}")
            raise

        self.logger.info("=== CUSTOM RAPA NUI ASR MODEL LOADING COMPLETE ===")

    def process_audio(self, audio, sampling_rate: int):
        """Process audio for the Rapa Nui ASR model."""
        return self.processor(
            audio, sampling_rate=sampling_rate, return_tensors="pt"
        ).to(self._device)

    def transcribe(self, inputs, lang: str):
        """Transcribe processed audio to text using Rapa Nui model."""
        with torch.no_grad():
            logits = self.model(**inputs).logits

        # Greedy CTC decoding
        pred_ids = torch.argmax(logits, dim=-1)
        transcription = self.processor.batch_decode(pred_ids)[0]

        return transcription


class HybridASRWrapper(ASRModelWrapper):
    """
    Hybrid wrapper that uses a specialized model for Rapa Nui (rap)
    and the Whisper model for other languages (spa, eng).
    """

    def __init__(
        self,
        logger: logging.Logger,
        gpu: bool = True,
        model_base_path: str = None,
        rap_model_path: str = None,
        rap_vocab_path: str = None,
        mms_base_path: str = None,  # ✅ New parameter for MMS base checkpoint
        use_fp16: bool = False,
        whisper_model_id: str = "openai/whisper-base",
        hf_token: str = None,
    ):
        self.rap_model_path = rap_model_path
        self.rap_vocab_path = rap_vocab_path
        self.mms_base_path = mms_base_path  # ✅ Store MMS base path
        self.use_fp16 = use_fp16 and gpu and torch.cuda.is_available()
        self.base_checkpoint = mms_base_path  # ✅ Use local path if provided
        self.whisper_model_id = whisper_model_id
        self.hf_token = hf_token
        super().__init__(logger, gpu, model_base_path)

    def _load_vocab_file(self, vocab_path: str, target_lang: str = "rap"):

        self.logger.info(f"Loading vocabulary from: {vocab_path}")
        with open(vocab_path, "r", encoding="utf-8") as f:
            raw = json.load(f)

        # Detect nested form {lang: {...}} vs flat form {...}
        if (
            isinstance(raw, dict)
            and target_lang in raw
            and isinstance(raw[target_lang], dict)
        ):
            nested = raw
        elif isinstance(raw, dict):
            # assume flat; wrap into nested
            nested = {target_lang: raw}
        else:
            raise ValueError(
                "Invalid vocab.json format: expected a dict (flat or nested)."
            )

        # Basic validation
        flat = nested[target_lang]
        if "[PAD]" not in flat or "[UNK]" not in flat:
            # Ensure specials exist (append at the end if missing)
            next_id = max(flat.values()) + 1 if flat else 0
            if "[UNK]" not in flat:
                flat["[UNK]"] = next_id
                next_id += 1
            if "[PAD]" not in flat:
                flat["[PAD]"] = next_id
            nested[target_lang] = flat

        self.logger.info(f"Loaded vocabulary with {len(flat)} tokens")
        return nested

    def _build_tokenizer_from_vocab(self, nested_vocab, work_dir="./_tmp_tokenizer"):

        os.makedirs(work_dir, exist_ok=True)
        vocab_file = os.path.join(work_dir, "vocab.json")
        with open(vocab_file, "w", encoding="utf-8") as f:
            json.dump(nested_vocab, f, ensure_ascii=False)

        self.logger.info("Building tokenizer with target language: rap")
        tokenizer = Wav2Vec2CTCTokenizer.from_pretrained(
            work_dir,
            unk_token="[UNK]",
            pad_token="[PAD]",
            word_delimiter_token="|",
            target_lang="rap",
        )
        return tokenizer

    def _create_processor(self, tokenizer):
        self.logger.info(
            f"Creating processor from base checkpoint: {self.base_checkpoint}"
        )

        # ✅ Check if using local path
        local_files_only = (
            os.path.exists(self.base_checkpoint)
            if isinstance(self.base_checkpoint, str)
            else False
        )

        feature_extractor = Wav2Vec2FeatureExtractor.from_pretrained(
            self.base_checkpoint,
            feature_size=1,
            sampling_rate=16000,
            padding_value=0.0,
            do_normalize=True,
            return_attention_mask=True,
            local_files_only=local_files_only,  # ✅ Use local files if available
        )
        processor = Wav2Vec2Processor(
            feature_extractor=feature_extractor, tokenizer=tokenizer
        )
        return processor

    def _preload_models(self):
        """Preload both the Whisper model and the specialized Rapa Nui model."""
        self.logger.info("=== STARTING HYBRID ASR MODEL LOADING ===")
        self.logger.info(f"Device: {self._device}")
        self.logger.info(f"MMS Base Checkpoint: {self.base_checkpoint}")

        # 1. Load Whisper model for Spanish and English
        try:
            whisper_path = self.model_base_path or self.whisper_model_id
            self.logger.info(f"Loading Whisper model from: {whisper_path}")

            local_files_only = (
                os.path.exists(whisper_path) if isinstance(whisper_path, str) else False
            )

            self.whisper_processor = WhisperProcessor.from_pretrained(
                whisper_path, token=self.hf_token, local_files_only=local_files_only
            )
            self.whisper_model = WhisperForConditionalGeneration.from_pretrained(
                whisper_path, token=self.hf_token, local_files_only=local_files_only
            ).to(self._device)

            self.whisper_model.eval()
            self.logger.info(f"Whisper model loaded successfully from {whisper_path}")
        except Exception as e:
            self.logger.error(f"Failed to load Whisper model: {str(e)}")
            raise

        # 2. Load specialized Rapa Nui model if paths are provided
        self.rap_model = None
        self.rap_processor = None

        if (
            self.rap_model_path
            and os.path.exists(self.rap_model_path)
            and self.rap_vocab_path
            and os.path.exists(self.rap_vocab_path)
        ):
            try:
                self.logger.info("Loading specialized Rapa Nui model")

                # Load vocabulary and build tokenizer
                nested_vocab = self._load_vocab_file(self.rap_vocab_path, "rap")
                tokenizer = self._build_tokenizer_from_vocab(nested_vocab)

                # Create processor (will use local MMS base checkpoint)
                self.rap_processor = self._create_processor(tokenizer)

                # Load model from checkpoint
                self.logger.info(f"Loading Rapa Nui model from: {self.rap_model_path}")
                self.rap_model = Wav2Vec2ForCTC.from_pretrained(
                    self.rap_model_path,
                    pad_token_id=self.rap_processor.tokenizer.pad_token_id,
                    vocab_size=len(self.rap_processor.tokenizer),
                    ignore_mismatched_sizes=True,
                    local_files_only=True,  # ✅ Force local loading
                ).to(self._device)

                self.rap_model.eval()

                self.logger.info("Rapa Nui ASR model loaded successfully")
            except Exception as e:
                self.logger.error(f"Failed to load Rapa Nui model: {str(e)}")
                self.logger.warning("Will fall back to general MMS model for Rapa Nui")

        else:
            self.logger.warning(
                "Rapa Nui model paths not provided or don't exist. "
                "Will use general MMS model for all languages."
            )

        self.logger.info("=== HYBRID ASR MODEL LOADING COMPLETE ===")

    def process_audio(self, audio, sampling_rate: int):
        """Process audio based on target language."""
        # We'll handle the processor selection in transcribe
        # For now, just return the audio and sampling rate
        return {"audio": audio, "sampling_rate": sampling_rate}

    def transcribe(self, inputs, lang: str) -> str:
        """Transcribe audio using the appropriate model based on language."""
        audio = inputs["audio"]
        sampling_rate = inputs["sampling_rate"]

        if lang == "rap" and self.rap_model and self.rap_processor:
            self.logger.info("Using specialized Rapa Nui model for transcription")
            # Process audio for Rapa Nui model
            processed_inputs = self.rap_processor(
                audio, sampling_rate=sampling_rate, return_tensors="pt"
            ).to(self._device)

            with torch.no_grad():
                logits = self.rap_model(**processed_inputs).logits

            # Greedy CTC decoding
            pred_ids = torch.argmax(logits, dim=-1)
            transcription = self.rap_processor.batch_decode(pred_ids)[0]

        # Otherwise use the Whisper model for Spanish and English
        else:
            self.logger.info(f"Using Whisper model for transcription of {lang}")
            whisper_lang_map = {"spa": "es", "eng": "en"}
            task = "transcribe"

            # Process audio for Whisper model
            input_features = self.whisper_processor(
                audio, sampling_rate=sampling_rate, return_tensors="pt"
            ).input_features.to(self._device)

            with torch.no_grad():
                predicted_ids = self.whisper_model.generate(
                    input_features, task=task, language=whisper_lang_map.get(lang)
                )

            transcription = self.whisper_processor.batch_decode(
                predicted_ids, skip_special_tokens=True
            )[0]

        return transcription


class BackupASRWrapper(ASRModelWrapper):
    """
    Hybrid wrapper that uses MMS model for Rapa Nui (rap)
    and the Whisper model for other languages (spa, eng).
    """

    def __init__(
        self,
        logger: logging.Logger,
        gpu: bool = True,
        model_base_path: str = None,
        rap_model_path: str = None,
        rap_vocab_path: str = None,
        mms_base_path: str = None,
        use_fp16: bool = False,
        whisper_model_id: str = "openai/whisper-base",
        hf_token: str = None,
    ):
        self.rap_model_path = rap_model_path
        self.rap_vocab_path = rap_vocab_path
        self.mms_base_path = mms_base_path or "facebook/mms-1b-all"
        self.use_fp16 = use_fp16 and gpu and torch.cuda.is_available()
        self.whisper_model_id = whisper_model_id
        self.hf_token = hf_token
        super().__init__(logger, gpu, model_base_path)

    def _preload_models(self):
        """Preload both the Whisper model and the MMS Rapa Nui model."""
        self.logger.info("=== STARTING BACKUP ASR MODEL LOADING ===")
        self.logger.info(f"Device: {self._device}")
        self.logger.info(f"MMS Base Checkpoint: {self.mms_base_path}")

        # 1) Whisper for spa/eng
        try:
            whisper_path = self.model_base_path or self.whisper_model_id
            self.logger.info(f"Loading Whisper model from: {whisper_path}")

            local_files_only = (
                os.path.exists(whisper_path) if isinstance(whisper_path, str) else False
            )

            self.whisper_processor = WhisperProcessor.from_pretrained(
                whisper_path, token=self.hf_token, local_files_only=local_files_only
            )
            self.whisper_model = WhisperForConditionalGeneration.from_pretrained(
                whisper_path, token=self.hf_token, local_files_only=local_files_only
            ).to(self._device)

            self.whisper_model.eval()
            self.logger.info(f"Whisper model loaded successfully from {whisper_path}")
        except Exception as e:
            self.logger.error(f"Failed to load Whisper model: {str(e)}")
            raise

        # 2) MMS for rap
        try:
            self.logger.info("Loading MMS model for Rapa Nui")

            # Check if using local path or Hugging Face model
            local_files_only = (
                os.path.exists(self.mms_base_path)
                if isinstance(self.mms_base_path, str)
                else False
            )

            # Load processor and model
            self.mms_processor = AutoProcessor.from_pretrained(
                self.mms_base_path, local_files_only=local_files_only
            )
            self.mms_model = Wav2Vec2ForCTC.from_pretrained(
                self.mms_base_path, local_files_only=local_files_only
            ).to(self._device)

            # Configure RAP adapter once
            self.mms_processor.tokenizer.set_target_lang("rap")
            self.mms_model.load_adapter("rap")
            self.mms_model.eval()
            self.logger.info("MMS (rap) loaded and configured.")
        except Exception as e:
            self.logger.error(f"Failed to load MMS (rap): {e}")
            raise

        self.logger.info("=== BACKUP ASR MODEL LOADING COMPLETE ===")

    def process_audio(self, audio, sampling_rate: int):
        """Process audio based on target language."""
        return {"audio": audio, "sampling_rate": sampling_rate}

    def transcribe(self, inputs, lang: str) -> str:
        """Transcribe audio using the appropriate model based on language."""
        audio = inputs["audio"]
        sampling_rate = inputs["sampling_rate"]

        # sanitize only (audio is already 16kHz)
        if isinstance(audio, np.ndarray):
            if np.isnan(audio).any() or np.isinf(audio).any():
                audio = np.nan_to_num(audio)
            audio = audio.astype(np.float32, copy=False)

        if (
            lang == "rap"
            and hasattr(self, "mms_model")
            and hasattr(self, "mms_processor")
        ):
            # MMS path: pass input_values directly, use batch_decode
            processed = self.mms_processor(
                audio, sampling_rate=sampling_rate, return_tensors="pt"
            )
            input_values = processed.input_values.to(self._device)

            with torch.no_grad():
                logits = self.mms_model(input_values).logits

            pred_ids = torch.argmax(logits, dim=-1)
            transcription = self.mms_processor.batch_decode(pred_ids)[0]
        else:
            self.logger.info(f"Using Whisper model for transcription of {lang}")
            whisper_lang_map = {"spa": "es", "eng": "en"}
            task = "transcribe"

            # Process audio for Whisper model
            input_features = self.whisper_processor(
                audio, sampling_rate=sampling_rate, return_tensors="pt"
            ).input_features.to(self._device)

            with torch.no_grad():
                predicted_ids = self.whisper_model.generate(
                    input_features, task=task, language=whisper_lang_map.get(lang)
                )

            transcription = self.whisper_processor.batch_decode(
                predicted_ids, skip_special_tokens=True
            )[0]

        return transcription
