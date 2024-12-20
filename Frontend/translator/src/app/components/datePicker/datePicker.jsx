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

import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import { es } from "date-fns/locale";
import { CalendarIcon } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useState } from "react";

export default function DatePicker({disabled=false, align="end", ...props}) {

  const [selectedMonth, setSelectedMonth] = useState(props.selectedDate? props.selectedDate : new Date());

  const handleDateChange = (date) => {
    props.handleDateUpdate(date);
    setSelectedMonth(date);
  }

  const handleMonthChange = (month) => {

    const currentDate = selectedMonth? selectedMonth : new Date();

    setSelectedMonth(new Date(month+'/01/'+currentDate.getFullYear()));
  }

  const handleYearChange = (year) => {

    const currentDate = selectedMonth? selectedMonth : new Date();

    setSelectedMonth(new Date((currentDate.getMonth()+1)+'/01/'+year));
  }

  const months = [
    { value: '01', label: 'Enero' },
    { value: '02', label: 'Febrero' },
    { value: '03', label: 'Marzo' },
    { value: '04', label: 'Abril' },
    { value: '05', label: 'Mayo' },
    { value: '06', label: 'Junio' },
    { value: '07', label: 'Julio' },
    { value: '08', label: 'Agosto' },
    { value: '09', label: 'Septiembre' },
    { value: '10', label: 'Octubre' },
    { value: '11', label: 'Noviembre' },
    { value: '12', label: 'Diciembre' }
  ]
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 100 }, (_, i) => String(currentYear - i))

  return (
    <div className="relative w-full h-[50px]">
      <label
        htmlFor="date"
        className='absolute text-sm rounded-full text-gray-500 duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white px-1 peer-focus:px-2 peer-focus:text-blue-600 peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 left-1'
      >
        {props.label}
      </label>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={"outline"}
            className="w-full justify-start px-2.5 pb-2.5 pt-4 text-left h-full font-normal disabled:cursor-not-allowed"
            disabled={disabled}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            <span className={`text-sm ${disabled? "text-gray-500" : ""}`}>
              {props.selectedDate ? 
                format(props.selectedDate, "P", {locale: es}) 
                : 
                "Seleccione una fecha"
              }
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align={align}>
          <div className="flex p-3 h-[55px] gap-5">
            <select
              id="month"
              value={selectedMonth? months[selectedMonth.getMonth()].value : ''}
              onChange={(e) => handleMonthChange(e.target.value)}
              className="block cursor-pointer px-2.5 pb-2.5 pt-1 w-full text-sm text-gray-900 bg-transparent rounded-lg border border-gray-300 appearance-none focus:outline-none focus:ring-0 focus:border-default peer"
            >
              {months.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>

            <select
              id="year"
              value={selectedMonth? selectedMonth.getFullYear() : ''}
              onChange={(e) => handleYearChange(e.target.value)}
              className="block cursor-pointer px-2.5 pb-2.5 pt-1 w-full text-sm text-gray-900 bg-transparent rounded-lg border border-gray-300 appearance-none focus:outline-none focus:ring-0 focus:border-default peer"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <Calendar
            mode="single"
            month={selectedMonth}
            onMonthChange={setSelectedMonth}
            selected={props.selectedDate}
            onSelect={handleDateChange}
            disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
            initialFocus
            locale={es}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}