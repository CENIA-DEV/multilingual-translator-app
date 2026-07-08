import json
import logging
import os
from abc import ABC, abstractmethod

import ctranslate2
from transformers import AutoTokenizer

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
        n_warmup: int = 5,
        gpu: bool = True,
        max_new_tokens: int = 256,
        num_beams: int = 1,
        no_repeat_ngram_size: int = 0,
        repetition_penalty: float = 1.0,
        length_penalty: float = 1.0,
    ):
        """
        Wrapper for prediction models.

        Args:
            model_path (`str`):
                Model directory path.
            logger (`logging.Logger`):
                Logger object.
            optimize (`bool`, *optional*, defaults to `True`):
                Optimize model inference. Only available when running on GPU. This
                is ignored when running on CPU.
            n_warmup (`int`, *optional*, defaults to `5`):
                Number of warmup iterations when `optimize` is `True`.
            gpu (`bool`, *optional*, defaults to `True`):
                Use GPU for inference. Only available when running on CUDA-enabled GPU.
            max_new_tokens (`int`, *optional*, defaults to `256`):
                Maximum number of tokens to generate.
            num_beams (`int`, *optional*, defaults to `1`):
                Number of beams for beam search. If set to `1` (default), runs greedy
                decoding.
            no_repeat_ngram_size (`int`, *optional*, defaults to `0`):
                Size of no repeat n-grams. If set to `0`, no ngram
                penalties are used.
            repetition_penalty (`float`, *optional*, defaults to `1.0`):
                The parameter for repetition penalty. `1.0` means no penalty (default).
            length_penalty (`float`, *optional*, defaults to `1.0`):
                The parameter for length penalty. `1.0` means no penalty (default).
        """
        self.logger = logger
        self.gpu = gpu

        self.device = "cuda" if gpu else "cpu"
        self.logger.info(f"Using device: {self.device}")

        self.logger.info("Content info:")
        self.logger.info(f"Contents in folder ('./'): {os.listdir('.')}")
        self.logger.info(f"Folder path to load model: '{model_path}'")
        self.logger.info(f"Contents in '{model_path}': {os.listdir(model_path)}")

        self.tokenizer = AutoTokenizer.from_pretrained(model_path)
        self.model = ctranslate2.Translator(model_path, device=self.device)

        self.max_new_tokens = max_new_tokens
        self.logger.info(f"Max new tokens set to: {self.max_new_tokens}")

        self.generate_kwargs = {
            "beam_size": num_beams,
            "no_repeat_ngram_size": no_repeat_ngram_size,
            "repetition_penalty": repetition_penalty,
            "length_penalty": length_penalty,
        }
        self.logger.info(f"Model path: {model_path}")
        self.logger.info(
            f"Generate kwargs: {json.dumps(self.generate_kwargs, indent=2)}"
        )

        if optimize:
            self._optimize(n_warmup=n_warmup)

    @abstractmethod
    def _translate(
        self,
        sentences: list[str],
        source_lang: str,
        target_lang: str,
    ) -> list[str]:
        pass

    def _divide_newlines(
        self,
        sentences: list[str],
    ) -> tuple[list[str], list[bool], list[bool]]:
        """
        Divides the given sentences by newlines.

        Args:
            sentences (`list`):
                List of sentences to be divided.

        Returns:
            (`list`, `list` and `list`): List of sentences after dividing by newlines;
            list of booleans indicating whether the sentence was empty or not;
            list of booleans indicating whether the sentence was split by newlines or not.
        """
        _sentences = []
        merge_mask = []
        for sentence in sentences:
            if "\n" in sentence:
                paragraphs = sentence.split("\n")
                _sentences.extend(paragraphs)
                merge_mask.extend([True] * len(paragraphs))
            else:
                _sentences.append(sentence)
                merge_mask.append(False)

        empty_sentences_mask = [sentence in {"", " "} for sentence in _sentences]
        sentences = [
            sentence
            for sentence, is_empty in zip(_sentences, empty_sentences_mask)
            if not is_empty
        ]

        return sentences, empty_sentences_mask, merge_mask

    def _add_empty_translations(
        self,
        translations: list[str],
        empty_sentences_mask: list[bool],
    ) -> list[str]:
        """
        Adds empty translations for empty sentences.

        Args:
            translations (`list`):
                List of translations to be modified.
            empty_sentences_mask (`list`):
                List of booleans indicating whether the sentence was empty or not.

        Returns:
            `list`: List of translations with empty translations added.
        """
        if any(empty_sentences_mask):
            self.logger.debug(f"Found {len(empty_sentences_mask)} empty sentences")
            # introduce empty translations for empty sentences
            _translations = []
            idx = 0
            for is_empty in empty_sentences_mask:
                if not is_empty:
                    _translations.append(translations[idx])
                    idx += 1
                else:
                    _translations.append("")

            translations = _translations

        return translations

    def _merge_translations(
        self, translations: list[str], merge_mask: list[bool]
    ) -> list[str]:
        """
        Merges translations corresponding to sentences split by newlines.

        Args:
            translations (`list`):
                List of translations to be modified.
            merge_mask (`list`):
                List of booleans indicating whether the sentence was split by newlines or not.

        Returns:
            `list`: List of translations with translations merged.
        """
        # merge corresponding sentences if they were split by newlines
        if any(merge_mask):
            merged_translation = []
            temp = []
            for idx, is_split in enumerate(merge_mask):
                if is_split:
                    temp.append(translations[idx])
                else:
                    if len(temp) > 0:
                        merged_translation.append("\n".join(temp))
                        temp.clear()

                    merged_translation.append(translations[idx])

            # only repeat if buffer was not cleared by the previous loop
            if len(temp) > 0:
                merged_translation.append("\n".join(temp))
                temp.clear()

            translations = merged_translation

        return translations

    def predict(
        self,
        sentences: list[str],
        source_lang: str,
        target_lang: str,
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

        sentences, empty_sentences_mask, merge_mask = self._divide_newlines(sentences)
        self.logger.debug(f"Sentences after dividing by newlines: {sentences}")

        translations = self._translate(
            sentences,
            source_lang=source_lang,
            target_lang=target_lang,
        )
        translations = self._add_empty_translations(translations, empty_sentences_mask)
        translations = self._merge_translations(translations, merge_mask)

        self.logger.debug(f"Translations: {translations}")

        return translations

    def _optimize(self, n_warmup: int = 5):
        """
        Optimize the model for inference.

        Args:
            n_warmup (`int`, *optional*, defaults to `5`):
                Number of warmup iterations for torch.compile.
        """
        self.logger.info("Warming up model...")

        for _ in range(n_warmup):
            self._translate(["texto de prueba"], "<unk>", "<unk>")

        self.logger.info("Model optimized!")

    def __call__(self, *args, **kwargs):
        return self.predict(*args, **kwargs)


class NLLBModelWrapper(ModelWrapper):
    def _translate(
        self,
        sentences: list[str],
        source_lang: str,
        target_lang: str,
    ) -> list[str]:
        # map source and target languages (if possible)
        orig_source_lang = source_lang
        orig_target_lang = target_lang
        source_lang = nllb_language_token_map.get(source_lang, source_lang)
        target_lang = nllb_language_token_map.get(target_lang, target_lang)
        self.logger.debug(f"Source lang: {orig_source_lang} -> {source_lang}")
        self.logger.debug(f"Target lang: {orig_target_lang} -> {target_lang}")

        # do translation
        self.tokenizer.src_lang = source_lang
        target_prefix = [[target_lang]] * len(sentences)
        source = list(map(self.tokenizer.tokenize, sentences))
        source = [[source_lang] + s + ["</s>"] for s in source]
        results = self.model.translate_batch(
            source,
            target_prefix=target_prefix,
            **self.generate_kwargs,
        )

        # decode (also removes BOS token)
        results = [
            self.tokenizer.convert_tokens_to_string(result.hypotheses[0][1:])
            for result in results
        ]

        return results


class MadLadWrapper(ModelWrapper):
    def _translate(
        self,
        sentences: list[str],
        source_lang: str,  # not used for MADLAD models
        target_lang: str,
    ) -> list[str]:
        # map source and target languages (if possible)
        orig_source_lang = source_lang
        orig_target_lang = target_lang
        source_lang = madlad_language_token_map.get(source_lang, source_lang)
        target_lang = madlad_language_token_map.get(target_lang, target_lang)
        self.logger.debug(f"Source lang: {orig_source_lang} -> {source_lang}")
        self.logger.debug(f"Target lang: {orig_target_lang} -> {target_lang}")

        # do translation
        # TODO: maybe in the future we will update to `<2xx>TEXT` instead of `<2xx> TEXT`
        sentences = [f"{target_lang} {sentence}" for sentence in sentences]
        source = list(map(self.tokenizer.tokenize, sentences))
        results = self.model.translate_batch(source, **self.generate_kwargs)

        # decode
        results = [
            self.tokenizer.convert_tokens_to_string(result.hypothesis[0])
            for result in results
        ]

        return results
