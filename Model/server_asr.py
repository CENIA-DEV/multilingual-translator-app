# server for ASR
import argparse
import logging
import os

import numpy as np
from asr_models import HybridASRWrapper, MMSASRWrapper
from pytriton.decorators import batch
from pytriton.model_config import DynamicBatcher, ModelConfig, Tensor
from pytriton.triton import Triton, TritonConfig


class _ASRInferFuncWrapper:
    """
    Class wrapper for ASR inference in Triton.
    """

    def __init__(self, asr_wrapper, logger):
        self._asr_wrapper = asr_wrapper
        self._logger = logger

    @batch
    def __call__(self, **inputs) -> dict:
        """Main inference function for ASR."""
        # The @batch decorator provides inputs as numpy arrays with a batch dimension.
        audio_arrays, sampling_rates, lang_codes = inputs.values()

        batch_size = audio_arrays.shape[0]
        transcribed_texts = []

        for i in range(batch_size):
            # Extract single item from the batch
            audio = audio_arrays[i]  # Shape: (num_samples,)
            # Correctly index the single value from the (1,) shaped array
            sampling_rate = int(sampling_rates[i, 0])
            lang_code = lang_codes[i, 0].decode("utf-8")

            self._logger.debug(
                f" {audio.shape}, sampling rate {sampling_rate}, language {lang_code}"
            )

            # Call ASR predict
            transcription = self._asr_wrapper.predict(audio, sampling_rate, lang_code)
            transcribed_texts.append(transcription)

        # Return batch of results
        # The output tensor shape is (-1,), so we need a flat array of bytes.
        return {
            "text": np.array(
                [s.encode("utf-8") for s in transcribed_texts], dtype=np.object_
            )
        }


def _asr_infer_function_factory(num_copies, logger, asr_wrapper):
    """
    Factory for ASR inference function, supporting multiple copies.
    It uses a pre-initialized asr_wrapper.
    """
    infer_fns = []
    for i in range(num_copies):
        logger.info(f"Creating inference function copy {i+1}/{num_copies}")
        infer_fns.append(_ASRInferFuncWrapper(asr_wrapper=asr_wrapper, logger=logger))

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
        "--gpu",
        "-g",
        action="store_true",
        help="Use GPU if available",
        default=False,
    )

    parser.add_argument(
        "--port",
        "-p",
        type=int,
        default=8017,
        help="Port to use",
    )

    parser.add_argument(
        "--model-base-path",
        default=None,
        help="Base path to the model directory",
    )

    parser.add_argument(
        "--model-type",
        choices=["mms", "hybrid"],
        default="mms",
        help="Type of ASR model to use (mms or hybrid)",
    )

    parser.add_argument(
        "--rap-model-path",
        default=None,
        help="Path to specialized Rapa Nui model (for hybrid model type)",
    )

    parser.add_argument(
        "--rap-vocab-path",
        default=None,
        help="Path to Rapa Nui vocabulary file (for hybrid model type)",
    )

    parser.add_argument(
        "--copies",
        type=int,
        default=1,
        required=False,
        help="Number of copies of the model to load",
    )

    parser.add_argument(
        "--whisper-model-path",
        default=None,
        help="Path to specialized Whisper model (for hybrid model type)",
    )

    parser.add_argument(
        "--base-feature-extractor-path",
        default="facebook/mms-1b-all",  # Default to old behavior if not provided
        help="Path to the base feature extractor (e.g., mms-1b-all)",
    )

    return parser.parse_args()


def main():
    args = _parse_args()
    log_level = logging.DEBUG if args.verbose else logging.INFO
    logger = logging.getLogger("ASR_Triton_Server")
    logging.basicConfig(
        level=log_level, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )

    model_name = args.model_name or "asr-model"

    # Get Hugging Face token from environment (now coming from Docker build arg)
    hf_token = os.getenv("HUGGING_FACE_HUB_TOKEN")
    if not hf_token:
        logger.warning("HUGGING_FACE_HUB_TOKEN environment variable not set")

    # Instantiate the appropriate ASR wrapper based on model_type
    logger.info(f"Loading {args.model_type} ASR model...")
    if args.model_type == "mms":
        asr_wrapper = MMSASRWrapper(
            logger=logger,
            gpu=args.gpu,
            model_base_path=args.model_base_path,
        )
    elif args.model_type == "hybrid":
        asr_wrapper = HybridASRWrapper(
            logger=logger,
            gpu=args.gpu,
            rap_model_path=args.rap_model_path,
            rap_vocab_path=args.rap_vocab_path,
            hf_token=hf_token,
            whisper_model_path=args.whisper_model_path,
            base_checkpoint=args.base_feature_extractor_path,
        )
    else:
        raise ValueError(f"Invalid model type: {args.model_type}")
    logger.info("ASR model loaded successfully!")

    # Create inference functions from the single loaded wrapper
    infer_fns = _asr_infer_function_factory(
        num_copies=args.copies, logger=logger, asr_wrapper=asr_wrapper
    )

    config = TritonConfig(
        http_port=args.port,
        exit_on_error=True,
        log_verbose=1 if args.verbose else 0,
        allow_http=True,
        cache_config=[f"local,size={10 * 1024 * 1024}"],
    )

    with Triton(config=config) as triton:
        logger.info(f"Binding model '{model_name}' to Triton server...")

        triton.bind(
            model_name=model_name,
            infer_func=infer_fns,
            inputs=[
                # Use (-1,) for variable-length inputs with batch dimension implicit
                Tensor(name="audio", dtype=np.float32, shape=(-1,)),
                Tensor(name="sampling_rate", dtype=np.int32, shape=(-1,)),
                Tensor(name="lang_code", dtype=np.bytes_, shape=(-1,)),
            ],
            outputs=[
                Tensor(name="text", dtype=np.bytes_, shape=(-1,)),
            ],
            config=ModelConfig(
                max_batch_size=4,
                batcher=DynamicBatcher(max_queue_delay_microseconds=100),
            ),
        )
        logger.info("Model bound successfully. Starting server...")
        triton.serve()


if __name__ == "__main__":
    main()
