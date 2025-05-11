// frontend/src/pages/AdminSurveyDetailPage.js
// ----- START OF COMPLETE UPDATED FILE (Based on your provided code) -----
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
// --- Import toast ---
import { toast } from 'react-toastify';

function AdminSurveyDetailPage() {
    // --- CORRECTED useParams: Extract 'id' from URL and assign it to 'surveyId' ---
    const { id: surveyId } = useParams();
    // --- END CORRECTION ---

    const [survey, setSurvey] = useState(null); // Holds the specific survey details (with populated questions)
    const [allQuestions, setAllQuestions] = useState([]); // Holds ALL questions from the system
    const [loading, setLoading] = useState(true);
    // --- Renamed 'error' state to 'fetchError' to distinguish from save errors ---
    const [fetchError, setFetchError] = useState(null);
    const [saving, setSaving] = useState(false);
    // Save errors are primarily handled by toasts now

    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';

    // --- Fetch Data Function ---
    const fetchData = useCallback(async () => {
        setLoading(true);
        // --- Use setFetchError ---
        setFetchError(null);
        setSurvey(null); setAllQuestions([]);
        console.log(`AdminSurveyDetailPage: Fetching data for survey ID: ${surveyId}`); // Now surveyId should be correct

        // --- ADDED CHECK: Ensure surveyId is valid before fetching ---
        if (!surveyId || surveyId === 'undefined') {
            console.error("AdminSurveyDetailPage: Invalid surveyId detected before fetch:", surveyId);
            const errorMsg = "Invalid or missing Survey ID provided in URL.";
            setFetchError(errorMsg);
            toast.error(`Error loading data: ${errorMsg}`);
            setLoading(false);
            return; // Stop execution if ID is invalid
        }
        // --- END ADDED CHECK ---


        try {
            // --- Use the validated surveyId ---
            const [surveyResponse, questionsResponse] = await Promise.all([
                fetch(`${apiUrl}/api/surveys/${surveyId}`), // Use surveyId here
                fetch(`${apiUrl}/api/questions`)
            ]);

            // --- Process Survey Response ---
            if (!surveyResponse.ok) {
                let errorMsg = `Failed survey fetch: ${surveyResponse.status}`;
                // Handle 404 specifically
                if (surveyResponse.status === 404) {
                    errorMsg = `Survey with ID ${surveyId} not found.`;
                } else {
                    try { const errData = await surveyResponse.json(); errorMsg = errData.message || errorMsg; } catch (e) {}
                }
                throw new Error(errorMsg);
             }
            const surveyData = await surveyResponse.json();
            console.log("Survey data received (expecting populated questions):", surveyData);
            // Add more robust check for survey data structure
            if (!surveyData || typeof surveyData !== 'object') {
                throw new Error("Invalid survey data format received from server.");
            }
            // Initialize questions array if missing (robustness)
            if (!Array.isArray(surveyData.questions)) {
                console.warn("Survey data from server missing 'questions' array, initializing as empty.");
                surveyData.questions = [];
            }
            setSurvey(surveyData);

            // --- Process Questions Response ---
            if (!questionsResponse.ok) {
                let errorMsg = `Failed questions fetch: ${questionsResponse.status}`;
                try { const errData = await questionsResponse.json(); errorMsg = errData.message || errorMsg; } catch (e) {}
                throw new Error(errorMsg);
             }
            const questionsData = await questionsResponse.json();
            console.log("All questions data received:", questionsData);
            if (!Array.isArray(questionsData)) { throw new Error("Invalid questions data format received."); }
            setAllQuestions(questionsData);

            console.log("AdminSurveyDetailPage: Data fetched successfully.");
            // Optional: Toast for successful fetch (can be noisy)
            // toast.info("Survey data loaded.");

        } catch (err) {
            console.error("AdminSurveyDetailPage: Error fetching data:", err);
            const errorMsg = err.message || "Failed to load survey or question data.";
            // --- Use setFetchError ---
            setFetchError(errorMsg);
            // --- Use toast for fetch error ---
            toast.error(`Error loading data: ${errorMsg}`);
            setSurvey(null); setAllQuestions([]);
        } finally {
            setLoading(false);
        }
        // --- Ensure surveyId is in dependency array ---
    }, [surveyId, apiUrl]); // Dependencies for useCallback

    // Fetch data when the component mounts or surveyId/apiUrl changes
    useEffect(() => {
        fetchData();
    }, [fetchData]); // fetchData depends on surveyId, so this is correct

    // --- State Update Handlers (Adjusted for populated questions) ---

    const handleStatusChange = (newStatus) => {
        console.log("Status select changed to:", newStatus);
        if (survey) {
            // Update the local state immediately for responsiveness
            setSurvey(prev => ({ ...prev, status: newStatus }));
            // We will save this change when the main "Save All Changes" button is clicked
        }
    };

    const handleQuestionAdd = (questionIdToAdd) => {
        console.log("Attempting to add question:", questionIdToAdd);
        if (survey) {
            // Find the full question object from the master list
            const questionToAdd = allQuestions.find(q => q._id === questionIdToAdd);
            if (questionToAdd && !survey.questions.some(q => q._id === questionIdToAdd)) {
                // Add the *full question object* to the local survey state
                setSurvey(prev => ({
                    ...prev,
                    questions: [...prev.questions, questionToAdd] // Add object
                }));
                toast.info(`"${questionToAdd.text.substring(0, 30)}..." added. Save changes to persist.`, { autoClose: 2500 }); // Quick feedback
            } else {
                console.warn("Question not found in allQuestions or already added.");
                toast.warn("Question not found or already added.");
            }
        }
    };

    const handleQuestionRemove = (questionIdToRemove) => {
        console.log("Attempting to remove question:", questionIdToRemove);
        if (survey) {
             const questionToRemove = survey.questions.find(q => q._id === questionIdToRemove);
            // Filter out the question object based on its _id
            setSurvey(prev => ({
                ...prev,
                questions: prev.questions.filter(q => q._id !== questionIdToRemove) // Filter objects by ID
            }));
            if (questionToRemove) {
                 toast.info(`"${questionToRemove.text.substring(0, 30)}..." removed. Save changes to persist.`, { autoClose: 2500 }); // Quick feedback
            }
        }
    };

    // --- Save Changes Function (Using Toastify) ---
    const handleSaveChanges = async () => {
        if (!survey) {
             toast.warn("No survey data loaded to save."); // Use toast for warning
             return;
        }
        // --- ADDED CHECK: Ensure surveyId is valid before saving ---
        if (!surveyId || surveyId === 'undefined') {
            toast.error("Cannot save: Invalid Survey ID.");
            return;
        }
        // --- END ADDED CHECK ---

        setSaving(true);
        // Clear fetch error message when attempting a save
        setFetchError(null);
        console.log("Saving changes for survey:", survey._id); // Use survey._id from loaded data

        // Extract only question IDs from the survey state for the PATCH request
        const questionIdsToSend = survey.questions.map(q => q._id);
        const dataToSend = {
            status: survey.status,
            questions: questionIdsToSend // Send array of IDs
        };
        console.log("Data to send:", dataToSend);

        try {
            // --- Use the validated surveyId from useParams ---
            const response = await fetch(`${apiUrl}/api/surveys/${surveyId}`, { // Use surveyId here
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataToSend), // Send status and array of question IDs
            });

            if (!response.ok) {
                let errorMsg = `Failed to save changes. Status: ${response.status}`;
                try { const errData = await response.json(); errorMsg = errData.message || errorMsg; } catch (e) {}
                throw new Error(errorMsg); // Throw error to be caught below
            }

            const updatedSurveyFromServer = await response.json();
            console.log("Survey updated successfully (server response):", updatedSurveyFromServer);

             // Initialize questions array if missing (robustness)
             if (!Array.isArray(updatedSurveyFromServer.questions)) {
                console.warn("Survey data from server (after save) missing 'questions' array, initializing as empty.");
                updatedSurveyFromServer.questions = [];
            }
            // Update local state with the response from the server
            setSurvey(updatedSurveyFromServer);

            // --- Use toast for success ---
            toast.success("Survey changes saved successfully!");
            // --- END ---

        } catch (err) {
            console.error("Error saving survey:", err);
            const errorMsg = err.message || "Failed to save changes.";

            // --- Use toast for error ---
            toast.error(`Save failed: ${errorMsg}`);
            // --- END ---

        } finally {
            setSaving(false);
        }
    };


    // --- Render Logic ---
    if (loading) {
        // Simple loading indicator, could be replaced with a spinner component
        return <div style={{ padding: '50px', textAlign: 'center', fontSize: '1.2em' }}>Loading survey details and questions...</div>;
    }

    // --- Display fetch error prominently if it occurred and prevents rendering ---
    if (fetchError && !survey) {
        return (
            <div style={styles.container}>
                {/* Error is already shown via toast, but keep a message here too */}
                <h2 style={{color: styles.error.color}}>Loading Failed</h2>
                {/* Display the actual fetchError message */}
                <p style={styles.error}>{fetchError}</p>
                <div style={{marginTop: '20px'}}>
                    <button onClick={fetchData} className="button button-secondary" style={{ marginRight: '10px' }}>Retry</button>
                    <Link to="/admin" className="button button-secondary">Back to Admin Dashboard</Link>
                </div>
            </div>
        );
    }

    if (!survey) {
        // Handle case where loading finished but survey is still null (e.g., 404 or unexpected issue)
        return (
            <div style={styles.container}>
                <p>Survey not found or data is unavailable.</p>
                 <div style={{marginTop: '20px'}}>
                    <Link to="/admin" className="button button-secondary">Back to Admin Dashboard</Link>
                 </div>
            </div>
        );
    }

    // --- Logic to determine available vs current questions ---
    // survey.questions is an array of objects
    const currentQuestionIds = new Set(survey.questions.map(q => q._id)); // Get IDs from objects
    const availableQuestions = allQuestions.filter(q => !currentQuestionIds.has(q._id));
    // We already have the full objects for current questions in survey.questions
    const currentQuestionObjects = survey.questions; // Directly use the populated array


    // --- Main Render ---
    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h1>Manage Survey: <span style={styles.headerSurveyTitle}>{survey.title}</span></h1>
                <Link to="/admin" className="button button-secondary">Back to Dashboard</Link>
            </div>

            {/* --- Survey Info & Status Side-by-Side Layout --- */}
            <div style={styles.infoStatusRow}>
                {/* Survey Info */}
                <div style={{...styles.section, ...styles.infoBox}}>
                     <h2 style={styles.sectionTitle}>Details</h2>
                     <p><strong>Description:</strong> {survey.description || <span style={{color: '#888'}}>N/A</span>}</p>
                     <p><strong>ID:</strong> <code style={styles.codeText}>{survey._id}</code></p>
                     <div style={{marginTop: '15px'}}>
                        {/* Use button-small if defined globally, otherwise relies on default */}
                        {/* Ensure surveyId is correct here too */}
                        <Link to={`/admin/surveys/${surveyId}/edit`} className="button button-small button-secondary" style={{marginRight: '10px'}}>Edit Title/Desc</Link>
                        <Link to={`/admin/surveys/${surveyId}/results`} className="button button-small button-secondary">View Results</Link>
                     </div>
                </div>

                {/* Status Management */}
                <div style={{...styles.section, ...styles.statusBox}}>
                     <h2 style={styles.sectionTitle}>Status</h2>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap', marginBottom: '10px' }}>
                        <span>Current: <strong style={getStatusStyle(survey.status)}>{survey.status}</strong></span>
                        <div style={{display: 'flex', alignItems: 'center', gap: '5px'}}>
                            <label htmlFor="status-select">Change:</label>
                            <select
                                id="status-select"
                                value={survey.status}
                                onChange={(e) => handleStatusChange(e.target.value)}
                                disabled={saving || loading}
                                style={{ padding: '5px 8px', border: '1px solid #ccc', borderRadius: '4px' }} // Basic styling for select
                            >
                                <option value="draft">Draft</option>
                                <option value="active">Active</option>
                                <option value="closed">Closed</option>
                            </select>
                        </div>
                     </div>
                     <p style={styles.helpText}>(Change saved via "Save All Changes" button below)</p>
                </div>
            </div>


            {/* --- Question Management Section --- */}
            <div style={styles.section}>
                <h2 style={styles.sectionTitle}>Manage Questions</h2>
                <div style={styles.questionColumnsContainer}>
                     {/* Column 1: Current Questions */}
                     <div style={styles.questionColumn}>
                         <h3 style={styles.columnTitle}>Questions in this Survey ({currentQuestionObjects.length})</h3>
                         {currentQuestionObjects.length === 0 ? (
                             <p style={styles.emptyListText}>No questions added yet. Add from the list on the right.</p>
                         ) : (
                             <ul style={styles.questionList}>
                                 {currentQuestionObjects.map((q, index) => (
                                     <li key={q._id} style={ index === currentQuestionObjects.length - 1 ? {...styles.questionListItem, borderBottom: 'none'} : styles.questionListItem }>
                                         <span style={styles.questionText}>{q.text} <span style={styles.questionType}>({q.type})</span></span>
                                         {/* Use button-small if defined globally */}
                                         <button onClick={() => handleQuestionRemove(q._id)} disabled={saving || loading} className="button button-small button-danger" title="Remove from survey"> Remove </button>
                                     </li>
                                 ))}
                             </ul>
                         )}
                     </div>

                    {/* Column 2: Available Questions */}
                     <div style={styles.questionColumn}>
                         <h3 style={styles.columnTitle}>Available Questions ({availableQuestions.length})</h3>
                         {loading && allQuestions.length === 0 && <p style={styles.loadingText}>Loading available questions...</p>}
                         {!loading && availableQuestions.length === 0 && allQuestions.length > 0 && (<p style={styles.emptyListText}>All available questions are already in this survey.</p>)}
                         {!loading && availableQuestions.length === 0 && allQuestions.length === 0 && (<p style={styles.emptyListText}>No other questions found in the system.</p>)}
                         {availableQuestions.length > 0 && (
                             <ul style={styles.questionList}>
                                 {availableQuestions.map((q, index) => (
                                     <li key={q._id} style={ index === availableQuestions.length - 1 ? {...styles.questionListItem, borderBottom: 'none'} : styles.questionListItem }>
                                         <span style={styles.questionText}>{q.text} <span style={styles.questionType}>({q.type})</span></span>
                                          {/* Use button-small if defined globally */}
                                         <button onClick={() => handleQuestionAdd(q._id)} disabled={saving || loading} className="button button-small button-primary" title="Add to survey"> Add </button>
                                     </li>
                                 ))}
                             </ul>
                         )}
                         <div style={{marginTop: '15px', textAlign: 'right'}}> {/* Align button */}
                             {/* Use button-small if defined globally */}
                            <Link to="/admin/questions/new" className="button button-secondary button-small">Create New Question</Link>
                         </div>
                     </div>
                 </div>
            </div>

            {/* --- Save Button Footer --- */}
            <div style={styles.footer}>
                 {/* Use button-large if defined globally */}
                 <button onClick={handleSaveChanges} disabled={saving || loading} className="button button-primary button-large"> {saving ? 'Saving...' : 'Save All Changes'} </button>
                 {/* Use button-large if defined globally */}
                 <button onClick={fetchData} disabled={saving || loading} className="button button-secondary button-large" style={{marginLeft: '15px'}}> Cancel / Reset Changes </button>
                 {saving && <span style={styles.savingIndicator}>Please wait...</span>} {/* Optional saving indicator */}
            </div>
         </div>
     );
 }

 // --- Helper Functions ---

 // Function to get dynamic style for status badge
const getStatusStyle = (status) => {
    const baseStyle = {
        padding: '4px 10px', // Slightly larger padding
        borderRadius: '12px', // More rounded
        color: 'white',
        fontSize: '0.9em', // Slightly smaller font
        fontWeight: 'bold',
        display: 'inline-block',
        textTransform: 'capitalize',
        textAlign: 'center',
        minWidth: '60px', // Ensure minimum width
    };
    switch (status) {
        case 'active': return { ...baseStyle, backgroundColor: '#2ecc71' }; // Green
        case 'closed': return { ...baseStyle, backgroundColor: '#95a5a6' }; // Gray
        case 'draft':
        default:       return { ...baseStyle, backgroundColor: '#f39c12' }; // Orange
    }
};

 // --- Styles (Updated and Expanded from Step 8) ---
const styles = {
    container: {
        padding: '20px 30px',
        maxWidth: '1100px',
        margin: '20px auto',
        backgroundColor: '#f4f7f6',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        fontFamily: 'Arial, sans-serif',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '2px solid #dce3e0',
        paddingBottom: '15px',
        marginBottom: '25px',
    },
    headerSurveyTitle: {
        color: '#333',
        fontWeight: 'normal',
        fontSize: '0.9em', // Make title slightly smaller than "Manage Survey"
        marginLeft: '5px',
    },
    infoStatusRow: {
        display: 'flex',
        gap: '20px',
        marginBottom: '25px',
        flexWrap: 'wrap',
    },
    infoBox: {
        flex: '2 1 400px',
    },
    statusBox: {
        flex: '1 1 250px',
        display: 'flex',
        flexDirection: 'column',
        // Removed justify-content center to allow natural flow
    },
    section: {
        backgroundColor: '#ffffff',
        border: '1px solid #e0e0e0',
        borderRadius: '6px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        padding: '20px 25px',
    },
    sectionTitle: {
        marginTop: '0',
        marginBottom: '15px',
        fontSize: '1.15em',
        color: '#444',
        borderBottom: '1px solid #eee',
        paddingBottom: '8px',
    },
    codeText: {
        fontFamily: 'monospace',
        backgroundColor: '#eef1f0',
        padding: '2px 5px',
        borderRadius: '3px',
        fontSize: '0.9em',
        color: '#555',
    },
    helpText: {
        fontSize: '0.85em',
        color: '#666',
        marginTop: 'auto', // Pushes help text down in the flex column for statusBox
        paddingTop: '10px', // Add some space above it
    },
    questionColumnsContainer: {
        display: 'flex',
        gap: '25px',
        flexWrap: 'wrap',
    },
    questionColumn: {
        flex: '1 1 350px',
        backgroundColor: '#f9fbfb',
        padding: '15px 20px',
        borderRadius: '5px',
        border: '1px solid #e8e8e8',
        display: 'flex', // Use flex column for better control
        flexDirection: 'column', // Stack title, list, button vertically
    },
    columnTitle: {
        marginTop: '0',
        marginBottom: '15px',
        fontSize: '1.05em',
        color: '#555',
        flexShrink: 0, // Prevent title from shrinking
    },
    questionList: {
        listStyle: 'none',
        padding: 0,
        margin: 0,
        maxHeight: '350px',
        minHeight: '150px',
        overflowY: 'auto',
        border: '1px solid #e0e0e0',
        borderRadius: '4px',
        backgroundColor: '#fff',
        flexGrow: 1, // Allow list to take up available vertical space
        marginBottom: '15px', // Space between list and "Create New" button
    },
    questionListItem: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 15px',
        borderBottom: '1px solid #f0f0f0',
        fontSize: '0.95em',
    },
    questionText: {
        marginRight: '10px',
        flexGrow: 1,
        lineHeight: '1.4', // Improve readability
    },
    questionType: {
        fontSize: '0.85em',
        color: '#777',
        marginLeft: '5px',
        whiteSpace: 'nowrap', // Prevent type from wrapping
    },
    emptyListText: {
        color: '#777',
        fontStyle: 'italic',
        textAlign: 'center',
        padding: '20px',
        backgroundColor: '#f0f0f0', // Light background for empty state
        borderRadius: '4px',
        flexGrow: 1, // Allow empty text to fill space if list is empty
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100px', // Ensure it has some height
    },
    loadingText: {
        color: '#555',
        textAlign: 'center',
        padding: '20px',
    },
    footer: {
        marginTop: '30px',
        paddingTop: '20px',
        borderTop: '1px solid #dce3e0',
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap', // Allow buttons to wrap on small screens
        gap: '15px', // Add gap between footer items
    },
    savingIndicator: {
        color: '#555',
        fontStyle: 'italic',
        fontSize: '0.9em',
    },
    error: { // Style for fetch error message display
        color: '#c0392b', // Error red color
        fontWeight: 'bold',
        marginBottom: '10px',
    },
    // Define basic button size styles here if not globally defined in App.css
    // Example (adjust padding/font-size as needed):
    // '.button-small': { padding: '5px 10px', fontSize: '0.85em' },
    // '.button-large': { padding: '10px 20px', fontSize: '1em' },
};

export default AdminSurveyDetailPage;
// ----- END OF COMPLETE UPDATED FILE -----