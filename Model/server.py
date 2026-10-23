# server
import argparse
import logging

import numpy as np
from dotenv import load_dotenv
from model import (
    MadLadCT2Wrapper,
    MadLadWrapper,
    ModelWrapper,
    NLLBCT2Wrapper,
    NLLBModelWrapper,
)
from pytriton.decorators import batch
from pytriton.model_config import DynamicBatcher, ModelConfig, Tensor
from pytriton.triton import Triton, TritonConfig, TritonLifecyclePolicy

load_dotenv()

# `madlad-ct2` is MADLAD on CTranslate2 (a model made by convert_madlad_ct2.py),
# `nllb-ct2` NLLB on CTranslate2, CPU only (a model made by convert_nllb_ct2.py)
MODEL_CLASSES = {
    "nllb": NLLBModelWrapper,
    "nllb-ct2": NLLBCT2Wrapper,
    "madlad": MadLadWrapper,
    "madlad-ct2": MadLadCT2Wrapper,
}

# Optional inputs naming a language variant's territory and alphabet, sent by the
# backend only for languages that have them (arn_Latn + "nagche" + "raguileo")
VARIANT_INPUTS = [
    f"{side}_{field}"
    for side in ("source", "target")
    for field in ("territory", "writing")
]


class _InferFuncWrapper:
    """
    Class wrapper of inference func for triton. Used to also store the model variable
    """

    def __init__(self, model: ModelWrapper, logger):
        self._model = model
        self._logger = logger

    @batch
    def __call__(self, **inputs) -> np.ndarray:
        """
        Main inference function for triton backend. Called after batch inference.
        Performs all the logic of decoding inputs, calling the model and returning
        outputs.

        Args:
            input_text: Batch of texts to translate
            source_lang, target_lang: Batch of language codes
            source_territory, source_writing, target_territory, target_writing:
                Optional batch of the languages' variant (absent for languages
                without variants)

        Returns
            translation: Batch of translations
        """

        def decode(value):
            return np.char.decode(value.astype("bytes"), "utf-8").item()

        def value(name, idx):
            return decode(inputs[name][idx]) if name in inputs else None

        texts = [decode(t).replace("\\n", "\n") for t in inputs["input_text"]]

        # Requests to the same languages and variants are translated together.
        # (pytriton's `group_by_values` needs every key, and the variant inputs are
        # optional.)
        groups = {}
        for idx in range(len(texts)):
            key = tuple(
                value(name, idx)
                for name in (
                    "source_lang",
                    "target_lang",
                    "target_territory",
                    "target_writing",
                )
            )
            groups.setdefault(key, []).append(idx)

        translations = [None] * len(texts)
        for (source_lang, target_lang, territory, writing), idxs in groups.items():
            target_variant = {
                field: field_value
                for field, field_value in (
                    ("territory", territory),
                    ("writing", writing),
                )
                if field_value
            }
            self._logger.debug(f"Texts: {[texts[idx] for idx in idxs]}")
            self._logger.debug(f"Source lang: {source_lang}")
            self._logger.debug(f"Target lang: {target_lang} {target_variant}")
            # call model
            group_translations = self._model.predict(
                [texts[idx] for idx in idxs], source_lang, target_lang, target_variant
            )
            for idx, translation in zip(idxs, group_translations):
                translations[idx] = translation

        translations = np.char.encode(translations, "utf-8")
        translations = np.expand_dims(translations, axis=1)

        return {"translation": translations}


def _infer_function_factory(
    num_copies,
    logger,
    folder_path,
    optimize,
    gpu,
    model_type,
    max_new_tokens,
    generation_kwargs,
):
    infer_fns = []
    for _ in range(num_copies):
        logger.info(f"Loading model at {folder_path}")
        # TO DO: CHECK IF MODEL NAME IN FOLDER PATH

        logger.info(f"Model type: {model_type}")
        model_cls = MODEL_CLASSES[model_type]
        model = model_cls(
            folder_path,
            logger=logger,
            optimize=optimize,
            gpu=gpu,
            max_new_tokens=max_new_tokens,
            **generation_kwargs,
        )
        logger.info("Model loaded!")
        infer_fns.append(_InferFuncWrapper(model=model, logger=logger))
    return infer_fns


def _parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Enable verbose logging in debug mode.",
        default=True,
    )

    parser.add_argument(
        "--model-name",
        "-m",
        action="store",
        help="Model name",
    )

    parser.add_argument(
        "--optimize", action="store_true", help="Optimize model.", default=False
    )

    parser.add_argument(
        "--copies",
        type=int,
        default=1,
        required=False,
        help="Number of copies of the model.",
    )

    parser.add_argument(
        "--gpu",
        "-c",
        action="store_true",
        help="If use CPU",
        default=False,
    )

    parser.add_argument(
        "--port",
        "-p",
        type=int,
        default=8015,
        help="Port to use",
    )

    parser.add_argument(
        "--model-type",
        "-t",
        type=str,
        default="nllb",
        choices=list(MODEL_CLASSES),
    )
    parser.add_argument(
        "--max-new-tokens",
        type=int,
        default=256,
        help="Max new tokens to generate",
    )
    # generation settings; left unset, the model's own defaults apply
    parser.add_argument("--num-beams", type=int, default=None)
    parser.add_argument("--no-repeat-ngram-size", type=int, default=None)
    parser.add_argument("--repetition-penalty", type=float, default=None)
    parser.add_argument("--length-penalty", type=float, default=None)
    return parser.parse_args()


def main():
    """Initialize server with model."""
    args = _parse_args()

    # initialize logging
    log_level = logging.DEBUG if args.verbose else logging.INFO
    logging.basicConfig(
        level=log_level, format="%(asctime)s - %(levelname)s - %(name)s: %(message)s"
    )

    model_name = args.model_name
    logger = logging.getLogger(f"{model_name}.server")

    log_verbose = 1 if args.verbose else 0

    config = TritonConfig(
        http_port=args.port,
        exit_on_error=True,
        log_verbose=log_verbose,
        allow_http=True,
        cache_config=[f"local,size={10 * 1024 * 1024}"],
    )
    policy = TritonLifecyclePolicy(launch_triton_on_startup=False)
    with Triton(config=config, triton_lifecycle_policy=policy) as triton:
        # bind the model with its inference call and configuration
        triton.bind(
            model_name=model_name.replace("/", "--"),
            infer_func=_infer_function_factory(
                num_copies=args.copies,
                logger=logger,
                folder_path=args.model_name,
                optimize=args.optimize,
                gpu=args.gpu,
                model_type=args.model_type,
                max_new_tokens=args.max_new_tokens,
                generation_kwargs={
                    "num_beams": args.num_beams,
                    "no_repeat_ngram_size": args.no_repeat_ngram_size,
                    "repetition_penalty": args.repetition_penalty,
                    "length_penalty": args.length_penalty,
                },
            ),
            inputs=[
                Tensor(name="input_text", dtype=np.bytes_, shape=(1,)),
                Tensor(name="source_lang", dtype=np.bytes_, shape=(1,)),
                Tensor(name="target_lang", dtype=np.bytes_, shape=(1,)),
            ]
            + [
                Tensor(name=name, dtype=np.bytes_, shape=(1,), optional=True)
                for name in VARIANT_INPUTS
            ],
            outputs=[
                Tensor(name="translation", dtype=np.bytes_, shape=(1,)),
            ],
            config=ModelConfig(
                max_batch_size=4,
                batcher=DynamicBatcher(
                    max_queue_delay_microseconds=100,
                ),
                response_cache=True,
            ),
            strict=True,
        )
        # serve the model for inference
        triton.serve()


if __name__ == "__main__":
    main()
