FROM nvcr.io/nvidia/tritonserver:24.10-py3-min

# install pip
RUN apt-get update && apt-get install -y python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables first
# this rarely changes
ENV PYTHONUNBUFFERED=0
# Requirements are installed here so if code changes
# docker doesn't need to reinstall everything
COPY requirements.txt .

# use no cache for smaller image size
RUN pip install --no-cache-dir -r requirements.txt \
    && rm -rf ~/.cache/pip


WORKDIR /home/app/src
COPY . .

ENTRYPOINT ["python3", "server.py"]
