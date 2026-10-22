"""
Convert a MADLAD (T5) translation model to CTranslate2, for
`server.py --model-type madlad-ct2`.

    python convert_madlad_ct2.py <model dir> <output dir> [--quantization int8]

In float16, the activation type of `int8_float16`, the encoder's residual stream
of these models overflows: it reaches ~250k and float16 stops at 65504, so
CTranslate2 outputs only `<unk>` (transformers survives it by clamping). The
model is rescaled first, with the same outputs: every sublayer reads the residual
stream through an RMSNorm, so multiplying the embedding and every sublayer's
output projection (attention `o`, feed-forward `wo`) by 1/16 only shrinks the
stream, and `wi_1` x1/4 with `wo` x4 shrinks the feed-forward's inner product
(~14k). The factors are powers of two, so the rescaling is exact.
"""

import argparse
import os

import torch
from ctranslate2.converters import TransformersConverter

RESIDUAL_SCALE = 1 / 16
FEED_FORWARD_SCALE = 1 / 4
TOKENIZER_FILES = [
    "spiece.model",
    "tokenizer.json",
    "tokenizer_config.json",
    "special_tokens_map.json",
    "added_tokens.json",
    "generation_config.json",
]


@torch.no_grad()
def rescale(model):
    """Rescale a T5 model in place so its activations fit in float16."""
    if model.config.tie_word_embeddings:
        raise ValueError("Tied embeddings: the output layer would be rescaled too")
    # the encoder's and the decoder's `embed_tokens` are this same tensor
    model.shared.weight.mul_(RESIDUAL_SCALE)
    for block in [*model.encoder.block, *model.decoder.block]:
        *attention_layers, feed_forward = block.layer
        for layer in attention_layers:
            attention = getattr(layer, "SelfAttention", None) or layer.EncDecAttention
            attention.o.weight.mul_(RESIDUAL_SCALE)
        feed_forward.DenseReluDense.wi_1.weight.mul_(FEED_FORWARD_SCALE)
        feed_forward.DenseReluDense.wo.weight.mul_(RESIDUAL_SCALE / FEED_FORWARD_SCALE)


class RescaledT5Converter(TransformersConverter):
    def load_model(self, model_class, model_name_or_path, **kwargs):
        model = super().load_model(model_class, model_name_or_path, **kwargs)
        rescale(model)
        return model


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("model", help="transformers MADLAD model directory")
    parser.add_argument("output", help="CTranslate2 model directory to create")
    parser.add_argument(
        "--quantization",
        default="int8",
        help="CTranslate2 weight type (int8, float16, bfloat16, float32)",
    )
    args = parser.parse_args()

    copy_files = [
        f for f in TOKENIZER_FILES if os.path.exists(os.path.join(args.model, f))
    ]
    converter = RescaledT5Converter(args.model, copy_files=copy_files)
    converter.convert(args.output, quantization=args.quantization)
    print(f"Saved {args.output} ({args.quantization})")


if __name__ == "__main__":
    main()
