# Copyright 2024 Centro Nacional de Inteligencia Artificial (CENIA, Chile).
# All rights reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import hashlib
import io
import json
import logging

# import os
import re
from datetime import datetime, timezone
from pathlib import Path

import ffmpeg
import numpy as np
import requests
import soundfile as sf
from django.conf import settings
from django.core.mail import EmailMultiAlternatives, send_mail
from django.template.loader import render_to_string
from django.utils.html import strip_tags

logger = logging.getLogger(__name__)


def filter_cache(src_lang, dst_lang, cache_results):
    # standarized_query = standarize_text(user_query) NOT SURE WHY THIS IS NECESSARY
    # verify if match is correct
    for result in cache_results:  # from newest to oldest
        # check match in user requested source lang to avoid duplicates
        if (
            src_lang.code == result.src_lang.code
            or src_lang.code == result.dst_lang.code
        ):
            # the user requested dst text language guides the translation
            if dst_lang.code == result.dst_lang.code:
                return result.dst_text, result.dst_lang
            else:
                return result.src_text, result.src_lang
        else:
            continue

    return None, None


def generate_payload(text, source_lang, target_lang):
    payload = {
        "id": "0",
        "inputs": [
            {
                "name": "input_text",
                "shape": [1, 1],
                "datatype": "BYTES",
                "data": [[text]],
            },
            {
                "name": "source_lang",
                "shape": [1, 1],
                "datatype": "BYTES",
                "data": [[source_lang]],
            },
            {
                "name": "target_lang",
                "shape": [1, 1],
                "datatype": "BYTES",
                "data": [[target_lang]],
            },
        ],
    }
    return payload


def get_prediction(src_text, src_lang, dst_lang, deployment):
    payload = generate_payload(src_text, src_lang, dst_lang)
    response = requests.post(url=deployment, data=json.dumps(payload))
    response = response.json()

    # Process the response
    if "outputs" in response:
        logger.debug(
            f"Model prediction successful: {response['outputs'][0]['data'][0]}"
        )
        return (
            response["outputs"][0]["data"][0],
            response["model_name"],
            response["model_version"],
        )
    elif "error" in response:
        logger.error(f"Error in model prediction: {response['error']}")
        raise Exception("Error in model prediction")
    else:
        logger.error("API responded with status code", response.status_code)
        raise Exception("Error in model prediction")


def translate(src_text, src_lang, dst_lang):

    native_deployment = (
        f"{settings.APP_SETTINGS.inference_model_url}/v2/models/"
        f"{settings.APP_SETTINGS.inference_model_name}/infer"
    )
    raw_deployment = (
        f"{settings.APP_SETTINGS.raw_inference_model_url}/v2/models/"
        f"{settings.APP_SETTINGS.raw_inference_model_name}/infer"
    )

    logger.debug(f"Translating {src_text} from {src_lang.code} to {dst_lang.code}")
    src_text_paragraphs = src_text.split("\n")
    logger.debug(f"Src text paragraphs: {src_text_paragraphs}")
    logger.debug(f"Native deployment: {native_deployment}")
    logger.debug(f"Raw deployment: {raw_deployment}")
    if src_lang.is_native and dst_lang.code != "spa_Latn":
        try:
            first_translation, model_name, model_version = get_prediction(
                src_text,
                src_lang=src_lang.code,
                dst_lang="spa_Latn",
                deployment=native_deployment,
            )
            paragraphs = first_translation.split("\n")
            logger.debug(f"Translation paragraphs: {paragraphs}")
        except Exception as e:
            raise e
        try:
            final_translation, model_name, model_version = get_prediction(
                first_translation,
                src_lang="spa_Latn",
                dst_lang=dst_lang.code,
                deployment=raw_deployment,
            )
        except Exception as e:
            raise e
        logger.debug(
            f"spa_Latn - {first_translation} -> {dst_lang.code} - {final_translation} "
        )
        paragraphs = final_translation.split("\n")
        logger.debug(f"Translation paragraphs: {paragraphs}")
        return {
            "dst_text": final_translation,
            "model_name": model_name,
            "model_version": model_version,
        }

    elif src_lang.code != "spa_Latn" and dst_lang.is_native:
        try:
            logger.debug(f"src_lang: {src_lang.code}")
            first_translation, model_name, model_version = get_prediction(
                src_text,
                src_lang=src_lang.code,
                dst_lang="spa_Latn",
                deployment=raw_deployment,
            )
            logger.debug(
                f"{src_lang.code} - {src_text} -> spa_Latn - {first_translation} "
            )
            paragraphs = first_translation.split("\n")
            logger.debug(f"Translation paragraphs: {paragraphs}")
        except Exception as e:
            raise e
        try:
            final_translation, model_name, model_version = get_prediction(
                first_translation,
                src_lang="spa_Latn",
                dst_lang=dst_lang.code,
                deployment=native_deployment,
            )
            logger.debug(
                f"spa_Latn - {first_translation} -> {dst_lang.code}-{final_translation}"
            )
            paragraphs = final_translation.split("\n")
            logger.debug(f"Translation paragraphs: {paragraphs}")
        except Exception as e:
            raise e
        return {
            "dst_text": final_translation,
            "model_name": model_name,
            "model_version": model_version,
        }

    elif not src_lang.is_native and not dst_lang.is_native:
        try:
            translation, model_name, model_version = get_prediction(
                src_text, src_lang.code, dst_lang.code, deployment=raw_deployment
            )
            logger.debug(
                f"{src_lang.code} - {src_text} -> {dst_lang.code} - {translation} "
            )
            paragraphs = translation.split("\n")
            logger.debug(f"Translation paragraphs: {paragraphs}")
        except Exception as e:
            raise e
        return {
            "dst_text": translation,
            "model_name": model_name,
            "model_version": model_version,
        }

    # src lang or dst lang is native/spanish
    else:
        try:
            translation, model_name, model_version = get_prediction(
                src_text, src_lang.code, dst_lang.code, deployment=native_deployment
            )
            logger.debug(
                f"{src_lang.code} - {src_text} -> {dst_lang.code} - {translation} "
            )
            paragraphs = translation.split("\n")
            logger.debug(f"Translation paragraphs: {paragraphs}")
        except Exception as e:
            raise e
        return {
            "dst_text": translation,
            "model_name": model_name,
            "model_version": model_version,
        }


def get_tts_prediction(text, lang_code, deployment):
    """
    Send request to TTS model server and get audio waveform.
    """
    payload = {
        "id": "0",
        "inputs": [
            {
                "name": "text",
                "shape": [1, 1],
                "datatype": "BYTES",
                "data": [[text]],
            },
            {
                "name": "lang_code",
                "shape": [1, 1],
                "datatype": "BYTES",
                "data": [[lang_code]],
            },
        ],
    }

    response = requests.post(url=deployment, data=json.dumps(payload))
    response = response.json()

    # Process the response
    if "outputs" in response:
        logger.debug("TTS generation successful")
        return (
            response["outputs"][0]["data"],  # waveform data
            response["model_name"],
            response["model_version"],
        )
    elif "error" in response:
        logger.error(f"Error in TTS generation: {response['error']}")
        raise Exception("Error in TTS generation")
    else:
        logger.error("TTS API responded with unexpected format")
        raise Exception("Error in TTS generation")


def generate_tts(src_text, src_lang):
    """
    Generate text-to-speech audio.
    """
    # Handle both Lang objects and string language codes
    lang_code = src_lang
    if hasattr(src_lang, "code"):
        lang_code = src_lang.code

    native_deployment = (
        f"{settings.APP_SETTINGS.inference_tts_model_url}/v2/models/"
        f"{settings.APP_SETTINGS.inference_tts_model_name}/infer"
    )

    raw_deployment = (
        f"{settings.APP_SETTINGS.raw_inference_tts_model_url}/v2/models/"
        f"{settings.APP_SETTINGS.raw_inference_tts_model_name}/infer"
    )

    logger.debug(f"Generating audio from {src_text}")
    src_text_paragraphs = src_text.split("\n")
    logger.debug(f"Src text paragraphs: {src_text_paragraphs}")
    logger.debug(f"Native deployment: {native_deployment}")
    logger.debug(f"Raw deployment: {raw_deployment}")

    deployment = raw_deployment

    try:
        # Pass the lang_code directly instead of trying to access .code
        waveform_data, model_name, model_version = get_tts_prediction(
            src_text, lang_code, deployment=deployment  # Pass the code string directly
        )
        logger.debug(f"Successfully generated audio for text in {lang_code}")

        return {
            "waveform": waveform_data,
            "model_name": model_name,
            "model_version": model_version,
        }

    except Exception as e:
        logger.error(f"Failed to generate speech: {str(e)}")
        raise e


def get_asr_prediction(audio_data, sampling_rate, lang_code, deployment):

    audio_samples = audio_data.astype(np.float32).tolist()

    payload = {
        "id": "0",
        "inputs": [
            {
                "name": "audio",
                "shape": [1, len(audio_samples)],
                "datatype": "FP32",
                "data": [audio_samples],
            },
            {
                "name": "sampling_rate",
                "shape": [1, 1],
                "datatype": "INT32",
                "data": [[sampling_rate]],
            },
            {
                "name": "lang_code",
                "shape": [1, 1],
                "datatype": "BYTES",
                "data": [[lang_code]],
            },
        ],
    }

    logger.debug(f"Sending ASR request to {deployment}")
    response = requests.post(url=deployment, data=json.dumps(payload))
    response = response.json()

    # Process the response
    if "outputs" in response:
        logger.debug("ASR transcription successful")
        # Extract the transcribed text from the response
        transcribed_text = response["outputs"][0]["data"][0]
        return (
            transcribed_text,
            response["model_name"],
            response["model_version"],
        )
    elif "error" in response:
        logger.error(f"Error in ASR transcription: {response['error']}")
        raise Exception("Error in ASR transcription")
    else:
        logger.error("ASR API responded with unexpected format")
        raise Exception("Error in ASR transcription")


def _sniff_container(b: bytes) -> str | None:
    try:
        if b.startswith(b"OggS"):
            return "ogg"
        if b.startswith(b"\x1aE\xdf\xa3") or b[0:64].find(b"webm") != -1:
            return "webm"
        if b.startswith(b"RIFF") and b[8:12] == b"WAVE":
            return "wav"
        # naive MP4/ISOBMFF check
        if b[4:8] == b"ftyp":
            return "mp4"
    except Exception:
        pass
    return None


# Add small helpers for debug saving
def _asr_debug_dir() -> Path:
    base = (
        getattr(settings, "ASR_DEBUG_DIR", None)
        or getattr(settings, "MEDIA_ROOT", None)
        or "/tmp"
    )
    p = Path(base) / "asr_debug"
    p.mkdir(parents=True, exist_ok=True)
    return p


def _slug(s: str) -> str:
    return re.sub(r"[^A-Za-z0-9_.-]+", "-", str(s))


def generate_asr(audio_file, lang):
    lang_code = getattr(lang, "code", lang)
    base_url = settings.APP_SETTINGS.inference_asr_model_url
    model_name = settings.APP_SETTINGS.inference_asr_model_name
    raw_deployment = f"{base_url}/v2/models/{model_name}/infer"
    logger.debug(f"Generating ASR transcription for language: {lang_code}")

    try:
        # Read input bytes
        audio_bytes = audio_file.read() if hasattr(audio_file, "read") else audio_file
        if not isinstance(audio_bytes, bytes):
            raise TypeError("audio_file must be bytes or a file-like object")

        logger.debug(f"Received audio bytes: {len(audio_bytes)}")
        container = _sniff_container(audio_bytes)
        logger.debug(f"Detected container: {container}")

        # Convert to WAV 16kHz mono using ffmpeg
        try:
            inp = ffmpeg.input(
                "pipe:0",
                **({"f": container} if container in ("webm", "ogg", "mp4") else {}),
            )
            out = ffmpeg.output(
                inp,
                "pipe:1",
                ar=16000,
                ac=1,
                format="wav",
                acodec="pcm_s16le",
                # Add these options to preserve audio start
                **{
                    "af": "apad=pad_dur=0.1",  # Add 100ms padding at start
                    "analyzeduration": "10M",  # Increase analysis duration
                    "probesize": "10M",  # Increase probe size
                },
            )
            wav_bytes, ff_err = ffmpeg.run(
                out,
                input=audio_bytes,
                capture_stdout=True,
                capture_stderr=True,
                quiet=True,
            )
            if not wav_bytes:
                logger.error(f"error{ff_err.decode(errors='ignore') if ff_err else ''}")
                raise Exception("Empty WAV after ffmpeg conversion")
        except Exception as e:
            logger.error(f"FFmpeg conversion failed: {str(e)}")
            raise

        # Load PCM samples
        samples, sample_rate = sf.read(io.BytesIO(wav_bytes), dtype="float32")
        if samples is None or (hasattr(samples, "size") and samples.size == 0):
            raise Exception("Decoded audio has zero length")

        # Downmix to mono if needed
        if hasattr(samples, "ndim") and samples.ndim > 1:
            logger.debug(f"Downmixing from shape {samples.shape} to mono")
            samples = samples.mean(axis=1)

        """
         # Save quick metadata
        try:
            stats = {
                "num_bytes_in": len(audio_bytes),
                "container": container,
                "wav_bytes": len(wav_bytes),
                "shape": list(samples.shape) if hasattr(samples, "shape") else None,
                "sr": int(sample_rate),
                "min": float(np.min(samples)) if getattr(samples, "size", 0) else None,
                "max": float(np.max(samples)) if getattr(samples, "size", 0) else None,
                "rms": (
                    float(np.sqrt(np.mean(samples**2)))
                    if getattr(samples, "size", 0)
                    else None
                ),
                "ffmpeg_stderr_tail": (
                    ff_err.decode(errors="ignore")[-1024:] if ff_err else None
                ),
            }
            meta_path = dbg_dir / f"{ts}_{lang_slug}_meta.json"
            meta_path.write_text(json.dumps(stats, ensure_ascii=False, indent=2))
            logger.debug(f"Saved ASR debug metadata to {meta_path}")
        except Exception as e:
            logger.warning(f"Failed saving ASR debug : {e}")
        logger.debug(
            f"Prepared sampl: shape={getattr(samples, 'shape', None)}, sr={sample_rate}"
        )
        """

        # Predict ASR
        transcribed_text, model_name, model_version = get_asr_prediction(
            samples, 16000, lang_code, deployment=raw_deployment
        )

        return {
            "text": transcribed_text,
            "model_name": model_name,
            "model_version": model_version,
        }

    except Exception as e:
        logger.error(f"Failed to transcribe speech: {str(e)}")
        raise


def convert_timestamp(timestamp_str):
    if timestamp_str is None:
        return None
    if "." in timestamp_str:
        dt = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
    else:
        dt = datetime.fromisoformat(timestamp_str.replace("Z", "")).replace(
            tzinfo=timezone.utc
        )
    return dt


def send_invite_email(invited_by_user, user_email, invitation_token):
    invitation_link = (
        f"{settings.APP_SETTINGS.frontend_url}/invitation/{invitation_token}"
    )

    invited_by = invited_by_user.get_full_name().strip()
    if len(invited_by) == 0:
        invited_by = invited_by_user.email.lower().strip()

    email_without_domain = user_email.partition("@")[0].strip()
    name = email_without_domain[0].upper() + email_without_domain[1:]
    lang_name = "Rapa Nui" if settings.VARIANT == "rap" else "Mapuzungun"
    # Define the context variables
    context = {
        "name": name,
        "lang_name": lang_name,
        "invite_sender_name": invited_by,
        "support_email": settings.SUPPORT_EMAIL,
        "guide_url": settings.INVITATION_GUIDE_URL,
        "action_url": invitation_link,
        "year": datetime.now().year,
    }

    # Render the template with the context
    html_content = render_to_string("invitation_template.html", context)
    text_content = strip_tags(html_content)  # Convert HTML to plain text
    subject = f"{invited_by} te ha invitado a usar el \
                sistema de traducción automática {lang_name} - Español"
    from_email = None  # will be loaded from the environment varible

    # Create the email
    email = EmailMultiAlternatives(subject, text_content, from_email, [user_email])
    email.attach_alternative(html_content, "text/html")

    # Send the email
    email.send()


def send_recovery_email(user_email, raw_token):
    reset_password_link = (
        f"{settings.APP_SETTINGS.frontend_url}/reset-password/{raw_token}"
    )
    message = (
        f"Haga click en el link para restablecer su contraseña: {reset_password_link}"
    )
    send_mail(
        subject="Restablecer Contraseña Plataforma Traducción",
        message=message,
        from_email=None,  # Your configured alias
        recipient_list=[user_email],
        fail_silently=False,
    )


def send_participate_email(email, organization, reason, first_name, last_name):
    message = (
        f"{first_name} {last_name} con email {email} ha solicitado participar "
        f"en el proyecto con la organización "
        f"{organization if organization is not None else '(No se proporcionó)'} "
        f"y el motivo: {reason}"
    )
    send_mail(
        subject="Solicitud de participación en el proyecto",
        message=message,
        from_email=None,
        recipient_list=[settings.SUPPORT_EMAIL],
        fail_silently=False,
    )


def get_hashed_token(token):
    # Get the associated Invitation Token
    hash_object = hashlib.sha256()
    hash_object.update(token.encode("utf-8"))
    hashed_token = hash_object.hexdigest()
    return hashed_token
