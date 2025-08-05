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

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardFooter} from "@/components/ui/card";
import ActionIcon from '../actionIcon/actionIcon.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { faEdit, faTrash, faCheck } from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/button.jsx";
import { Badge } from "@/components/ui/badge"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft , faChevronRight } from "@fortawesome/free-solid-svg-icons";
import { useState , useEffect, useCallback } from "react";
import { API_ENDPOINTS, BASE_LANG, VARIANT_LANG } from '../../constants.js';
import api from '../../api.js';
import { useToast } from "@/hooks/use-toast"

export default function ListSuggestions({validated, ...props}) {

  const handleUpdateTable = props.updateTable;
  const handleEditSuggestion = props.handleEditSuggestion;
  const { toast } = useToast();

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [nextPage , setNextPage] = useState('');
  const [prevPage , setPrevPage] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isTableLoading, setIsTableLoading] = useState(true);
  const srcLang = `${BASE_LANG}_Latn`
  const dstLang = VARIANT_LANG === 'arn' ? 'arn_a0_n,arn_r0_n,arn_u0_n' : `${VARIANT_LANG}_Latn`;
  
  const reorderSuggestions = useCallback((suggestions) => {
    return suggestions.map((suggestion) => {
      const direction = suggestion.src_lang.code === srcLang
      return {
        ...suggestion,
        src_text: direction ? suggestion.src_text : suggestion.dst_text,
        dst_text: direction ? suggestion.dst_text : suggestion.src_text,
        src_lang: direction ? suggestion.src_lang : suggestion.dst_lang,
        dst_lang: direction ? suggestion.dst_lang : suggestion.src_lang
      }
    })
  }, [srcLang]);

  const getSuggestions = useCallback(async (validated) => {
    setIsTableLoading(true);
    try {
      let queryParams;
      if (validated) {
        queryParams = {
          page: currentPage,
          lang: dstLang,
          validated: validated,
          correct: true,
        }
      } else {
        queryParams = {
          page: currentPage,
          lang: dstLang,
          validated: validated,
        }
      }
      const res = await api.get(
        API_ENDPOINTS.SUGGESTIONS, 
        { 
          params: queryParams
        }
      );
      const { next, previous, results, count, } = res.data;
      setTotalPages(results.length > 0 ? Math.ceil(count / results.length) : 1);
      setNextPage(next !== null ? extractPageNumber(next) : 1);
      setPrevPage(previous !== null ? extractPageNumber(previous) : totalPages);
      // const orderedSuggestions = reorderSuggestions(results);
      setSuggestions(results);
    } 
    catch (error) {
      console.error('Error fetching suggestions:', error);
      // TODO: Add user-friendly error handling, e.g., toast notification
    } 
    finally {
      setIsTableLoading(false);
    }
  }, [currentPage, dstLang, reorderSuggestions, totalPages]);

  const extractPageNumber = (url) => {
    const match = url.match(/page=(\d+)/);
    return match ? parseInt(match[1]) : 1;
  };

  const handleNegativeFeedback = async (selectedSuggestion) => {
    try {
      await api.patch(
        API_ENDPOINTS.SUGGESTIONS+selectedSuggestion.id+'/reject_suggestion/'
      )

      setSuggestions(prevSuggestions => 
        prevSuggestions.filter(suggestion => suggestion.id !== selectedSuggestion.id)
      );

      toast({
        title: "Sugerencia rechazada",
        description: "La sugerencia ha sido rechazada correctamente",
      })
    } 
    catch (error) {
      console.error('Error rejecting suggestion:', error);
    }
  }

  const handlePositiveFeedback = async (selectedSuggestion) => {
    try {
      await api.patch(
        API_ENDPOINTS.SUGGESTIONS+selectedSuggestion.id+'/accept_suggestion/',
        {
          'src_text': selectedSuggestion.src_text,  
          'updated_suggestion': selectedSuggestion.suggestion
        }
      )

      setSuggestions(prevSuggestions => 
        prevSuggestions.filter(suggestion => suggestion.id !== selectedSuggestion.id)
      );

      toast({
        title: "Sugerencia aceptada",
        description: "La sugerencia ha sido aceptada correctamente",
      })
    } 
    catch (error) {
      console.error('Error accepting suggestion:', error);
    }
  }

  useEffect(() => {
    getSuggestions(validated);
  }, [currentPage, validated, handleUpdateTable, getSuggestions]);

  return (
        <Card className="p-5">
          <CardContent>
            {isTableLoading ?   
              <div className="flex flex-col space-y-3">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-[1000px] w-full" />
              </div>
              :
              <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-lg font-bold w-[45%]">Fuente</TableHead>
                    <TableHead className="text-lg font-bold w-[45%]">Traducción</TableHead>
                    <TableHead className="text-lg font-bold w-[10%]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suggestions.map((suggestion) => (
                    <TableRow key={suggestion.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center justify-between w-full">
                          <div className="max-h-24 overflow-y-auto pr-2">{suggestion.src_text}</div>
                          {suggestion.src_lang.code !== 'spa_Latn' ? (
                            <Badge variant="secondary" className='bg-default hover:bg-defaultHover text-white min-w-[90px] justify-center'>{suggestion.src_lang.name}</Badge>
                          ) : (
                            <Badge variant="secondary" className='bg-red-500 hover:bg-red-600 text-white min-w-[90px] justify-center'>{suggestion.src_lang.name}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell> 
                        <div className="flex items-center justify-between w-full"> 
                          <div className="max-h-24 overflow-y-auto pr-2">{validated ? suggestion.dst_text : suggestion.suggestion}</div>
                          {suggestion.dst_lang.code !== 'spa_Latn' ? (
                            <Badge variant="secondary" className='bg-default hover:bg-defaultHover text-white min-w-[90px] justify-center'>{suggestion.dst_lang.name}</Badge>
                          ) : (
                            <Badge variant="secondary" className='bg-red-500 hover:bg-red-600 text-white min-w-[90px] justify-center'>{suggestion.dst_lang.name}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">

                        <ActionIcon 
                          icon={faEdit} 
                          tooltipText="Editar traducción" 
                          clickCallback={() => handleEditSuggestion(suggestion)} 
                          variant="ghost" 
                        />

                        {!validated && (
                          <>
                            <ActionIcon 
                              icon={faTrash} 
                              tooltipText="Eliminar sugerencia" 
                              clickCallback={() => handleNegativeFeedback(suggestion)} 
                              variant="ghost" 
                            />
                            
                            <ActionIcon 
                              icon={faCheck} 
                              tooltipText="Aceptar sugerencia" 
                              clickCallback={() => handlePositiveFeedback(suggestion)} 
                              variant="ghost" 
                            />
                          </>
                        )}

                      </TableCell>
                    </TableRow>
                  ))}
                  </TableBody>
                </Table>
              </>
            }
          </CardContent>

          <CardFooter className="flex justify-between">
            <Button
              onClick={() => setCurrentPage(prevPage)}
              className="bg-default text-white hover:bg-defaultHover"
            >
              <FontAwesomeIcon icon={faChevronLeft} className="h-4 w-4 mr-2" /> Anterior
            </Button>
            <span>Página {currentPage} de {totalPages}</span>
            <Button
              onClick={() => setCurrentPage(nextPage)}
              className="bg-default text-white hover:bg-defaultHover"
            >
              Siguiente <FontAwesomeIcon icon={faChevronRight} className="h-4 w-4 ml-2" />
            </Button>
          </CardFooter>
        </Card>
    )
}