# Translator

## Model Setup

For model setup, we use [Pytriton](https://github.com/triton-inference-server/pytriton) to serve the model. Pytriton is a framework for building and serving models. It's a lightweight framework that allows for easy deployment of models.

Move to the `Model` folder and run `pip install -r requirements.txt` to install the dependencies. Note that pytriton has support only for Ubuntu 22+, Debian 11+, Rocky Linux 9+, and Red Hat UBI 9+ operating systems.

Then start the server. A valid model name is required. The model name can be a path to a folder containing the model or a model name as of huggingface.
In this instructions, we'll use huggingface to download model weights. We'll use the [`CenIA/nllb-200-3.3B-spa-rap`](https://huggingface.co/CenIA/nllb-200-3.3B-spa-rap) model that we developed for this project. You can also use vainilla NLLB models from their [repository](https://huggingface.co/facebook/nllb-200-3.3B). 

A few extra options are provided:

- `python server.py --model-name CenIA/nllb-200-3.3B-spa-rap` to run the server without optimizations.
- `python server.py --model-name CenIA/nllb-200-3.3B-spa-rap --optimize` to run the server with optimizations. Such optimizations include using BetterTransformer, TensorFloat32 precision, and warmup.
- `python server.py --model-name CenIA/nllb-200-3.3B-spa-rap --optimize --num-copies 2` to run the server with optimizations and 2 copies of the model. This allows Pytriton to serve multiple requests in parallel. You can set the number of copies to as much as your GPU memory allows.

Extra configurations were configured to increase the performance of the model, such as Dynamic Batching and response caching.\

If all goes well, model server should be listening to requests on port 8015. You can test the server by running `python client.py --model-name CenIA--nllb-200-3.3B-spa-rap`. Note the `--` in the model name instead of `/`. You can also change the source and target languages with `--source-lang` and `--target-lang` and `--text` arguments. Note that currently this model only supports `spa_Latn` and `rap_Latn` languages in both directions. 

## Backend Setup

First, create a Postgresql database and store the database name and host in case of using an external service.

Then install the dependencies.  To do so, go to the `Backend` folder and run `pip install -r requirements.txt`.

Django needs a secret key for encription. To create one run: `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"` and copy the output key.

Then, create the superuser. To do so, go to the `Backend/translatorapp_v2` folder and run `python manage.py createsuperuser`. Make sure that the username and email are both set to your email.

Create a file named `.env` inside `Backend/translatorapp_v2`. The file should look something like this:

```
# database configuration
DB_PASSWORD="<database passsword>"
DB_USER="<database user>"
DB_HOST="<database host: localhost in case of running locally, instead external ip>"
DB_PORT="<database port, should be 5432>"
DB_NAME="<database name>"

VARIANT="<arn or rap>"

# For email configurations
EMAIL_USER="<email account for sending emails>"
EMAIL_KEY="<email account key from email_user>"
INVITATION_GUIDE_URL="<link to invitation guide sent in invite email>"
SUPPORT_EMAIL="<support email sent in invite email>"

DJANGO_SUPERUSER_USERNAME="<username from superuser created before>"
DJANGO_SUPERUSER_EMAIL="<email from superuser created before>"
DJANGO_SUPERUSER_PASSWORD="<password from superuser created before>"

PRODUCTION="False"
SECRET_KEY="<Django key created in previous step>"
APP_FRONTEND_URL="http://localhost:3000"

APP_INFERENCE_MODEL_NAME="<your_inference_model_name>"
APP_RAW_INFERENCE_MODEL_NAME="<your_raw_inference_model_name>"
APP_INFERENCE_MODEL_URL="<your_inference_model_url>"
APP_RAW_INFERENCE_MODEL_URL="<your_raw_inference_model_url>"
```
Then, run database migrations. To do so, go to the `Backend/translatorapp_v2` folder and run `python manage.py migrate`

## Frontend Setup

Open the `Frontend/translator` and Run `npm i` to install the dependencies

Create a file named `.env` inside `Frontend/translator`. The file should look something like this:

```
NEXT_PUBLIC_API_URL = "http://127.0.0.1:8000"
NEXT_PUBLIC_VARIANT = "<arn or rap>"
```

# Run Frontend
Open the `Frontend/translator` folder and run `npm run dev`

# Run Backend
In another console, open the `Backend/translatorapp_v2` folder and run `python manage.py runserver`

# Open the Website
Open a browser and navigate to http://127.0.0.1:3000.

## For deployment

We designed the following GCP deployment:

![GCP deployment description](assets/deployment.png)

We have provided two actions for deploying backend and frontend to GCP. It's important to set the same environment variables as in `.env` file but as secrets. Aditionally, your GCP project variables.
Check action files to see specific variable names. Both frontend and backend urls are retrieved through `SERVICE_NAME_BACKEND` and `SERVICE_NAME_FRONTEND`.

The you can manually run actions on `actions` section in github and setting as input `variant`.
