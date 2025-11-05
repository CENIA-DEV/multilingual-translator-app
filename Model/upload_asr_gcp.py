import argparse
import os
import sys
import tempfile

from dotenv import load_dotenv
from google.cloud import storage
from tqdm import tqdm
from transformers import WhisperForConditionalGeneration, WhisperProcessor

print("=== Script starting ===")
print(f"Current working directory: {os.getcwd()}")

# Load environment variables and set up GCP authentication
print("Loading environment variables...")
load_dotenv()
HF_TOKEN = os.getenv("HUGGING_FACE_HUB_TOKEN") or os.getenv("HF_TOKEN")
print(f"HF_TOKEN exists: {bool(HF_TOKEN)}")

# Check credentials file
credentials_file = (
    "/workspace1/aghents/traductor/web2/multilingual-translator-app/Model/key.json"
)
if not os.path.exists(credentials_file):
    print(f"ERROR: GCP credentials file '{credentials_file}' not found!")
    sys.exit(1)

print(f"Setting GOOGLE_APPLICATION_CREDENTIALS to: {credentials_file}")
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = credentials_file

try:
    print("Creating storage client...")
    storage_client = storage.Client()
    print(f"Storage client created successfully: {storage_client}")
except Exception as e:
    print(f"ERROR creating storage client: {str(e)}")
    sys.exit(1)

# GCP bucket settings
bucket_name = "models-traductor"
base_folder = "asr-rap"
print(f"Attempting to access bucket: {bucket_name}")
try:
    bucket = storage_client.bucket(bucket_name)
    # Check if bucket exists
    if not bucket.exists():
        print(f"ERROR: Bucket {bucket_name} does not exist!")
        sys.exit(1)
    print(f"Successfully accessed bucket: {bucket_name}")
except Exception as e:
    print(f"ERROR accessing bucket: {str(e)}")
    sys.exit(1)

# Language mappings
languages = {
    "rap_Latn": {"code": "rap", "whisper_code": None},  # Rapa Nui uses custom model
    "spa_Latn": {"code": "spa", "whisper_code": "es"},  # Spanish
    "eng_Latn": {"code": "eng", "whisper_code": "en"},  # English
}

whisper_model_id = "openai/whisper-base"


def upload_rap_model_directly(rap_model_path, rap_vocab_path):
    """
    Upload Rapa Nui model files directly from source to GCP.
    """
    print(f"Preparing to upload Rapa Nui model from {rap_model_path}...")
    print(f"  - Model path exists: {os.path.exists(rap_model_path)}")
    print(f"  - Model path is directory: {os.path.isdir(rap_model_path)}")
    print(f"  - Vocab path exists: {os.path.exists(rap_vocab_path)}")
    print(f"  - Vocab path is file: {os.path.isfile(rap_vocab_path)}")

    # Upload model files directly
    model_files = []
    print(f"Scanning model directory: {rap_model_path}")
    for root, _, files in os.walk(rap_model_path):
        print(f"Found {len(files)} files in {root}")
        for file in files:
            local_path = os.path.join(root, file)
            rel_path = os.path.relpath(local_path, rap_model_path)
            gcp_path = f"{base_folder}/rap/model/{rel_path}"
            model_files.append((local_path, gcp_path))

    # Upload vocabulary file
    vocab_gcp_path = f"{base_folder}/rap/vocab.json"
    print(f"Will upload vocab file to: gs://{bucket_name}/{vocab_gcp_path}")
    model_files.append((rap_vocab_path, vocab_gcp_path))

    # Upload all files
    print(f"Uploading {len(model_files)} Rapa Nui model files...")
    for local_path, gcp_path in tqdm(model_files, desc="Uploading Rapa Nui files"):
        try:
            print(f"Uploading {local_path} to gs://{bucket_name}/{gcp_path}")
            blob = bucket.blob(gcp_path)
            blob.upload_from_filename(local_path)
            print(f"Successfully uploaded {local_path}")
        except Exception as e:
            print(f"ERROR uploading {local_path}: {str(e)}")
            return False

    print("All Rapa Nui model files uploaded successfully")
    return True


def upload_whisper_model_directly():
    """
    Download Whisper model from Hugging Face and upload directly to GCP.
    """
    print(f"Processing Whisper model: {whisper_model_id}...")

    try:
        # Create a small temporary directory just for metadata files
        with tempfile.TemporaryDirectory() as temp_dir:
            print(f"Created temporary directory for metadata: {temp_dir}")

            # First download the processor config - this is small
            print("Downloading Whisper processor config...")
            processor = WhisperProcessor.from_pretrained(
                whisper_model_id, token=HF_TOKEN
            )

            # Save processor config only (small files)
            print(f"Saving processor config to {temp_dir}")
            processor_path = os.path.join(temp_dir, "processor")
            processor.save_pretrained(processor_path)

            # Upload processor files
            print("Uploading processor files to GCP...")
            for root, _, files in os.walk(processor_path):
                for file in files:
                    local_path = os.path.join(root, file)
                    rel_path = os.path.relpath(local_path, processor_path)
                    gcp_path = f"{base_folder}/whisper/{rel_path}"

                    print(f"{local_path} to gs://{bucket_name}/{gcp_path}")
                    blob = bucket.blob(gcp_path)
                    blob.upload_from_filename(local_path)

            # Now get model config (metadata only at first)
            print("Downloading Whisper model config...")
            model = WhisperForConditionalGeneration.from_pretrained(
                whisper_model_id,
                token=HF_TOKEN,
                low_cpu_mem_usage=True,
                torch_dtype="auto",
            )

            # Save model
            print("Saving model to temporary directory...")
            model_path = os.path.join(temp_dir, "model")
            model.save_pretrained(model_path)

            # Upload model files
            print("Uploading model files to GCP...")
            for root, _, files in os.walk(model_path):
                for file in files:
                    local_path = os.path.join(root, file)
                    rel_path = os.path.relpath(local_path, model_path)
                    gcp_path = f"{base_folder}/whisper/{rel_path}"

                    print(f"{local_path} to gs://{bucket_name}/{gcp_path}")
                    blob = bucket.blob(gcp_path)
                    blob.upload_from_filename(local_path)

        print("All Whisper model files uploaded successfully")
        return True
    except Exception as e:
        print(f"ERROR processing Whisper model: {str(e)}")
        import traceback

        traceback.print_exc()
        return False


def parse_args():
    print("Parsing command line arguments...")
    parser = argparse.ArgumentParser(description="Upload ASR models to GCP")
    parser.add_argument(
        "--rap-model-path", required=True, help="Path to Rapa Nui model directory"
    )
    parser.add_argument(
        "--rap-vocab-path", required=True, help="Path to Rapa Nui vocabulary file"
    )
    args = parser.parse_args()
    print(f"Arguments received: {args}")
    return args


def main():
    print("\n=== Starting ASR model upload ===")
    try:
        args = parse_args()

        # Validate input paths
        print("Validating input paths...")
        if not os.path.exists(args.rap_model_path):
            print(f"ERROR: Rap model path does not exist: {args.rap_model_path}")
            sys.exit(1)
        if not os.path.isdir(args.rap_model_path):
            print(f"ERROR: Rap model path is not a directory: {args.rap_model_path}")
            sys.exit(1)
        if not os.path.exists(args.rap_vocab_path):
            print(f"ERROR: Rap vocab path does not exist: {args.rap_vocab_path}")
            sys.exit(1)
        if not os.path.isfile(args.rap_vocab_path):
            print(f"ERROR: Rap vocab path is not a file: {args.rap_vocab_path}")
            sys.exit(1)

        print("Input paths validated successfully")

        # Upload Rapa Nui model files directly
        print("\n--- Uploading Rapa Nui model ---")
        rap_success = upload_rap_model_directly(
            args.rap_model_path, args.rap_vocab_path
        )
        if not rap_success:
            print("ERROR: Failed to upload Rapa Nui model files")
            sys.exit(1)

        # Upload Whisper model files directly
        print("\n--- Uploading Whisper model ---")
        whisper_success = upload_whisper_model_directly()
        if not whisper_success:
            print("ERROR: Failed to upload Whisper model")
            sys.exit(1)

        print(
            f"\nAll models uploaded successfully to gs://{bucket_name}/{base_folder}/"
        )
        print("Use these paths in your deployment:")
        print(f"  - Rap model path: gs://{bucket_name}/{base_folder}/rap/model")
        print(f"  - Rap vocab path: gs://{bucket_name}/{base_folder}/rap/vocab.json")
        print(f"  - Whisper model: gs://{bucket_name}/{base_folder}/whisper")

    except Exception as e:
        print(f"CRITICAL ERROR: {str(e)}")
        import traceback

        traceback.print_exc()
        sys.exit(1)

    print("=== Script completed successfully ===")


if __name__ == "__main__":
    main()
