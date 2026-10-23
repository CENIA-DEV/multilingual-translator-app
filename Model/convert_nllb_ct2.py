"""
Convert an NLLB translation model to CTranslate2, for
`server.py --model-type nllb-ct2` (CPU only).

    python convert_nllb_ct2.py <model dir> <output dir> [--quantization int8]

The tokenizer is saved next to the model, in its fast form (`tokenizer.json`),
so the server does not have to convert the SentencePiece model when it starts.
Languages the model adds (e.g. `rap_Latn`) come with it.
"""

import argparse

from ctranslate2.converters import TransformersConverter
from transformers import AutoTokenizer


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("model_dir")
    parser.add_argument("output_dir")
    parser.add_argument("--quantization", default="int8")
    args = parser.parse_args()

    TransformersConverter(args.model_dir).convert(
        args.output_dir, quantization=args.quantization
    )
    AutoTokenizer.from_pretrained(args.model_dir).save_pretrained(args.output_dir)
    print(f"Converted {args.model_dir} to {args.output_dir} ({args.quantization})")


if __name__ == "__main__":
    main()
