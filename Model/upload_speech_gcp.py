import os
import tempfile

from dotenv import load_dotenv
from google.cloud import storage
from tqdm import tqdm
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
nllb_language_token_map = {"mri_Latn": "rap", "spa_Latn": "spa", "eng_Latn": "eng"}


def get_model_name(lang):
    """Get the correct model name based on language code."""
    if lang == "rap":
        return "agustinghent/mms-tts-rap-train1_1"
    else:
        return f"facebook/mms-tts-{lang}"


def download_model(lang, temp_dir):
    """Download model and tokenizer from Hugging Face."""
    print(f"Downloading model for {lang}...")
    model_name = get_model_name(lang)

    # Create language directory
    lang_dir = os.path.join(temp_dir, lang)
    os.makedirs(lang_dir, exist_ok=True)

    # Download and save model and tokenizer
    model = VitsModel.from_pretrained(model_name, token=HF_TOKEN)
    tokenizer = AutoTokenizer.from_pretrained(model_name, token=HF_TOKEN)

    model.save_pretrained(lang_dir)
    tokenizer.save_pretrained(lang_dir)

    return lang_dir


def upload_to_gcp(local_dir, lang):
    """Upload model files to GCP bucket in the appropriate folder."""
    # Get all files in the directory
    files_to_upload = []
    for root, _, files in os.walk(local_dir):
        for file in files:
            local_path = os.path.join(root, file)
            # Calculate relative path for GCP
            rel_path = os.path.relpath(local_path, local_dir)
            gcp_path = f"{base_folder}/{lang}/{rel_path}"
            files_to_upload.append((local_path, gcp_path))

    # Upload files with progress bar
    for local_path, gcp_path in tqdm(files_to_upload, desc=f"Uploading {lang} model"):
        blob = bucket.blob(gcp_path)
        blob.upload_from_filename(local_path)
        print(f"Uploaded {local_path} to gs://{bucket_name}/{gcp_path}")


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
