import os
import tempfile

import torch
from dotenv import load_dotenv
from google.cloud import storage
from google.cloud.storage import transfer_manager
from transformers import AutoTokenizer, VitsModel

load_dotenv()
HF_TOKEN = os.getenv("HF_TOKEN")
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "key.json"
storage_client = storage.Client()

# GCP bucket settings
bucket_name = "models-traductor"
base_folder = "tts-rap"
bucket = storage_client.bucket(bucket_name)

# Language mappings from speech_models.py
nllb_language_token_map = {
    "mri_Latn_female": "rap/female",
    "mri_Latn_male": "rap/male",
    "spa_Latn": "spa",
    "eng_Latn": "eng",
}


def get_model_name(lang):
    """Get the correct model name based on language code."""
    if lang == "rap/female":
        return "voces-ai/rapanui-tts-female"
    elif lang == "rap/male":
        return "voces-ai/rapanui-tts-male"
    else:
        return f"facebook/mms-tts-{lang}"


def download_model(lang, temp_dir):
    """Download model and tokenizer from Hugging Face."""
    print(f"Downloading model for {lang} in bf16...")
    model_name = get_model_name(lang)

    # Create language directory
    lang_dir = os.path.join(temp_dir, lang)
    os.makedirs(lang_dir, exist_ok=True)

    # Download and save model and tokenizer
    # Using safe_serialization=True for faster loading and security
    # Loading in bfloat16 for L40 GPU optimization
    model = VitsModel.from_pretrained(
        model_name, token=HF_TOKEN, torch_dtype=torch.bfloat16
    )
    tokenizer = AutoTokenizer.from_pretrained(model_name, token=HF_TOKEN)

    print(f"Saving model to {lang_dir} with safetensors (bf16)...")
    model.save_pretrained(lang_dir, safe_serialization=True)
    tokenizer.save_pretrained(lang_dir)

    return lang_dir


def upload_to_gcp(local_dir, lang):
    """Upload model files to GCP bucket in parallel using transfer_manager."""
    files_to_upload = []
    base_path = local_dir

    for root, _, files in os.walk(local_dir):
        for file in files:
            local_path = os.path.join(root, file)
            rel_path = os.path.relpath(local_path, base_path)
            files_to_upload.append(rel_path)

    print(f"Uploading {len(files_to_upload)} files for {lang} in parallel...")

    # Use transfer_manager for parallel uploads
    results = transfer_manager.upload_many_from_filenames(
        bucket,
        files_to_upload,
        source_directory=local_dir,
        blob_name_prefix=f"{base_folder}/{lang}/",
        max_workers=8,
    )

    for i, result in enumerate(results):
        if isinstance(result, Exception):
            print(f"Failed to upload {files_to_upload[i]}: {result}")
        else:
            pass  # Success

    print(f"Completed parallel upload for {lang}")


def main():
    # Create temporary directory
    with tempfile.TemporaryDirectory() as temp_dir:
        print(f"Created temporary directory: {temp_dir}")

        # Process each language
        for lang_code, lang in nllb_language_token_map.items():
            print(f"Processing language: {lang_code} ({lang})")

            # Download model
            local_dir = download_model(lang, temp_dir)

            # Upload to GCP
            upload_to_gcp(local_dir, lang)

            print(f"Completed upload for {lang}")

        print("All models uploaded successfully")


if __name__ == "__main__":
    main()
