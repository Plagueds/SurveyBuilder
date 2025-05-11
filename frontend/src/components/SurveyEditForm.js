// frontend/src/components/SurveyEditForm.js
// ----- START OF MODIFIED FILE -----
import React, { useState, useEffect, useCallback } from 'react';

// Props:
// - initialData: { title: string, description: string } // Status removed
// - onUpdate: function({ title, description }) -> Called when form fields change // Status removed
// - isSaving: boolean (Optional, to disable the form during parent save operation)
function SurveyEditForm({ initialData, onUpdate, isSaving = false }) {

   // Local state for form fields, initialized from props
   const [title, setTitle] = useState('');
   const [description, setDescription] = useState('');
   // Removed status state

   // Effect to update local state if initialData prop changes
   useEffect(() => {
       if (initialData) {
           setTitle(initialData.title || '');
           setDescription(initialData.description || '');
           // Removed status update
       }
   }, [initialData]);

   // Debounced update function (no change needed here, but the object passed will change)
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const debouncedUpdate = useCallback(
       debounce((updatedDetails) => {
           if (onUpdate) {
               onUpdate(updatedDetails);
           }
       }, 300),
       [onUpdate]
   );

   // Handlers update local state AND call the debounced onUpdate prop
   const handleTitleChange = (e) => {
       const newTitle = e.target.value;
       setTitle(newTitle);
       // Pass only title and description
       debouncedUpdate({ title: newTitle, description });
   };

   const handleDescriptionChange = (e) => {
       const newDescription = e.target.value;
       setDescription(newDescription);
       // Pass only title and description
       debouncedUpdate({ title, description: newDescription });
   };

   // Removed handleStatusChange

   // Render only the form fields for title, description
   return (
       <form onSubmit={(e) => e.preventDefault()} className="survey-details-form">
           <div style={{ marginBottom: '15px' }}>
               <label htmlFor="surveyTitle" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Title:</label>
               <input
                   type="text"
                   id="surveyTitle"
                   name="title"
                   value={title}
                   onChange={handleTitleChange}
                   required
                   disabled={isSaving}
                   style={{ width: '100%', padding: '10px', border: '1px solid var(--input-border)', borderRadius: 'var(--border-radius-sm)', backgroundColor: 'var(--input-bg)', color: 'var(--input-text)' }}
               />
           </div>

           <div style={{ marginBottom: '15px' }}>
               <label htmlFor="surveyDescription" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Description (Optional):</label>
               <textarea
                   id="surveyDescription"
                   name="description"
                   rows="3"
                   value={description}
                   onChange={handleDescriptionChange}
                   disabled={isSaving}
                   style={{ width: '100%', padding: '10px', border: '1px solid var(--input-border)', borderRadius: 'var(--border-radius-sm)', backgroundColor: 'var(--input-bg)', color: 'var(--input-text)', resize: 'vertical' }}
               />
           </div>

           {/* Removed Status Field */}

       </form>
   );
}

// Simple debounce function implementation (remains the same)
function debounce(func, wait) {
   let timeout;
   return function executedFunction(...args) {
       const later = () => {
           clearTimeout(timeout);
           func(...args);
       };
       clearTimeout(timeout);
       timeout = setTimeout(later, wait);
   };
}

export default SurveyEditForm;
// ----- END OF MODIFIED FILE -----