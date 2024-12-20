/* Copyright 2024 Centro Nacional de Inteligencia Artificial (CENIA, Chile). All rights reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License. */

import React from 'react';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faThumbsUp, faThumbsDown } from "@fortawesome/free-solid-svg-icons";
import { faThumbsDown as farThumbsDown } from '@fortawesome/free-regular-svg-icons';
import { faThumbsUp as farThumbsUp } from '@fortawesome/free-regular-svg-icons';
import './thumbsButton.css';

const ThumbsButton = ({ type, active, onClick }) => {
    return (
        <button onClick={onClick} className={`thumbs${active ? '-active' : ''}`}>
            <FontAwesomeIcon size='xl' icon={type === 'up' ? (active ? faThumbsUp : farThumbsUp) : (active ? faThumbsDown : farThumbsDown)} />
        </button>
    );
};

export default ThumbsButton;
