import argparse
import os
import sys
import tempfile

import torch
from dotenv import load_dotenv
from google.cloud import storage
from huggingface_hub import hf_hub_download
from transformers import AutoModelForCTC, AutoProcessor

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
    # Fallback to check if it's in the current dir
    if os.path.exists("key.json"):
        credentials_file = "key.json"
    else:
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
    # Attempt a soft check. If this fails due to 403, we proceed anyway
    # because object-level permissions might still allow uploads.
    try:
        if not bucket.exists():
            print(f"ERROR: Bucket {bucket_name} does not exist!")
            sys.exit(1)
        print(f"Successfully verified bucket: {bucket_name}")
    except Exception as e:
        print(f"Warning: Could not verify bucket existence ({e}).")
        print("Proceeding anyway assuming object-level permissions are sufficient...")
except Exception as e:
    print(f"ERROR accessing bucket object: {str(e)}")
    sys.exit(1)

mms_model_id = "facebook/mms-1b-all"


def upload_mms_model_directly(use_bf16=False):
    """
    Download MMS base model and upload to GCP.
    """
    print(f"Processing MMS model: {mms_model_id} (bf16: {use_bf16})...")
    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            processor = AutoProcessor.from_pretrained(mms_model_id, token=HF_TOKEN)
            processor.save_pretrained(os.path.join(temp_dir, "mms_processor"))

            dtype = torch.bfloat16 if use_bf16 else torch.float32
            model = AutoModelForCTC.from_pretrained(
                mms_model_id,
                token=HF_TOKEN,
                torch_dtype=dtype,
            )
            model.save_pretrained(
                os.path.join(temp_dir, "mms_model"), safe_serialization=True
            )

            sub_folder = "mms-bf16" if use_bf16 else "mms"
            for folder_name in ["mms_processor", "mms_model"]:
                folder_path = os.path.join(temp_dir, folder_name)
                for root, _, files in os.walk(folder_path):
                    for file in files:
                        local_path = os.path.join(root, file)
                        rel_path = os.path.relpath(local_path, folder_path)
                        gcp_path = f"{base_folder}/{sub_folder}/{rel_path}"
                        blob = bucket.blob(gcp_path)
                        blob.upload_from_filename(local_path)
        return True
    except Exception as e:
        print(f"ERROR processing MMS model: {e}")
        return False


def upload_rap_adapter_directly(adapter_path):
    """
    Upload Rapa Nui adapter file directly to GCP.
    """
    print(f"Preparing to upload Rapa Nui adapter from {adapter_path}...")
    gcp_path = f"{base_folder}/mms/adapter.rap.bin"
    try:
        blob = bucket.blob(gcp_path)
        blob.upload_from_filename(adapter_path)
        print("Successfully uploaded Rapa Nui adapter.")
        return True
    except Exception as e:
        print(f"ERROR uploading Rapa Nui adapter: {e}")
        return False


def upload_spa_adapter_directly():
    """
    Download Spanish adapter from HF and upload directly to GCP.
    """
    print("Preparing to upload Spanish adapter for MMS...")
    gcp_path = f"{base_folder}/mms/adapter.spa.bin"
    try:
        print(f"Downloading adapter.spa.bin from {mms_model_id}...")
        local_path = hf_hub_download(
            repo_id=mms_model_id, filename="adapter.spa.bin", token=HF_TOKEN
        )
        blob = bucket.blob(gcp_path)
        blob.upload_from_filename(local_path)
        print("Successfully uploaded Spanish adapter.")
        return True
    except Exception as e:
        print(f"ERROR uploading Spanish adapter: {e}")
        return False


def parse_args():
    parser = argparse.ArgumentParser(description="Upload ASR models to GCP")
    parser.add_argument(
        "--rap-adapter-path", required=True, help="Path to rap-adapter.bin file"
    )
    parser.add_argument(
        "--bf16", action="store_true", help="Save models in bfloat16 before uploading"
    )
    parser.add_argument(
        "--skip-mms", action="store_true", help="Skip MMS base model upload"
    )
    parser.add_argument(
        "--skip-spa-adapter", action="store_true", help="Skip Spanish adapter upload"
    )
    return parser.parse_args()


def main():
    print("\n=== Starting ASR model upload ===")
    try:
        args = parse_args()

        if not os.path.exists(args.rap_adapter_path):
            print(f"ERROR: Rap adapter path does not exist: {args.rap_adapter_path}")
            sys.exit(1)

        # 1. Upload Rapa Nui adapter
        print("\n--- Uploading Rapa Nui adapter ---")
        if not upload_rap_adapter_directly(args.rap_adapter_path):
            sys.exit(1)

        # 2. Upload Spanish adapter
        if not args.skip_spa_adapter:
            print("\n--- Uploading Spanish adapter ---")
            if not upload_spa_adapter_directly():
                sys.exit(1)

        # 3. Upload MMS base model
        if not args.skip_mms:
            print("\n--- Uploading MMS base model ---")
            if not upload_mms_model_directly(use_bf16=args.bf16):
                sys.exit(1)

        print(
            f"\nAll models uploaded successfully to gs://{bucket_name}/{base_folder}/"
        )

    except Exception as e:
        print(f"CRITICAL ERROR: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    main()
