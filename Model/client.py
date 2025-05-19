import argparse
import json

import requests


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


def predict(text, source_lang, target_lang, model_name, port=8015):
    payload = generate_payload(text, source_lang, target_lang)
    response = requests.post(
        url=f"http://localhost:{port}/v2/models/{model_name}/infer",
        data=json.dumps(payload),
    )
    response = response.json()

    # Process the response
    if "outputs" in response:
        outputs = response["outputs"][0]["data"][0]
        return outputs
    elif "error" in response:
        raise Exception(f"Error in the response: {response}")
    else:
        return response


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--text", type=str, default="Hola como estas")
    parser.add_argument("--source-lang", type=str, default="spa_Latn")
    parser.add_argument("--target-lang", type=str, default="arn_Latn")
    parser.add_argument("--model-name", type=str, required=True)
    parser.add_argument("--port", type=int, default=8015)
    args = parser.parse_args()

    print(
        predict(
            args.text, args.source_lang, args.target_lang, args.model_name, args.port
        )
    )
