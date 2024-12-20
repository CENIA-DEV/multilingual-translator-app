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
"use client";
import "./langsModal.css";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import languages_list_arn from "../../assets/languages_arn.json";
import languages_list_rap from "../../assets/languages_rap.json";
import { VARIANT_LANG } from "@/app/constants";


export default function LangsModal(props) {

  const languages_list = VARIANT_LANG === 'arn'? languages_list_arn : languages_list_rap;

  const [characterSearch, setCharacterSearch] = useState("");
  const [langSearch, setLangSearch] = useState("");
  const [languages, setLanguages] = useState([]);

  const alphabet = [
    "A", "B", "C", "D", "E", "F", "G", "H", "I", "J",
    "K", "L", "M", "Ñ" , "N", "O", "P", "Q", "R", "S", "T",
    "U", "V", "W", "X", "Y", "Z",
  ];

  const handleCharacterSearch = (value) => {
    if (characterSearch === value) {
      setLanguages(languages_list);
      setCharacterSearch("");
    } 
    else {
      setCharacterSearch(value);

      const newArray = languages_list.filter((lang) => lang.name[0] === value);

      if (newArray.length === 0) {
        setLanguages(languages_list);
      }
      else {
        setLanguages(newArray);
      }
    }
  };

  const handleSearchBox = (value) => {
    
    setLangSearch(value);

    const newArray = languages_list.filter((lang) =>
      lang.name.toLowerCase().includes(value.toLowerCase())
    );

    if (newArray.length === 0) {
      setLanguages(languages_list);
    } else {
      setLanguages(newArray);
    }
  };

  useEffect(() => {
    const new_list = languages_list.sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    setLanguages(new_list);
  }, [languages_list]);

  return (
    <Dialog open={props.isOpen} onOpenChange={props.handleCloseModal}>
      <DialogContent className="flex flex-col items-center justify-start w-4/5 h-4/5">
        <div className="flex flex-col w-11/12 content-center gap-4 h-full">
          <Input
            className="max-[850px]:mt-6"
            placeholder="Buscar idioma"
            value={langSearch}
            onChange={(e) => handleSearchBox(e.target.value)}
          />
          <div className="flex justify-between w-full max-[850px]:hidden">
            {alphabet.map((char) => (
              <Button
                key={char}
                disabled={char === "Ñ" || char === "Q"}
                variant="ghost"
                onClick={() => handleCharacterSearch(char)}
                className={`w-8 border-none disabled:text-gray-400 hover:text-default hover:bg-white font-bold ${characterSearch === char ? "text-default" : "text-black"}`}
              >
                {char}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-3 max-[850px]:grid-cols-1 gap-2 h-auto overflow-y-auto">
            {languages.map((lang) => (
              <Button
                key={lang.code}
                variant="outline"
                onClick={() => props.handleSelectedLanguage(lang)}
                className={`h-auto py-2 px-4 ${props.langModalSelected.code === lang.code ? "bg-default text-white font-bold" : "bg-white text-black"}`}
              >
                {lang.name}
              </Button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}