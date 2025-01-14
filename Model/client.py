import numpy as np
import requests
import json
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



        