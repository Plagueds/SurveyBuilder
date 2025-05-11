// frontend/src/pages/QuestionEditPage.js
// ----- START OF UPDATED FILE -----
import React from 'react';
// --- FIX: Removed unused Link and useParams ---
// import { Link, useParams } from 'react-router-dom';
// --- END FIX ---
import QuestionEditForm from '../components/QuestionEditForm'; // Import the form

function QuestionEditPage() {
    // --- FIX: Removed unused questionId ---
    // const { questionId } = useParams(); // Get questionId from URL - Not needed here
    // --- END FIX ---

    return (
        // Rely on .main-content for padding and background.
        // Keep maxWidth and margin:auto to constrain the form width centrally.
        <div style={{ maxWidth: '800px', margin: '20px auto' }}>
             {/* The QuestionEditForm handles fetching, rendering, and styling based on the ID from its own useParams hook */}
             <QuestionEditForm />
        </div>
    );
}

export default QuestionEditPage;
// ----- END OF UPDATED FILE -----