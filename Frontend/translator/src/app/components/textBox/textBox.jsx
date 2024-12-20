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

import { useEffect, useState } from 'react'
import './textBox.css'
import { TypeAnimation } from 'react-type-animation';


export default function TextBox(props){
  
  const side = props.textSide;

  const dstText = props.dstText;

  const [srcText, setSrcText] = useState('')
  
  useEffect( () => {

    const translateText = () =>{
      if (srcText.length != 0){
        console.log("traduciendo")
        props.handleTextChange(srcText);
      }
    }
    
    const timeoutId = setTimeout( () => {
      translateText(srcText)
    }, 1500);
  
    return () => clearTimeout(timeoutId)

  },[srcText])

  if (side === 'left'){
    return(
      <div className='text-area'>
        <textarea
          value={srcText}
          placeholder='Escriba aquí el texto a traducir'
          onChange={e => setSrcText(e.target.value)}
        />
      </div>
    )
  }
  else{
    return(
      <div key={dstText} className='text-area-right'>
        {/* <textarea
          readOnly
          placeholder='Acá se mostrará el texto traducido'
          value={dstText}
        /> */}
        <TypeAnimation
          wrapper="textarea"
          speed={80}
          sequence={[dstText]}
        />
      </div>
    )
  }
  
}