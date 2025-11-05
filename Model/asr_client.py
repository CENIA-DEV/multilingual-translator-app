import argparse
import logging
import os
import sys

import librosa  # Import librosa
import numpy as np
import soundfile as sf
from tritonclient.http import InferenceServerClient, InferInput, InferRequestedOutput


def load_audio(audio_path, target_sr=16000):
    """Load audio file, resample to target_sr, and return samples with sampling rate."""
    logging.info(f"Loading audio from {audio_path}")
    samples, sample_rate = sf.read(audio_path)

    # Convert to mono if stereo
    if len(samples.shape) > 1:
        samples = samples.mean(axis=1)

    # Resample if necessary
    if sample_rate != target_sr:
        logging.info(f"Resampling audio from {sample_rate} Hz to {target_sr} Hz")
        samples = librosa.resample(y=samples, orig_sr=sample_rate, target_sr=target_sr)
        sample_rate = target_sr

    # Ensure we have float32
    samples = samples.astype(np.float32)

    return samples, sample_rate


def send_audio_to_server(client, audio, sample_rate, lang_code, model_name):
    """Send audio to Triton server for ASR."""
    logging.info(f"Sending audio to server for language: {lang_code}")

    # Audio input - shape [1, N] (batch dimension required)
    audio_input = InferInput("audio", [1, audio.shape[0]], "FP32")
    audio_input.set_data_from_numpy(np.expand_dims(audio, axis=0))

    # Sampling rate input - shape [1, 1] (batch dimension required)
    sr_input = InferInput("sampling_rate", [1, 1], "INT32")
    sr_input.set_data_from_numpy(np.array([[sample_rate]], dtype=np.int32))

    # Language code input - shape [1, 1] (batch dimension required)
    # Correctly prepare the BYTES tensor
    lang_bytes = np.array([lang_code.encode("utf-8")], dtype=np.object_).reshape((1, 1))
    lang_input = InferInput("lang_code", [1, 1], "BYTES")
    lang_input.set_data_from_numpy(lang_bytes)

    response = client.infer(
        model_name=model_name,
        inputs=[audio_input, sr_input, lang_input],
        outputs=[InferRequestedOutput("text")],
    )

    # Add a check for the response
    text_output = response.as_numpy("text")
    if text_output is None:
        logging.error("Server did not return 'text' output.")
        return "[Inference Error]"

    text_bytes = text_output[0]
    text = text_bytes.decode("utf-8")

    return text


def main():
    parser = argparse.ArgumentParser(description="ASR Client for Testing")
    parser.add_argument("--audio", required=True, help="Path to audio file")
    parser.add_argument(
        "--url",
        default="asr-rap-staging-418141416904.us-central1.run.app",
        help="Inference server URL",
    )
    parser.add_argument(
        "--lang",
        default="rap_Latn",
        help="Language code (rap_Latn, spa_Latn, eng_Latn)",
    )
    parser.add_argument(
        "--model", default="asr-model", help="Model name in Triton server"
    )
    parser.add_argument(
        "--verbose", "-v", action="store_true", help="Enable verbose logging"
    )
    args = parser.parse_args()

    # Setup logging
    log_level = logging.INFO if not args.verbose else logging.DEBUG
    logging.basicConfig(
        level=log_level, format="%(asctime)s - %(levelname)s - %(message)s"
    )

    # Validate audio file
    if not os.path.exists(args.audio):
        logging.error(f"Audio file not found: {args.audio}")
        sys.exit(1)

    # Validate language code
    valid_langs = ["rap_Latn", "spa_Latn", "eng_Latn"]
    if args.lang not in valid_langs:
        logging.error(f"Invalid language code. Choose from: {', '.join(valid_langs)}")
        sys.exit(1)

    try:
        # Load and resample audio
        audio, sample_rate = load_audio(args.audio)
        logging.info(f"Loaded audio: {len(audio)} samples, {sample_rate} Hz")

        # Create client
        logging.info(f"Connecting to Triton server at {args.url}")
        # Enable SSL for HTTPS URLs
        use_ssl = args.url.endswith("run.app") or args.url.startswith("https")
        if use_ssl:
            logging.info("Using SSL for connection.")
        client = InferenceServerClient(args.url, ssl=use_ssl)

        # Check server readiness
        if not client.is_server_ready():
            logging.error("Server is not ready")
            sys.exit(1)

        # Check if model is ready
        if not client.is_model_ready(args.model):
            logging.error(f"Model {args.model} is not ready")
            sys.exit(1)

        # Send request and get transcription
        transcription = send_audio_to_server(
            client, audio, sample_rate, args.lang, args.model
        )

        # Print result
        print("\n" + "=" * 60)
        print(f"Language: {args.lang}")
        print(f"Transcription: {transcription}")
        print("=" * 60 + "\n")

    except Exception as e:
        logging.error(f"Error: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    main()
