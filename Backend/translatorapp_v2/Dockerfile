# Copyright 2024 Centro Nacional de Inteligencia Artificial (CENIA, Chile). All rights reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
FROM python:3.11.7-slim

# Establish the working directory to /app
WORKDIR /app
# Copy the requirements.txt file
COPY requirements.txt .

# Install the dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the files
COPY . .
# Default command to run the application
RUN ["chmod", "+x", "./run_django_server.sh"]
ENTRYPOINT ["./run_django_server.sh"]
CMD ["8000"]
