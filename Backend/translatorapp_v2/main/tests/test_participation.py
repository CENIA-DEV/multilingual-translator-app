# Copyright 2024 Centro Nacional de Inteligencia Artificial (CENIA, Chile).
# All rights reserved.
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
import pytest
from fixtures import api_client, mock_participate_email


@pytest.mark.django_db
def test_participate(api_client, mock_participate_email):
    data = {
        "email": "email@test.com",
        "organization": "org",
        "reason": "I wish to participate in project",
        "first_name": "john",
        "last_name": "doe"
    }
    response = api_client.post("/api/participate-request/", data)
    assert response.status_code == 200
    '''mock_participate_email.assert_called_once_with(
        email="email@test.com",
        organization="org",
        reason="I wish to participate in project",
        first_name="john",
        last_name="doe"
    )'''
    
