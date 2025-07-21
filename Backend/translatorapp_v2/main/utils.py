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
import json
import logging
from datetime import datetime, timezone

import requests
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
