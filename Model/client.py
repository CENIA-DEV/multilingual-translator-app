import requests
import json
import argparse

def generate_payload(text, source_lang, target_lang):
    payload = {
        "id": "0",
        "inputs": [
            {
                "name": "input_text",
                "shape": [1,1],
                "datatype": "BYTES",
                "data": [[ text ]]
            },
            {
                "name": "source_lang",
                "shape": [1,1],
                "datatype": "BYTES",
                "data": [[ source_lang ]]
            },
            {
                "name": "target_lang",
                "shape": [1,1],
                "datatype": "BYTES",
                "data": [[ target_lang ]]
            }
            ]
        }
    return payload

def predict(text, source_lang, target_lang, model_name):
    payload = generate_payload(text, source_lang, target_lang)
    response = requests.post(url=f"localhost:8015/v2/models/{model_name}/infer",data=json.dumps(payload))
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
    parser.add_argument("--source_lang", type=str, default="spa_Latn")
    parser.add_argument("--target_lang", type=str, default="rap_Latn")
    parser.add_argument("--model_name", type=str, required=True)
    args = parser.parse_args()
    
    print(predict(args.text, args.source_lang, args.target_lang, args.model_name))


        