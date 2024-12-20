// Copyright 2024 Centro Nacional de Inteligencia Artificial (CENIA, Chile). All rights reserved.
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// 
//      http://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
import { Button } from "@/components/ui/button"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faSpinner } from "@fortawesome/free-solid-svg-icons"
import { cn } from "@/lib/utils";
import { useState } from "react"

export default function ActionButton({children,className,type,...props}) {

    const [isLoading, setIsLoading] = useState(false);

    const handleClick = async () => {
        setIsLoading(true);
        await props.clickCallback();
        setIsLoading(false);
    }

    const baseClassName = "gap-2 shadow bg-default shadow-default/40 transition hover:bg-defaultHover hover:scale-110 hover:shadow-defaultHover/40 duration-700 ease-in-out"

    return (
        <Button
            type={type}
            className={cn(baseClassName, className)}
            onClick={handleClick}
            disabled={isLoading || props.disabled}
        >
            {isLoading ?
                <FontAwesomeIcon icon={faSpinner} className="h-4 animate-infinite animate-spin" />
                : 
                <div className="flex flex-row items-center justify-center gap-2 w-full">
                    {props.icon ? <FontAwesomeIcon icon={props.icon}/> : null}
                    {children}
                </div>
            }
        </Button>
    )
}
