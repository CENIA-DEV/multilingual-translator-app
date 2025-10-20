# server
import argparse
import logging

import numpy as np
from dotenv import load_dotenv
from pytriton.decorators import batch  # , first_value, group_by_values
from pytriton.model_config import DynamicBatcher, ModelConfig, Tensor
from pytriton.triton import Triton, TritonConfig, TritonLifecyclePolicy
from speech_models import MMSTTSWrapper  # Import the TTS wrapper

load_dotenv()


class _TTSInferFuncWrapper:
    """
    Class wrapper for TTS inference in Triton.
    """

    def __init__(self, tts_wrapper: MMSTTSWrapper, logger):
        self._tts_wrapper = tts_wrapper
        self._logger = logger

    @batch
    def __call__(self, **inputs) -> np.ndarray:
        """
        Main inference function for TTS.
        """
        texts, lang_codes = inputs.values()

        self._logger.debug(f"texts: {texts}")
        self._logger.debug(f"lang_codes: {lang_codes}")

        texts = [
            np.char.decode(t.astype("bytes"), "utf-8").item().replace("\\n", "\n")
            for t in texts
        ]
        lang_codes = [
            np.char.decode(lc.astype("bytes"), "utf-8").item() for lc in lang_codes
        ]

        self._logger.debug(f"Texts: {texts}")
        self._logger.debug(f"Lang codes: {lang_codes}")

        # For simplicity, assume batch size 1; process first item
        text = texts[0]
        lang_code = lang_codes[0]

        # Call TTS predict
        waveform = self._tts_wrapper.predict(text, lang_code)
        # Convert torch tensor to numpy
        waveform_np = waveform.cpu().numpy()

        return {"waveform": waveform_np}


def _tts_infer_function_factory(logger, gpu, model_base_path=None):
    """
    Factory for TTS inference function.
    """
    tts_wrapper = MMSTTSWrapper(logger, gpu, model_base_path)
    return _TTSInferFuncWrapper(tts_wrapper=tts_wrapper, logger=logger)


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
        "--max-new-tokens",
        type=int,
        default=256,
        help="Max new tokens to generate",
    )
    parser.add_argument(
        "--enable-tts",
        action="store_true",
        help="Enable TTS model binding",
        default=False,
    )
    parser.add_argument(
        "--model-base-path",
        default=None,
        help="Base path to the model directory in GCP bucket",
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
        http_port=args.port,
        exit_on_error=True,
        log_verbose=log_verbose,
        allow_http=True,
        cache_config=[f"local,size={10 * 1024 * 1024}"],
    )
    policy = TritonLifecyclePolicy(launch_triton_on_startup=False)

    with Triton(config=config, triton_lifecycle_policy=policy) as triton:

        tts_model_name = "tts-model"
        triton.bind(
            model_name=tts_model_name,
            infer_func=_tts_infer_function_factory(
                logger, args.gpu, args.model_base_path
            ),
            inputs=[
                Tensor(name="text", dtype=np.bytes_, shape=(1,)),
                Tensor(name="lang_code", dtype=np.bytes_, shape=(1,)),
            ],
            outputs=[
                Tensor(
                    name="waveform", dtype=np.float32, shape=(-1,)
                ),  # Variable length
            ],
            config=ModelConfig(
                max_batch_size=1,
                batcher=DynamicBatcher(
                    max_queue_delay_microseconds=100,
                ),
            ),
            strict=True,
        )

        triton.serve()


if __name__ == "__main__":
    main()
