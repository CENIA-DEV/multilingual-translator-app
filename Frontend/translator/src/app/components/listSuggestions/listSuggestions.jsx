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

/**
 * Rows per page. Sent to the API as `page_size` rather than assumed, so the
 * page count shown in the footer is the page count the server is actually
 * serving. Guessing it (from the length of the page that came back) is what
 * used to make the pager claim pages that held nothing.
 */
const PAGE_SIZE = 15;

export default function ListSuggestions({validated, ...props}) {

  const handleUpdateTable = props.updateTable;
  const handleEditSuggestion = props.handleEditSuggestion;
  const onActionComplete = props.onActionComplete;
  const { toast } = useToast();

  const [currentPage, setCurrentPage] = useState(1);
  const [suggestions, setSuggestions] = useState([]);
  const [isTableLoading, setIsTableLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [totalCount, setTotalCount] = useState(0);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const rangeStart = totalCount === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, totalCount);

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

  const loadSuggestions = useCallback(() => {
    let cancelled = false;
    const doLoad = async () => {
      setIsTableLoading(true);
      try {
        const queryParams = {
          page: currentPage,
          // Sending `page_size` is what makes the footer's page count true: the
          // server pages by this number instead of the client guessing at one.
          page_size: PAGE_SIZE,
          lang: dstLang,
          validated: validated,
        }
        if (validated) {
          queryParams.correct = true;
        }
        const res = await api.get(
          API_ENDPOINTS.SUGGESTIONS,
          {
            params: queryParams
          }
        );
        const data = res.data;
        const items = Array.isArray(data) ? data : data?.results || [];

        // A paginated answer reports the size of the whole result set; an
        // unpaginated one is the whole result set.
        const count = Array.isArray(data)
          ? data.length
          : typeof data?.count === 'number'
            ? data.count
            : items.length;

        if (!cancelled) {
          // const orderedSuggestions = reorderSuggestions(items);
          setSuggestions(items);
          setTotalCount(count);
          setLoadError(null);
        }
      }
      catch (error) {
        console.error('Error fetching suggestions:', error);
        if (!cancelled) {
          // Say so instead of leaving the previous page's rows on screen under
          // the new page number.
          setSuggestions([]);
          setTotalCount(0);
          setLoadError('No se pudieron cargar las sugerencias. Reintenta en unos momentos.');
        }
      }
      finally {
        if (!cancelled) setIsTableLoading(false);
      }
    };

    doLoad();
    return () => {
      cancelled = true;
    };
  }, [validated, dstLang, currentPage]);

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
      if (onActionComplete) onActionComplete();
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
      if (onActionComplete) onActionComplete();
    } 
    catch (error) {
      console.error('Error accepting suggestion:', error);
    }
  }

  // `loadSuggestions` already changes identity with every one of its own inputs,
  // so listing those inputs here again only made the table fetch each page twice.
  useEffect(() => {
    const cleanup = loadSuggestions();
    return cleanup;
  }, [loadSuggestions, handleUpdateTable]);

  // The last row of the last page can be accepted or deleted out of the list,
  // which leaves the viewer on a page the list no longer has. Step back instead
  // of showing an empty table under a footer that says there is more.
  useEffect(() => {
    if (!isTableLoading && currentPage > totalPages) setCurrentPage(totalPages);
  }, [isTableLoading, currentPage, totalPages]);

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
              {/* Naming the range as well as the total is what tells the viewer that
                  the rows missing from this page are on another one, not missing. */}
              <div className="text-sm text-gray-600 mb-2">
                {totalCount === 0
                  ? 'Sin sugerencias'
                  : `Mostrando ${rangeStart}–${rangeEnd} de ${totalCount} sugerencia${totalCount === 1 ? '' : 's'}`}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-lg font-bold w-[45%]">Fuente</TableHead>
                    <TableHead className="text-lg font-bold w-[45%]">Traducción</TableHead>
                    <TableHead className="text-lg font-bold w-[10%]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suggestions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className={`py-8 text-center ${loadError ? 'text-red-600' : 'text-gray-500'}`}>
                        {loadError || 'No hay sugerencias disponibles.'}
                      </TableCell>
                    </TableRow>
                  )}
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
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="bg-default text-white hover:bg-defaultHover"
            >
              <FontAwesomeIcon icon={faChevronLeft} className="h-4 w-4 mr-2" /> Anterior
            </Button>
            <span>Página {currentPage} de {totalPages}</span>
            <Button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="bg-default text-white hover:bg-defaultHover"
            >
              Siguiente <FontAwesomeIcon icon={faChevronRight} className="h-4 w-4 ml-2" />
            </Button>
          </CardFooter>
        </Card>
    )
}