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
'use client'
import "./modal.css"
import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch , faX } from "@fortawesome/free-solid-svg-icons";
import languages_list from "../../assets/languages.json";

export default function Modal(props){

  const modalMode = props.isOpen;


  const [characterSearch, setCharacterSearch] = useState('')
  const [searchLang, setSearchLang] = useState('')

  const [languages, setLanguages] = useState([]);

  

  const alphabet = [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
    'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
    'U', 'V', 'W', 'X', 'Y', 'Z'
  ];

  const handleCharacterSearch = (value) => {

    if (characterSearch === value){
      setLanguages(languages_list)
      setCharacterSearch('')
    }
    else{
      setCharacterSearch(value)

      const newArray = languages_list.filter(lang => lang.Language[0] === value);

      if (newArray.length === 0){
        setLanguages(languages_list)
      }
      else{
        setLanguages(newArray)
      }

      console.log(newArray);


    }  
  }

  const handleSelectedLanguage = (code) => {
    props.selectedLang(code);
  }

  const handleSearchBox = (event) => {
    const value = event.target.value
    setSearchLang(value)

    const newArray = languages_list.filter(lang => lang.Language.toLowerCase().includes(value.toLowerCase()));

    if (newArray.length === 0){
      setLanguages(languages_list)
    }
    else{
      setLanguages(newArray)
    }
  }

  useEffect( () => {
    const new_list = languages_list.sort((a, b) => a.Language.localeCompare(b.Language));
    setLanguages(new_list);
  }, []);

  if (modalMode){
    return(
      <div className="mask">
        <div className="modal">

          <div className="navModal">

            <div className="space">
              <FontAwesomeIcon icon={faX}/>
            </div>

            <div className="searcher">
              <FontAwesomeIcon icon={faSearch}/>
              <textarea
                value={searchLang}
                onChange={handleSearchBox}
                placeholder='Buscar lenguaje'
              />
            </div>

            <div className="exitModal" onClick={props.onClose}>
              <FontAwesomeIcon icon={faX}/>
            </div>

          </div>

          <div className="characters">
            {alphabet.map(character => (
              <div
                style ={{color: character == characterSearch? '#0a8cde' : '#c8d1e1'}}
                key={character} 
                onClick={() => handleCharacterSearch(character)}
              >
                <strong>{character}</strong>
              </div>
            ))}
          </div>

          <div className="languages">
            {languages.map(language => (
              <div key={language.code} onClick={() => handleSelectedLanguage(language.code)}>
                {language.Language}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

}