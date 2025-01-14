import os
import torch
from dotenv import load_dotenv
import os
import torch
from dotenv import load_dotenv
from transformers import AutoModelForSeq2SeqLM, NllbTokenizerFast
from optimum.bettertransformer import BetterTransformer
import logging

language_token_map = {
    "rap_Latn": "mri_Latn",
    "arn_a0_n": "quy_Latn",
    "arn_r0_n": "nso_Latn",
    "arn_u0_n": "fra_Latn",
}

class ModelWrapper:
    def __init__(self, model_path: str, logger: logging.Logger, optimize: bool = False):
        """
        Wrapper for NLLB models.

        Args:
            model_path (`str`):
                Model directory path.
            optimize (`bool`, *optional*, defaults to `True`):
                Optimize model inference.
        """
        self._device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        self.tokenizer = NllbTokenizerFast.from_pretrained(model_path)
        self.model = AutoModelForSeq2SeqLM.from_pretrained(
            model_path,
            torch_dtype=torch.float16,
            device_map=self._device,
            local_files_only=True
        )
        self.model.eval()
        self.logger = logger
        self.logger.debug(f"Model loaded on device: {self._device}")

        if optimize:
            self.logger.debug("Optimizing model...")
            self.optimize()
            self.logger.debug("Model optimized!")

    @torch.inference_mode()
    def predict(self, sentences: list[str], source_lang: str, target_lang: str) -> list[str]:
        """
        Given a sentence and its source language, predicts the corresponding translation.
        Available languages are: `spa_Latn`, `rap_Latn` (or `mri_Latn`) and `arn_Latn` (or `quy_Latn`).
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
        source_lang = language_token_map[source_lang] if source_lang in language_token_map else source_lang
        target_lang = language_token_map[target_lang] if target_lang in language_token_map else target_lang
        self.logger.debug(f"Source lang mapped: {source_lang}")
        self.logger.debug(f"Target lang mapped: {target_lang}")
        self.tokenizer.src_lang = source_lang
        self.tokenizer.tgt_lang = target_lang

        self.logger.debug(f"TRANSLATING {sentences}")

        inputs = self.tokenizer(sentences, return_tensors="pt", padding="longest").to(self._device)
        self.logger.debug(f"Inputs Shape: {inputs['input_ids'].shape}")
        prediction = self.model.generate(**inputs, forced_bos_token_id=self.tokenizer.convert_tokens_to_ids(target_lang))
        self.logger.debug(f"Prediction Shape: {prediction.shape}")
        translation = self.tokenizer.batch_decode(prediction, skip_special_tokens=True)
        self.logger.debug(f"Translation: {translation}")

        return translation

    def optimize(self, tf32: bool = True, better_transformer: bool = True, warmup: bool = True):
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
            self.logger.info("Setting TensorFloat32 precision...")
            torch.set_float32_matmul_precision("high")
        
        if better_transformer:
            self.logger.info("Optimizing model with BetterTransformer...")
            try:
                model = BetterTransformer.transform(self.model, keep_original_model=True)
                model.eval()
            except ValueError:
                self.logger.warning("BetterTransformer not available, using original model...")
                model = self.model

            self.model = model
            torch.cuda.empty_cache()
        if warmup:
            n_warmup = 5
            self.logger.info("Warming up model...")
            with torch.inference_mode():
                for _ in range(n_warmup):
                    inputs = self.tokenizer("texto de prueba", return_tensors="pt").to(self._device)
                    self.model.generate(**inputs, forced_bos_token_id=self.tokenizer.convert_tokens_to_ids("mri_Latn"))[0]
            self.logger.info("Model warmed up!")
    def __repr__(self):
        return self.model.__repr__()
    
    def __call__(self, *args, **kwargs):
        return self.predict(*args, **kwargs)