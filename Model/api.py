import os
import json
import requests
from fastapi import FastAPI, HTTPException
from typing import List
from pydantic import BaseModel, constr

TRITON_PORT = 8015
TRITON_URL = f"http://localhost:{TRITON_PORT}"
MODEL_NAME = os.getenv("MODEL_NAME")

app = FastAPI(
    title="Translation API",
    version="1.0"
)

# --------- Schemas ---------

class TranslateRequest(BaseModel):
    text: constr(min_length=1, max_length=5000)
    source_lang: str
    target_lang: str

class BatchTranslationRequest(BaseModel):
    texts: List[constr(min_length=1, max_length=5000)]
    source_lang: str
    target_lang: str

class TranslateResponse(BaseModel):
    translation: str

class BatchTranslationResponse(BaseModel):
    translations: List[str]


# --------- Helpers ---------

def triton_payload(text, source_lang, target_lang):
    return {
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


def call_triton(payload) -> str:
    url = f"{TRITON_URL}/v2/models/{MODEL_NAME}/infer"
    response = requests.post(
        url,
        data=json.dumps(payload),
        timeout=120,  # important for large models
    )

    if response.status_code != 200:
        raise HTTPException(
            status_code=500,
            detail=f"Triton error: {response.text}",
        )

    result = response.json()

    try:
        return result["outputs"][0]["data"][0]
    except Exception:
        raise HTTPException(
            status_code=500,
            detail=f"Malformed Triton response: {result}",
        )


# --------- Routes ---------

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/v1/translate", response_model=TranslateResponse)
def translate(req: TranslateRequest):
    payload = triton_payload(
        req.text,
        req.source_lang,
        req.target_lang,
    )

    translation = call_triton(payload)

    return TranslateResponse(
        translation=translation
    )


@app.post("/v1/batch_translate", response_model=BatchTranslationResponse)
def batch_translate(req: BatchTranslationRequest):
    payload = triton_payload(
        "\\n".join(req.texts),
        req.source_lang,
        req.target_lang,
    )

    skip_lines_per_request = [text.count("\n") for text in req.texts]

    translation = call_triton(payload)
    translations = translation.split("\n")

    output = []
    current_idx = 0
    for skip_lines in skip_lines_per_request:
        new_idx = current_idx + skip_lines + 1
        translation = "\n".join(translations[current_idx:new_idx])
        output.append(translation)
        current_idx = new_idx

    return BatchTranslationResponse(
        translations=output
    )
