#!/usr/bin/env bash
set -e

ORIGINAL_ARGS=("$@")

MODEL_NAME=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --model-name=*)
      MODEL_NAME="${1#*=}"
      shift
      ;;
    --model-name)
      MODEL_NAME="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

export MODEL_NAME="$MODEL_NAME"

"Starting API server..."
uvicorn api:app --host 0.0.0.0 --port 8080 &  # in the background

"Starting Triton server..."
exec python3 server.py "${ORIGINAL_ARGS[*]}"  # adds all arguments passed to the script
