import argparse
import os
from datetime import datetime

import numpy as np
import requests
import scipy.io.wavfile as wav


def text_to_speech(text, lang_code, url=""):
    """
    Send a request to the TTS endpoint and save the response as a WAV file.

    Args:
        text (str): Text to convert to speech
        lang_code (str): Language code (e.g., "es", "en", etc.)
        url (str): The TTS API endpoint URL

    Returns:
        str: Path to the saved WAV file
    """
    # Prepare the request payload according to PyTriton's expected format
    payload = {
        "inputs": [
            {
                "name": "text",
                "shape": [1, 1],  # [batch_size, dim]
                "datatype": "BYTES",
                "data": [text],
            },
            {
                "name": "lang_code",
                "shape": [1, 1],  # [batch_size, dim]
                "datatype": "BYTES",
                "data": [lang_code],
            },
        ]
    }

    # Send the request
    print(f"Sending request to {url} with text: '{text}' in language: '{lang_code}'")
    response = requests.post(url, json=payload)

    if response.status_code != 200:
        print(f"Error: {response.status_code}")
        print(f"Response: {response.text}")
        return None

    # Parse the response
    response_data = response.json()

    # Extract the waveform data
    waveform = np.array(response_data["outputs"][0]["data"], dtype=np.float32)

    # Create filename with timestamp to avoid overwriting
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = "audio_output"
    os.makedirs(output_dir, exist_ok=True)

    # Create a safe filename from the text (limit to first 20 chars)
    safe_text = "".join(c if c.isalnum() else "_" for c in text)[:20]
    filename = f"{output_dir}/tts_{lang_code}_{safe_text}_{timestamp}.wav"

    # Save as WAV file using the correct sample rate for MMS TTS models (16000 Hz)
    sample_rate = 16000  # Changed from 24000 Hz to 16000 Hz
    wav.write(filename, sample_rate, waveform)

    print(f"Audio saved to: {filename}")
    return filename


def main():
    parser = argparse.ArgumentParser(description="Test the TTS endpoint")
    parser.add_argument(
        "--text", type=str, required=True, help="Text to convert to speech"
    )
    parser.add_argument(
        "--lang", type=str, default="es", help="Language code (default: es)"
    )
    parser.add_argument("--url", type=str, default="", help="TTS API endpoint URL")

    args = parser.parse_args()

    text_to_speech(args.text, args.lang, args.url)


if __name__ == "__main__":
    main()
