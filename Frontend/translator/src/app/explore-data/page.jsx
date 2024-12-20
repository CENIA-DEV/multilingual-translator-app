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

import { useState } from 'react';
import FeedbackModal from '../components/feedbackModal/feedbackModal.jsx'
import ListSuggestions from '../components/listSuggestions/listSuggestions.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Exploredata()  {

  const [editingTranslation, setEditingTranslation] = useState(null);
  const [editingSuggestionId, setEditingSuggestionId] = useState(null);
  const [updateTable, setUpdateTable] = useState(false);

  const handleUpdateTable = () => {
    setUpdateTable(!updateTable);
  }

  const handleEditSuggestion = (suggestion) => {
    setEditingTranslation(suggestion);
    setEditingSuggestionId(suggestion.id);
  }

  return (
    <div className="h-fit min-h-screen bg-gray-100 w-full">
      <div className="container grow mx-auto w-[90%] p-4">
        <h1 className="text-3xl font-bold mb-6 text-default">
          Sugerencias Ingresadas
        </h1>
        <Tabs defaultValue="not-validated" className="space-y-4">
          <TabsList className="mb-4 py-10">
            <TabsTrigger value="not-validated" className="text-lg font-semibold">
              Sugerencias por Validar
            </TabsTrigger>
            <TabsTrigger value="validated" className="text-lg font-semibold">
              Sugerencias Validadas
            </TabsTrigger>
          </TabsList>
          <TabsContent value="not-validated">
            <ListSuggestions 
              handleEditSuggestion={handleEditSuggestion}
              validated={false}
              updateTable={updateTable}
            />

          </TabsContent>
          <TabsContent value="validated">
            <ListSuggestions
              handleEditSuggestion={handleEditSuggestion}
              validated={true}
              updateTable={updateTable}
            />
          </TabsContent>
        </Tabs>

        <FeedbackModal
          editingTranslation={editingTranslation}
          setEditingTranslation={setEditingTranslation}
          suggestionId={editingSuggestionId}
          validatedSuggestion={editingTranslation?.validated}
          updateTable={handleUpdateTable} 
        />
      </div>
    </div>
  )
};
