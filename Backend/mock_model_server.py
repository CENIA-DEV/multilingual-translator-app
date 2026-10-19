#!/usr/bin/env python3
"""
Mock inference server for local development (no GPU required).

Emulates the KServe/Pytriton v2 HTTP interface that the Django backend calls for
translation, TTS and ASR, so every UI flow can be exercised end to end without
running the real models. Responses are obvious placeholders -- this server makes
no attempt at real translation, speech synthesis or recognition.

One process serves all three model types: the request is dispatched by looking at
the names of the `inputs` in the payload, not the model name in the URL, so all
three APP_INFERENCE_*_URL settings can point at this single port.

Usage:
    python mock_model_server.py [--port 8015] [--host 127.0.0.1]

Endpoints:
    POST /v2/models/<any-model-name>/infer
    GET  /health
"""

import argparse
import json
import logging
import math
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s %(levelname)s [mock-model] %(message)s"
)
logger = logging.getLogger("mock_model_server")

MODEL_VERSION = "mock-1"
TTS_SAMPLE_RATE = 16000  # frontend hardcodes 16 kHz when playing the waveform

# Matches the "[...] " tag this server prepends ("[spa_Latn]", "[arn_Latn
# territory=nagche writing=raguileo]"), so pivot translations (native -> spa_Latn ->
# target) do not accumulate a tag per hop.
_TAG_RE = re.compile(r"^\[[^\]]*\]\s*")

# Optional inputs naming a language variant's territory and alphabet, sent
# only for languages that have them (arn_Latn + territory "nagche" + writing "raguileo")
VARIANT_FIELDS = ("territory", "writing")


def _unwrap(value):
    """Pytriton payloads nest scalars as [[value]]; unwrap to the scalar."""
    while isinstance(value, list) and value:
        value = value[0]
    return value


def _inputs_by_name(payload):
    return {i.get("name"): i.get("data") for i in payload.get("inputs", [])}


def describe(lang, variant):
    """The language with its variant.

    For example: "arn_Latn territory=nagche writing=raguileo".
    """
    return " ".join([lang] + [f"{k}={v}" for k, v in variant.items()])


def mock_translation(text, source_lang, target_lang, target_variant=None):
    """Tag each line with the target language (and its territory / alphabet,
    when given), preserving paragraph structure.

    The backend splits translations on newlines, so line count must be preserved.
    """
    tag = describe(target_lang, target_variant or {})
    out = []
    for line in str(text).split("\n"):
        if line.strip():
            out.append(f"[{tag}] {_TAG_RE.sub('', line)}")
        else:
            out.append(line)
    return "\n".join(out)


def mock_waveform(text):
    """A short, quiet two-tone chirp so audio playback is audibly verifiable."""
    duration = min(3.0, max(0.4, len(str(text)) * 0.05))
    n = int(TTS_SAMPLE_RATE * duration)
    samples = []
    for i in range(n):
        t = i / TTS_SAMPLE_RATE
        progress = i / n
        freq = 420.0 + 160.0 * progress
        # fade in/out to avoid clicks at the buffer edges
        envelope = min(1.0, progress * 20.0, (1.0 - progress) * 20.0)
        samples.append(0.18 * envelope * math.sin(2.0 * math.pi * freq * t))
    return samples


def mock_transcription(num_samples, sampling_rate, lang_code):
    seconds = num_samples / float(sampling_rate or TTS_SAMPLE_RATE)
    return f"[transcripcion simulada {lang_code} - {seconds:.1f}s de audio]"


def _envelope(model_name, output_name, data):
    return {
        "id": "0",
        "model_name": model_name,
        "model_version": MODEL_VERSION,
        "outputs": [
            {
                "name": output_name,
                "shape": [1, len(data)],
                "datatype": "BYTES",
                "data": data,
            }
        ],
    }


class MockModelHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):  # quieter default access logging
        logger.debug("%s - %s", self.address_string(), fmt % args)

    def _send_json(self, obj, status=200):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.rstrip("/") in ("/health", "/v2/health/ready"):
            self._send_json({"status": "ok", "mock": True})
        else:
            self._send_json({"error": f"unknown path {self.path}"}, status=404)

    def do_POST(self):
        if not self.path.endswith("/infer"):
            self._send_json({"error": f"unknown path {self.path}"}, status=404)
            return

        try:
            length = int(self.headers.get("Content-Length") or 0)
            payload = json.loads(self.rfile.read(length) or b"{}")
        except Exception as exc:
            logger.error("Bad request body: %s", exc)
            self._send_json({"error": f"invalid JSON body: {exc}"}, status=400)
            return

        # /v2/models/<model_name>/infer
        parts = self.path.strip("/").split("/")
        model_name = parts[2] if len(parts) > 2 else "mock-model"

        try:
            self._send_json(self._dispatch(model_name, payload))
        except Exception as exc:  # surface as the error shape the backend expects
            logger.exception("Failed handling request")
            self._send_json({"error": str(exc)}, status=500)

    def _dispatch(self, model_name, payload):
        inputs = _inputs_by_name(payload)

        # --- Translation: input_text / source_lang / target_lang ---
        if "input_text" in inputs:
            text = _unwrap(inputs["input_text"])
            src = _unwrap(inputs.get("source_lang")) or "unknown"
            dst = _unwrap(inputs.get("target_lang")) or "unknown"
            variant = {
                side: {
                    f: _unwrap(inputs[f"{side}_{f}"])
                    for f in VARIANT_FIELDS
                    if f"{side}_{f}" in inputs
                }
                for side in ("source", "target")
            }
            result = mock_translation(text, src, dst, variant["target"])
            logger.info(
                "translate %s -> %s | %r",
                describe(src, variant["source"]),
                describe(dst, variant["target"]),
                text[:60],
            )
            return _envelope(model_name, "output_text", [result])

        # --- ASR: audio / sampling_rate / lang_code ---
        if "audio" in inputs:
            audio = inputs["audio"]
            samples = (
                audio[0] if audio and isinstance(audio[0], list) else (audio or [])
            )
            rate = _unwrap(inputs.get("sampling_rate")) or TTS_SAMPLE_RATE
            lang = _unwrap(inputs.get("lang_code")) or "unknown"
            result = mock_transcription(len(samples), rate, lang)
            logger.info("asr %s | %d samples @ %sHz", lang, len(samples), rate)
            return _envelope(model_name, "output_text", [result])

        # --- TTS: text / lang_code ---
        if "text" in inputs:
            text = _unwrap(inputs["text"])
            lang = _unwrap(inputs.get("lang_code")) or "unknown"
            waveform = mock_waveform(text)
            logger.info("tts %s | %r -> %d samples", lang, text[:60], len(waveform))
            envelope = _envelope(model_name, "waveform", waveform)
            envelope["outputs"][0]["datatype"] = "FP32"
            return envelope

        raise ValueError(f"unrecognized inputs: {sorted(k for k in inputs if k)}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8015)
    parser.add_argument("--host", default="127.0.0.1")
    args = parser.parse_args()

    server = ThreadingHTTPServer((args.host, args.port), MockModelHandler)
    logger.info(
        "Mock model server (translation + TTS + ASR) on http://%s:%d",
        args.host,
        args.port,
    )
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("Shutting down")
        server.shutdown()


if __name__ == "__main__":
    main()
