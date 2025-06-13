import json
import logging
import os
from abc import ABC, abstractmethod
from typing import Optional, Union

import torch
from dotenv import load_dotenv
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
from transformers.tokenization_utils import BatchEncoding

load_dotenv()
HF_TOKEN = os.getenv("HF_TOKEN")

nllb_language_token_map = {
    "rap_Latn": "mri_Latn",
    "arn_a0_n": "quy_Latn",
    "arn_r0_n": "nso_Latn",
    "arn_u0_n": "fra_Latn",
}

madlad_language_token_map = {
    "arn_a0_n": "<2arn>",
    "arn_r0_n": "<2ape>",
    "arn_u0_n": "<2ann>",
    "spa_Latn": "<2es>",
}


class ModelWrapper(ABC):
    def __init__(
        self,
        model_path: str,
        logger: logging.Logger,
        optimize: bool = False,
        gpu: bool = True,
    ):
        """
        Wrapper for prediction models.

        Args:
            model_path (`str`):
                Model directory path.
            optimize (`bool`, *optional*, defaults to `True`):
                Optimize model inference.
        """
        self.logger = logger
        if gpu:
            if torch.cuda.is_available():
                self.logger.info("GPU available, using GPU")
                self._device = torch.device("cuda")
            else:
                self.logger.warning("GPU not available, using CPU instead")
                self._device = torch.device("cpu")
        else:
            self.logger.info("CPU mode")
            self._device = torch.device("cpu")

        self.tokenizer = AutoTokenizer.from_pretrained(model_path, token=HF_TOKEN)
        self.model = AutoModelForSeq2SeqLM.from_pretrained(
            model_path,
            torch_dtype=torch.float16,
            device_map=self._device,
            token=HF_TOKEN,
        )
        model_info = self.get_model_info()
        self.logger.info(f"Model info: {json.dumps(model_info, indent=2)}")
        self.model.eval()
        self.logger.debug(f"Model loaded on device: {self._device}")

        if optimize:
            self.logger.debug("Optimizing model...")
            self.optimize()
            self.logger.debug("Model optimized!")

    def get_model_info(self):
        """
        Returns model configuration information including model architecture,
        version, vocabulary size, and other configuration details.

        Returns:
            dict: A dictionary containing model configuration information
        """
        model_info = {
            "model_type": self.model.config.model_type,
            "architectures": (
                self.model.config.architectures
                if hasattr(self.model.config, "architectures")
                else None
            ),
            "hidden_size": self.model.config.hidden_size,
            "vocab_size": self.model.config.vocab_size,
            "encoder_layers": (
                self.model.config.encoder_layers
                if hasattr(self.model.config, "encoder_layers")
                else None
            ),
            "decoder_layers": (
                self.model.config.decoder_layers
                if hasattr(self.model.config, "decoder_layers")
                else None
            ),
        }

        # Add any version information if available
        if hasattr(self.model.config, "_name_or_path"):
            model_info["name_or_path"] = self.model.config._name_or_path
        if hasattr(self.model.config, "transformers_version"):
            model_info["transformers_version"] = self.model.config.transformers_version

        return model_info

    @abstractmethod
    def tokenize(self, sentences: list[str], target_lang: str, source_lang: str = None):
        pass

    @abstractmethod
    def generate(
        self,
        inputs: Union[BatchEncoding, dict[str, torch.Tensor]],
        **kwargs,
    ):
        pass

    @torch.inference_mode()
    def predict(
        self, sentences: list[str], source_lang: str, target_lang: str
    ) -> list[str]:
        """
        Given a sentence and its source language, predicts the corresponding
        translation. Available languages are: `spa_Latn`, `rap_Latn`
        (or `mri_Latn`) and `arn_Latn` (or `quy_Latn`).
        Args:
            sentences (`list`):
                List of sentences to be translated.
            source_lang (`str`):
                Associated language of the given `sentence`.
            target_lang (`str`):
                Target language to translate the given sentence.

        Returns:
            translation (`str`): The corresponding translation to the given sentece.
        """
        self.logger.debug(f"Translating sentences: {sentences}")
        self.logger.debug(f"Source lang original: {source_lang}")
        self.logger.debug(f"Target lang original: {target_lang}")

        inputs = self.tokenize(sentences, target_lang, source_lang)

        self.logger.debug(f"Inputs Shape: {inputs['input_ids'].shape}")
        prediction = self.generate(inputs, target_lang=target_lang)
        self.logger.debug(f"Prediction Shape: {prediction.shape}")
        translation = self.tokenizer.batch_decode(prediction, skip_special_tokens=True)
        self.logger.debug(f"Translation: {translation}")

        return translation

    def optimize(
        self, tf32: bool = True, better_transformer: bool = True, warmup: bool = True
    ):
        """
        Optimize the model for inference.

        Args:
            tf32 (`bool`, *optional*, defaults to `True`):
                Use TensorFloat32 precision (if available on hardware) for calculations.
            better_transformer (`bool`, *optional*, defaults to `True`):
                Use BetterTransformer class from Optimum library to optimize model.
            warmup (`bool`, *optional*, defaults to `True`):
                Warmup model before usage.
        """
        if tf32:
            device_is_cuda = (
                hasattr(self._device, "type") and self._device.type == "cuda"
            ) or ("cuda" == self._device)
            if device_is_cuda and min(torch.cuda.get_device_capability()) >= 7:
                self.logger.info("Setting TensorFloat32 precision...")
                torch.set_float32_matmul_precision("high")
            else:
                self.logger.warning(
                    "TensorFloat32 precision not available. Using default precision."
                )

        if better_transformer:
            self.model = torch.compile(self.model)
        if warmup:
            n_warmup = 5
            self.logger.info("Warming up model...")
            with torch.inference_mode():
                for _ in range(n_warmup):
                    inputs = self.tokenizer("texto de prueba", return_tensors="pt").to(
                        self._device
                    )
                    self.model.generate(
                        **inputs,
                        # TODO: For now, we use the unk token as the forced bos token
                        # to equal nllb and madlad models
                        forced_bos_token_id=self.tokenizer.unk_token_id,
                    )[0]
            self.logger.info("Model warmed up!")

    def __repr__(self):
        return self.model.__repr__()

    def __call__(self, *args, **kwargs):
        return self.predict(*args, **kwargs)


class NLLBModelWrapper(ModelWrapper):
    def generate(
        self,
        inputs: Union[BatchEncoding, dict[str, torch.Tensor]],
        target_lang: Optional[str] = None,
    ):
        if target_lang is None:
            raise ValueError("`target_lang` is required in NLLB models.")

        forced_bos_token_id = self.tokenizer.convert_tokens_to_ids(target_lang)
        prediction = self.model.generate(
            **inputs,
            forced_bos_token_id=forced_bos_token_id,
        )
        return prediction

    def tokenize(self, sentences: list[str], target_lang: str, source_lang: str):
        source_lang = (
            nllb_language_token_map[source_lang]
            if source_lang in nllb_language_token_map
            else source_lang
        )
        target_lang = (
            nllb_language_token_map[target_lang]
            if target_lang in nllb_language_token_map
            else target_lang
        )
        self.logger.debug(f"Source lang mapped: {source_lang}")
        self.logger.debug(f"Target lang mapped: {target_lang}")
        self.tokenizer.src_lang = source_lang
        self.tokenizer.tgt_lang = target_lang

        self.logger.debug(f"TRANSLATING {sentences}")

        return self.tokenizer(sentences, return_tensors="pt", padding="longest").to(
            self._device
        )


class MadLadWrapper(ModelWrapper):
    def generate(
        self,
        inputs: Union[BatchEncoding, dict[str, torch.Tensor]],
        **kwargs,  # ignore any extra arguments like `target_lang`
    ):
        prediction = self.model.generate(**inputs)  # start with `<unk>` token
        return prediction

    def tokenize(self, sentences: list[str], target_lang: str, source_lang: str = None):
        for idx, sentence in enumerate(sentences):
            if target_lang in madlad_language_token_map:
                mapped_target_lang = madlad_language_token_map[target_lang]
                self.logger.debug(f"Target lang mapped: {mapped_target_lang}")
                updated_sentence = mapped_target_lang + " " + sentence
                self.logger.debug(f"Sentence with target lang: {updated_sentence}")
                # update sentence for correct tokenization
                sentences[idx] = updated_sentence
            else:
                raise ValueError(f"Target language {target_lang} not supported")
        self.logger.debug(f"TRANSLATING sentences after updating: {sentences}")
        return self.tokenizer(sentences, return_tensors="pt", padding="longest").to(
            self._device
        )
