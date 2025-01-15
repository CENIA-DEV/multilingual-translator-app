# server
import argparse
import logging

import numpy as np
from dotenv import load_dotenv
from model import ModelWrapper
from pytriton.decorators import batch, first_value, group_by_values
from pytriton.model_config import DynamicBatcher, ModelConfig, Tensor
from pytriton.triton import Triton, TritonConfig, TritonLifecyclePolicy

load_dotenv()


class _InferFuncWrapper:
    """
    Class wrapper of inference func for triton. Used to also store the model variable
    """

    def __init__(self, model: ModelWrapper, logger):
        self._model = model
        self._logger = logger

    @batch
    @group_by_values("source_lang")
    @group_by_values("target_lang")
    @first_value("source_lang")
    @first_value("target_lang")
    def __call__(self, **inputs) -> np.ndarray:
        """
        Main inference function for triton backend. Called after batch inference.
        Performs all the logic of decoding inputs, calling the model and returning
        outputs.

        Args:
            prompts: Batch of strings with the user prompts
            init_images: Batch of initial image to run the diffusion

        Returns
            image: Batch of generated images
        """
        texts, source_lang, target_lang = inputs.values()
        # For now, we only support batch size 1

        self._logger.debug(f"texts: {texts}")
        self._logger.debug(f"source_lang: {source_lang}")
        self._logger.debug(f"target_lang: {target_lang}")

        texts = [np.char.decode(t.astype("bytes"), "utf-8").item() for t in texts]
        source_lang = bytes(source_lang).decode("utf-8")
        target_lang = bytes(target_lang).decode("utf-8")

        self._logger.debug(f"Texts: {texts}")
        self._logger.debug(f"Source lang: {source_lang}")
        self._logger.debug(f"Target lang: {target_lang}")
        # call model
        translations = self._model.predict(texts, source_lang, target_lang)
        translations = np.char.encode(translations, "utf-8")
        translations = np.expand_dims(translations, axis=1)

        return {"translation": translations}


def _infer_function_factory(num_copies, logger, folder_path, optimize):
    infer_fns = []
    for _ in range(num_copies):
        logger.info(f"Loading model at {folder_path}")
        # TO DO: CHECK IF MODEL NAME IN FOLDER PATH
        model = ModelWrapper(folder_path, logger=logger, optimize=optimize)
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

    parser.add_argument("--optimize", action="store_true", help="Optimize model.")

    parser.add_argument(
        "--copies",
        type=int,
        default=1,
        required=False,
        help="Number of copies of the model.",
    )
    
    parser.add_argument(
        "--gpu",
        "-g",
        action="store_true",
        help="If use GPU",
        default=True,
    )

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
        http_port=8015,
        exit_on_error=True,
        log_verbose=log_verbose,
        allow_http=True,
        cache_config=[f"local,size={10 *1024 * 1024}"],
    )
    policy = TritonLifecyclePolicy(launch_triton_on_startup=False)
    with Triton(config=config, triton_lifecycle_policy=policy) as triton:
        # bind the model with its inference call and configuration
        triton.bind(
            model_name=model_name.replace("/", "--"),
            infer_func=_infer_function_factory(
                num_copies=args.copies,
                logger=logger,
                folder_path=model_name,
                optimize=args.optimize,
                gpu=args.gpu,
            ),
            inputs=[
                Tensor(name="input_text", dtype=np.bytes_, shape=(1,)),
                Tensor(name="source_lang", dtype=np.bytes_, shape=(1,)),
                Tensor(name="target_lang", dtype=np.bytes_, shape=(1,)),
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
