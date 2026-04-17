'use client'

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faEdit, faTrash, faSave, faTimes, faCircleInfo, faChevronLeft, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import ActionIcon from "../components/actionIcon/actionIcon";
import { Skeleton } from "@/components/ui/skeleton";
import api from "../api";
import { API_ENDPOINTS } from "../constants";

export default function ManageWordInformation() {
  const [words, setWords] = useState([]);
  const [newWordText, setNewWordText] = useState('');
  const [newWordExplanation, setNewWordExplanation] = useState('');
  
  // Chip states for Add New
  const [newSinonimos, setNewSinonimos] = useState([]);
  const [sinonimoInput, setSinonimoInput] = useState('');
  
  const [editingWord, setEditingWord] = useState(null);
  const [editExplanation, setEditExplanation] = useState('');
  
  // Chip states for Editing
  const [editSinonimos, setEditSinonimos] = useState([]);
  const [editSinonimoInput, setEditSinonimoInput] = useState('');
  
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast() || { toast: console.log };

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const fetchWords = async () => {
    try {
      setIsLoading(true);
      const { data } = await api.get(API_ENDPOINTS.WORDS);
      setWords(data.results || data);
    } catch (error) {
      console.error('Error fetching words:', error);
      toast?.({ title: "Error", description: "No se pudieron cargar las palabras", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWords();
  }, []);

  const handleAddWord = async (e) => {
    e.preventDefault();
    if (!newWordText.trim()) return;

    try {
      const { data: wordData } = await api.post(API_ENDPOINTS.WORDS, { text: newWordText });
      
      await api.post(API_ENDPOINTS.WORD_INFORMATION, {
        word: wordData.id,
        additional_explanation: newWordExplanation,
        other_ways_to_say: newSinonimos
      });
      
      toast?.({ title: "Éxito", description: "Palabra agregada correctamente." });
      fetchWords();
      setNewWordText('');
      setNewWordExplanation('');
      setNewSinonimos([]);
      setSinonimoInput('');
    } catch (error) {
      console.error('Error adding word:', error);
      toast?.({ title: "Error", description: "Error al agregar la palabra", variant: "destructive" });
    }
  };

  const handleEdit = (word) => {
    setEditingWord(word.id);
    setEditExplanation(word.information?.additional_explanation || '');
    setEditSinonimos(word.information?.other_ways_to_say || []);
    setEditSinonimoInput('');
  };

  const saveEdit = async (word) => {
    try {
      const infoId = word.information?.id;

      if (infoId) {
        await api.patch(`${API_ENDPOINTS.WORD_INFORMATION}${infoId}/`, {
          additional_explanation: editExplanation,
          other_ways_to_say: editSinonimos
        });
      } else {
        await api.post(API_ENDPOINTS.WORD_INFORMATION, {
          word: word.id,
          additional_explanation: editExplanation,
          other_ways_to_say: editSinonimos
        });
      }
      setEditingWord(null);
      toast?.({ title: "Éxito", description: "Información de la palabra actualizada." });
      fetchWords();
    } catch (error) {
      console.error('Error saving edit:', error);
      toast?.({ title: "Error", description: "No se pudo actualizar la información.", variant: "destructive" });
    }
  };

  const handleDelete = async (wordId) => {
    if (confirm('¿Estás seguro de que deseas eliminar esta palabra?')) {
      try {
        await api.delete(`${API_ENDPOINTS.WORDS}${wordId}/`);
        toast?.({ title: "Éxito", description: "Palabra eliminada correctamente." });
        fetchWords();
      } catch (error) {
        console.error('Error deleting word:', error);
        toast?.({ title: "Error", description: "No se pudo eliminar la palabra.", variant: "destructive" });
      }
    }
  };

  const addSinonimo = (isEdit = false) => {
    if (isEdit) {
      const val = editSinonimoInput.trim();
      if (val && !editSinonimos.includes(val)) {
        setEditSinonimos([...editSinonimos, val]);
        setEditSinonimoInput('');
      }
    } else {
      const val = sinonimoInput.trim();
      if (val && !newSinonimos.includes(val)) {
        setNewSinonimos([...newSinonimos, val]);
        setSinonimoInput('');
      }
    }
  };

  const removeSinonimo = (index, isEdit = false) => {
    if (isEdit) {
      setEditSinonimos(editSinonimos.filter((_, i) => i !== index));
    } else {
      setNewSinonimos(newSinonimos.filter((_, i) => i !== index));
    }
  };

  const totalPages = Math.ceil(words.length / itemsPerPage);
  const currentWords = words.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handlePreviousPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  return (
    <div className="h-fit min-h-screen bg-[#f3f4f6] w-full pb-8">
      <div className="container grow mx-auto w-[90%] md:w-[80%] pt-8 p-4">
        <h1 className="text-3xl font-bold mb-6 text-[#0092d8]">
          Administrar Palabras e Información
        </h1>
        
        <div className="bg-blue-50 text-blue-900 border border-blue-100 p-4 rounded-lg mb-6 flex items-start sm:items-center gap-3">
          <FontAwesomeIcon icon={faCircleInfo} className="flex-shrink-0 text-blue-500 mt-1 sm:mt-0" />
          <p className="text-sm font-medium">
            Recuerda que las palabras tienen que ser escritas de forma correcta y literal. En caso contrario no será considerada por sistema después.
          </p>
        </div>

        <Card className="mb-6 shadow-sm border-0 overflow-visible">
          <CardHeader className="bg-white rounded-t-lg border-b pb-4">
            <CardTitle className="text-xl text-gray-800">Agregar Palabra Nueva</CardTitle>
          </CardHeader>
          <CardContent className="bg-white rounded-b-lg pt-6 overflow-visible">
            <form onSubmit={handleAddWord} className="flex flex-col md:flex-row gap-4 items-start">
              <div className="flex-1 w-full space-y-2">
                <label className="text-base font-semibold text-gray-800">Palabra</label>
                <Input
                  type="text"
                  value={newWordText}
                  onChange={(e) => setNewWordText(e.target.value)}
                  required
                />
              </div>
              <div className="flex-1 w-full space-y-2">
                <label className="text-base font-semibold text-gray-800">Explicación</label>
                <Input
                  type="text"
                  value={newWordExplanation}
                  onChange={(e) => setNewWordExplanation(e.target.value)}
                />
              </div>
              <div className="flex-1 w-full space-y-2">
                <label className="text-base font-semibold text-gray-800">Sinónimos</label>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      value={sinonimoInput}
                      onChange={(e) => setSinonimoInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addSinonimo(false);
                        }
                      }}
                    />
                    <Button 
                      type="button" 
                      variant="secondary"
                      onClick={() => addSinonimo(false)}
                      className="shrink-0 bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-100"
                    >
                      <FontAwesomeIcon icon={faPlus} />
                    </Button>
                  </div>
                  {newSinonimos.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {newSinonimos.map((sin, idx) => (
                        <span key={idx} className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                          {sin}
                          <button 
                            type="button" 
                            className="ml-1.5 focus:outline-none text-blue-400 hover:text-blue-900" 
                            onClick={() => removeSinonimo(idx, false)}
                          >
                            <FontAwesomeIcon icon={faTimes} className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="pt-[32px]">
                <Button type="submit" className="bg-[#0092d8] hover:bg-[#007ba8] text-white">
                  <FontAwesomeIcon icon={faPlus} className="mr-2" />
                  Agregar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-0">
          <CardHeader className="bg-white rounded-t-lg border-b pb-4">
            <CardTitle className="text-xl text-gray-800">Palabras Guardadas</CardTitle>
          </CardHeader>
          <CardContent className="bg-white rounded-b-lg pt-2 p-0">
            {isLoading ? (
               <div className="p-6 space-y-4">
                 {[1, 2, 3].map((i) => (
                   <Skeleton key={i} className="h-16 w-full rounded-md" />
                 ))}
               </div>
            ) : (
                <div className="flex flex-col">
                  {/* Table Header */}
                  <div className="hidden md:flex py-4 px-6 border-b border-gray-200 bg-white items-center text-gray-500 font-semibold text-[15px]">
                    <div className="w-[25%] pr-4">Palabra</div>
                    <div className="w-[35%] pr-4">Explicación</div>
                    <div className="flex-1 pr-4">Sinónimos</div>
                    <div className="w-24 text-right">Acciones</div>
                  </div>

                  {currentWords.map((word) => (
                    <div 
                      key={word.id} 
                      className="flex flex-col md:flex-row md:items-center py-4 px-6 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors bg-white text-[15px]"
                    >
                      {editingWord === word.id ? (
                        <>
                          <div className="w-full md:w-[25%] pr-4 mb-2 md:mb-0">
                             <div className="font-bold text-base flex items-center text-gray-900">
                               {word.text}
                             </div>
                          </div>
                          <div className="w-full md:w-[35%] pr-4 mb-2 md:mb-0">
                             <Input 
                               value={editExplanation}
                               onChange={(e) => setEditExplanation(e.target.value)}
                               placeholder="Añadir explicación..."
                             />
                          </div>
                          <div className="flex-1 pr-4 mb-2 md:mb-0">
                             <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                  <Input 
                                    value={editSinonimoInput}
                                    onChange={(e) => setEditSinonimoInput(e.target.value)}
                                    placeholder="Añadir sinónimo..."
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        addSinonimo(true);
                                      }
                                    }}
                                  />
                                  <Button 
                                    type="button" 
                                    size="icon"
                                    variant="secondary"
                                    onClick={() => addSinonimo(true)}
                                    className="shrink-0 h-10 w-10 bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-100"
                                  >
                                    <FontAwesomeIcon icon={faPlus} />
                                  </Button>
                                </div>
                                {editSinonimos.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 mt-1">
                                    {editSinonimos.map((sin, idx) => (
                                      <span key={idx} className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                                        {sin}
                                        <button 
                                          type="button" 
                                          className="ml-1.5 focus:outline-none text-blue-400 hover:text-blue-900" 
                                          onClick={() => removeSinonimo(idx, true)}
                                        >
                                          <FontAwesomeIcon icon={faTimes} className="h-3 w-3" />
                                        </button>
                                      </span>
                                    ))}
                                  </div>
                                )}
                             </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-full md:w-[25%] pr-4 mb-2 md:mb-0">
                             <p className="text-[15px] font-medium text-gray-900">{word.text}</p>
                          </div>
                          <div className="w-full md:w-[35%] pr-4 mb-2 md:mb-0">
                             <p className="text-[15px] text-gray-800 break-words flex items-center">
                               {word.information?.additional_explanation || <span className="text-gray-400 italic">No especificada</span>}
                             </p>
                          </div>
                          <div className="flex-1 pr-4 mb-2 md:mb-0">
                             <div className="flex flex-wrap gap-1 items-center">
                               {word.information?.other_ways_to_say?.length > 0 ? (
                                 word.information.other_ways_to_say.map((way, idx) => (
                                   <span key={idx} className="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium bg-blue-100 text-blue-800 border border-blue-200">
                                     {way}
                                   </span>
                                 ))
                               ) : (
                                  <p className="text-[15px] text-gray-400 italic flex items-center">Ninguno</p>
                               )}
                             </div>
                          </div>
                        </>
                      )}

                      <div className="flex items-center justify-end space-x-2 mt-4 md:mt-0 shrink-0 w-24">
                        {editingWord === word.id ? (
                          <div className="flex flex-row gap-2 items-center">
                            <ActionIcon 
                               icon={faSave} 
                               tooltipText="Guardar" 
                               clickCallback={async () => saveEdit(word)} 
                               variant="ghost" 
                            />
                            <ActionIcon 
                               icon={faTimes} 
                               tooltipText="Cancelar" 
                               clickCallback={async () => setEditingWord(null)} 
                               variant="ghost" 
                            />
                          </div>
                        ) : (
                          <>
                            <ActionIcon 
                               icon={faEdit} 
                               tooltipText="Editar Palabra" 
                               clickCallback={async () => handleEdit(word)} 
                               variant="ghost" 
                            />
                            <ActionIcon 
                               icon={faTrash} 
                               tooltipText="Eliminar Palabra" 
                               clickCallback={async () => handleDelete(word.id)} 
                               variant="ghost" 
                            />
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  {words.length === 0 && (
                    <div className="py-12 flex flex-col items-center justify-center text-center text-gray-500">
                      <p className="text-lg font-medium text-gray-600 mb-1">No se encontraron palabras</p>
                      <p className="text-sm">Agrega una nueva palabra en el formulario de arriba.</p>
                    </div>
                  )}

                  {words.length > 0 && totalPages > 1 && (
                    <div className="flex items-center justify-between p-6">
                      <Button
                        variant="secondary"
                        onClick={handlePreviousPage}
                        disabled={currentPage === 1}
                        className="bg-[#0092d8] hover:bg-[#007ba8] text-white disabled:bg-gray-300 disabled:text-gray-500 font-normal px-4"
                      >
                        <FontAwesomeIcon icon={faChevronLeft} className="mr-2 h-3 w-3" />
                        Anterior
                      </Button>
                      <span className="text-sm text-black">
                        Página {currentPage} de {totalPages}
                      </span>
                      <Button
                        variant="secondary"
                        onClick={handleNextPage}
                        disabled={currentPage === totalPages}
                        className="bg-[#0092d8] hover:bg-[#007ba8] text-white disabled:bg-gray-300 disabled:text-gray-500 font-normal px-4"
                      >
                        Siguiente
                        <FontAwesomeIcon icon={faChevronRight} className="ml-2 h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
