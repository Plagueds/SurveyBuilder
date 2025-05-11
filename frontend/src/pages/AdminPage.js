// frontend/src/pages/AdminPage.js
// ----- START OF COMPLETE MODIFIED FILE -----
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import surveyApi from '../api/surveyApi'; // Assuming this is surveyApiFunctions

const formatDate = (dateString) => {
   if (!dateString) return 'N/A';
   try { return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); } catch (e) { return 'Invalid Date'; }
};

function AdminPage() {
   const [surveys, setSurveys] = useState([]);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState(null);
   const [newSurveyTitle, setNewSurveyTitle] = useState('');
   const [isSubmitting, setIsSubmitting] = useState(false);

   const navigate = useNavigate();

   const fetchSurveys = useCallback(async () => {
       setLoading(true); setError(null);
       try {
           const responseData = await surveyApi.getAllSurveys();
           if (responseData && responseData.success && Array.isArray(responseData.data)) {
               setSurveys(responseData.data);
           } else if (Array.isArray(responseData)) { // Fallback for direct array response
               setSurveys(responseData);
           } else {
               const message = responseData?.message || "Failed to retrieve surveys or data is in an unexpected format.";
               setError(message); toast.error(message); setSurveys([]);
           }
       } catch (err) {
           const errorMessage = err.response?.data?.message || err.message || "Could not load surveys.";
           setError(errorMessage); toast.error(errorMessage); setSurveys([]);
       } finally {
           setLoading(false);
       }
   }, []);

   useEffect(() => {
       fetchSurveys();
   }, [fetchSurveys]);

   const handleCreateSurvey = async (e) => {
       e.preventDefault();
       if (!newSurveyTitle.trim()) {
           toast.warn("Survey title cannot be empty.");
           return;
       }
       setIsSubmitting(true); setError(null);
       try {
           const createdSurveyResponse = await surveyApi.createSurvey({ title: newSurveyTitle.trim() });
           const createdSurvey = createdSurveyResponse.data || createdSurveyResponse;

           if (!createdSurvey || !createdSurvey._id) {
             throw new Error("Survey creation did not return a valid survey object.");
           }
           toast.success(`Survey "${createdSurvey.title}" created! Redirecting...`);
           setNewSurveyTitle('');
           navigate(`/admin/surveys/${createdSurvey._id}/build`);
       } catch (err) {
           const errorMessage = err.response?.data?.message || err.message || "Error creating survey.";
           setError(errorMessage); toast.error(errorMessage);
       } finally {
            setIsSubmitting(false);
       }
   };

   const handleDeleteSurvey = async (surveyId, surveyTitle) => {
       if (!window.confirm(`Are you sure you want to delete "${surveyTitle}"? This cannot be undone.`)) { return; }
       setIsSubmitting(true);
       try {
           await surveyApi.deleteSurvey(surveyId);
           toast.success(`Survey "${surveyTitle}" deleted.`);
           fetchSurveys(); // Refresh
       } catch (err) {
           const errorMessage = err.response?.data?.message || err.message || "Error deleting survey.";
           toast.error(errorMessage);
       } finally {
           setIsSubmitting(false);
       }
   };

   const handleStatusChange = async (surveyId, newStatus) => {
       const originalSurveys = JSON.parse(JSON.stringify(surveys)); // Deep copy for revert
       setSurveys(prevSurveys =>
           prevSurveys.map(s => s._id === surveyId ? { ...s, status: newStatus } : s)
       );
       setIsSubmitting(true);
       try {
           const updatedSurveyResponse = await surveyApi.updateSurveyStructure(surveyId, { status: newStatus });
           const updatedSurvey = updatedSurveyResponse.data || updatedSurveyResponse;

           if (!updatedSurvey || !updatedSurvey.status) {
             throw new Error("Status update did not return valid survey data.");
           }
           toast.success(`Survey status updated to ${updatedSurvey.status}.`);
           setSurveys(prevSurveys => // Update with server-confirmed data
               prevSurveys.map(s => s._id === surveyId ? { ...s, ...updatedSurvey } : s)
           );
       } catch (err) {
           const errorMessage = err.response?.data?.message || err.message || "Error updating status.";
           toast.error(errorMessage);
           setSurveys(originalSurveys); // Revert
       } finally {
           setIsSubmitting(false);
       }
   };

   return (
       <div className="admin-page-container" style={{padding: '20px', maxWidth: '1000px', margin: '0 auto'}}>
           <h1>Admin Dashboard</h1>
           <p>Create, build, and manage surveys.</p>

           {error && (
               <p className="error-message-banner">Error: {error}</p>
           )}

           <div className="create-survey-section">
               <h2>Create New Survey</h2>
               <form onSubmit={handleCreateSurvey} className="create-survey-form">
                   <input
                       type="text"
                       value={newSurveyTitle}
                       onChange={(e) => setNewSurveyTitle(e.target.value)}
                       placeholder="Enter new survey title"
                       aria-label="New survey title"
                       disabled={isSubmitting}
                   />
                   <button type="submit" className="button button-primary" disabled={isSubmitting}>
                       {isSubmitting ? 'Creating...' : 'Create Survey'}
                   </button>
               </form>
           </div>

           <h2>Existing Surveys</h2>
           {loading && <p className="loading-text">Loading surveys list...</p>}
           {!loading && surveys.length === 0 && !error && (
               <p className="no-surveys-message">No surveys found. Use the form above to add one!</p>
           )}
           {!loading && surveys.length > 0 && (
               <div className="surveys-table-container">
                   <table className="surveys-table">
                       <thead>
                           <tr><th>Title</th><th>Status</th><th>Created</th><th>Actions</th></tr>
                       </thead>
                       <tbody>
                           {surveys.map((survey) => (
                               <tr key={survey._id}>
                                   <td data-label="Title">{survey.title}</td>
                                   <td data-label="Status">
                                       <select
                                           value={survey.status}
                                           onChange={(e) => handleStatusChange(survey._id, e.target.value)}
                                           disabled={isSubmitting}
                                           aria-label={`Status for survey ${survey.title}`}
                                       >
                                           <option value="draft">Draft</option>
                                           <option value="active">Active</option>
                                           <option value="closed">Closed</option>
                                       </select>
                                   </td>
                                   <td data-label="Created">{formatDate(survey.createdAt)}</td>
                                   <td data-label="Actions" className="actions-cell">
                                       {/* MODIFIED: Changed to Link for Preview */}
                                       <Link
                                           to={`/surveys/${survey._id}/preview`}
                                           className="button button-small button-info"
                                           style={{ marginRight: '5px' }}
                                           target="_blank" // Optional: open preview in new tab
                                           rel="noopener noreferrer" // If using target="_blank"
                                       >
                                           Preview
                                       </Link>
                                       <Link
                                           to={`/admin/surveys/${survey._id}/build`}
                                           className="button button-small button-primary"
                                           style={{ marginRight: '5px' }}
                                       >
                                           Build
                                       </Link>
                                       <Link
                                           to={`/admin/surveys/${survey._id}/results`}
                                           className="button button-small button-secondary"
                                           style={{ marginRight: '5px' }}
                                       >
                                           Results
                                       </Link>
                                       <button
                                           className="button button-small button-danger"
                                           onClick={() => handleDeleteSurvey(survey._id, survey.title)}
                                           disabled={isSubmitting}
                                       >
                                           Delete
                                       </button>
                                   </td>
                               </tr>
                           ))}
                       </tbody>
                   </table>
               </div>
           )}
           {/* Basic styling, you should move this to a CSS file for AdminPage */}
           <style jsx>{`
               .admin-page-container { padding: 20px; max-width: 1000px; margin: 0 auto; }
               .error-message-banner { color: red; background-color: #ffebeb; border: 1px solid red; padding: 10px; margin: 10px 0; border-radius: 4px; }
               .create-survey-section { border: 1px solid #ddd; padding: 20px; margin-bottom: 30px; border-radius: 8px; background-color: #f9f9f9; }
               .create-survey-form { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
               .create-survey-form input { flex-grow: 1; min-width: 250px; padding: 8px; border: 1px solid #ccc; border-radius: 4px; }
               .loading-text, .no-surveys-message { font-style: italic; color: #555; }
               .surveys-table-container { overflow-x: auto; }
               .surveys-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
               .surveys-table th, .surveys-table td { border: 1px solid #ddd; padding: 10px; text-align: left; }
               .surveys-table th { background-color: #f0f0f0; }
               .surveys-table td select { padding: 5px 8px; border-radius: 4px; border: 1px solid #ccc; }
               .actions-cell { display: flex; flex-wrap: wrap; gap: 5px; }
               .button { padding: 6px 12px; border-radius: 4px; text-decoration: none; cursor: pointer; border: none; font-size: 0.9em; }
               .button-primary { background-color: #007bff; color: white; }
               .button-secondary { background-color: #6c757d; color: white; }
               .button-danger { background-color: #dc3545; color: white; }
               .button-info { background-color: #17a2b8; color: white; } /* Added for Preview */
               .button-small { padding: 4px 8px; font-size: 0.8em; }
               @media (max-width: 768px) {
                   .surveys-table thead { display: none; }
                   .surveys-table tr { display: block; margin-bottom: 15px; border: 1px solid #ddd; }
                   .surveys-table td { display: block; text-align: right; border-bottom: 1px dotted #ccc; }
                   .surveys-table td::before { content: attr(data-label); float: left; font-weight: bold; text-transform: uppercase; }
                   .actions-cell { justify-content: flex-end; }
               }
           `}</style>
       </div>
   );
}

export default AdminPage;
// ----- END OF COMPLETE MODIFIED FILE -----