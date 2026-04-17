import datetime
import os
import queue
import sys

import numpy as np
import scipy.io.wavfile
import sounddevice as sd

OUTPUT_DIR = "recorded_audios"
SAMPLE_RATE = 22050

os.makedirs(OUTPUT_DIR, exist_ok=True)


def record_audio(file_path):
    q = queue.Queue()

    def callback(indata, frames, time, status):
        if status:
            print(status, file=sys.stderr)
        q.put(indata.copy())

    print(f"\nPress Enter to start recording '{os.path.basename(file_path)}'...")
    input()
    print("Recording... Press Enter to stop.")

    with sd.InputStream(
        samplerate=SAMPLE_RATE, channels=1, dtype="float32", callback=callback
    ):
        input()

    print("Recording stopped.")

    audio_data = []
    while not q.empty():
        audio_data.append(q.get())

    audio = (
        np.concatenate(audio_data, axis=0)
        if audio_data
        else np.zeros((0, 1), dtype=np.float32)
    )

    scipy.io.wavfile.write(file_path, SAMPLE_RATE, audio)
    print(f"Recorded audio saved: {file_path}")


def main():
    print(f"Saving recordings to {OUTPUT_DIR}/")
    print("Press Ctrl+C whenever you want to stop and exit the script.")

    count = 1
    try:
        while True:
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            file_name = f"recording_{count}_{timestamp}.wav"
            out_path = os.path.join(OUTPUT_DIR, file_name)
            record_audio(out_path)
            count += 1
    except KeyboardInterrupt:
        print("\nExiting recording loop. Goodbye!")


if __name__ == "__main__":
    main()
