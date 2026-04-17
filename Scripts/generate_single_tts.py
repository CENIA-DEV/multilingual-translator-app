import os

import scipy
from transformers import pipeline

ask_gender = input("Que genero quieres generar: (MASCULINO Ó FEMENINO): ")

while ask_gender.lower() not in ("femenino", "masculino"):
    print("INGRESASTE OTRA COSA!!")
    ask_gender = input("Que genero quieres generar: (MASCULINO Ó FEMENINO) ")

if ask_gender.lower() == "masculino":
    model_id = "voces-ai/rapanui-tts-male"
elif ask_gender.lower() == "femenino":
    model_id = "voces-ai/rapanui-tts-female"

synthesiser = pipeline("text-to-speech", model_id, device=-1)
# device=-1 si quieres usar CPU
# device=0 si quieres usar cuda

text = input("Ingresa el texto a transribir: ")
speech = synthesiser(text)

os.makedirs("generated_tts_audios", exist_ok=True)
output_path = os.path.join("generated_tts_audios", f"{text}.wav")
scipy.io.wavfile.write(
    output_path, rate=speech["sampling_rate"], data=speech["audio"][0]
)
