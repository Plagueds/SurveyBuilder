// frontend/src/pages/AdminPage.js
// ----- START OF COMPLETE UPDATED FILE -----
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import surveyApi from '../api/surveyApi';

const formatDate = (dateString) => {
   if (!dateString) return 'N/A';
   try { return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); } catch (e) { return 'Invalid Date'; }
};

function AdminPage() {
   const [surveys, setSurveys] = useState([]);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState(null);
   const [newSurveyTitle, setNewSurveyTitle] = useState('');
   const [isSubmitting, setIsSubmitting] = useState(false); // General submitting state for async operations

   const navigate = useNavigate();

   const fetchSurveys = useCallback(async () => {
       console.log("AdminPage: Fetching surveys...");
       setLoading(true); setError(null);
       try {
           const responseData = await surveyApi.getAllSurveys(); // Fetches all surveys for admin
           console.log("AdminPage: Raw response from getAllSurveys:", responseData);

           if (responseData && responseData.success && Array.isArray(responseData.data)) {
               setSurveys(responseData.data);
               console.log("AdminPage: Surveys set:", responseData.data);
           } else if (Array.isArray(responseData)) {
               setSurveys(responseData);
               console.log("AdminPage: Surveys set (direct array):", responseData);
           } else {
               const message = responseData?.message || "Failed to retrieve surveys or data is in an unexpected format.";
               console.warn("AdminPage: Unexpected data structure for surveys or operation not successful.", responseData);
               setError(message);
               toast.error(message);
               setSurveys([]);
           }
       } catch (err) {
           console.error("AdminPage: Failed to fetch surveys:", err);
           const errorMessage = err.response?.data?.message || err.message || "Could not load surveys.";
           setError(errorMessage);
           toast.error(errorMessage);
           setSurveys([]);
       } finally {
           setLoading(false);
           console.log("AdminPage: Finished fetching surveys.");
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
       console.log(`AdminPage: Creating survey with title: ${newSurveyTitle}`);
       setIsSubmitting(true); setError(null);
       try {
           const createdSurveyResponse = await surveyApi.createSurvey({ title: newSurveyTitle.trim() });
           const createdSurvey = createdSurveyResponse.data || createdSurveyResponse; // surveyApi.createSurvey returns { success, data }

           if (!createdSurvey || !createdSurvey._id) {
             console.error("AdminPage: Survey creation response missing survey data or _id.", createdSurveyResponse);
             throw new Error("Survey creation did not return a valid survey object.");
           }

           console.log('AdminPage: New survey created:', createdSurvey);
           toast.success(`Survey "${createdSurvey.title}" created successfully! Redirecting to build page...`);
           setNewSurveyTitle('');
           navigate(`/admin/surveys/${createdSurvey._id}/build`);
       } catch (err) {
           console.error("AdminPage: Failed to create survey:", err);
           const errorMessage = err.response?.data?.message || err.message || "Error creating survey.";
           setError(errorMessage);
           toast.error(errorMessage);
       } finally {
            setIsSubmitting(false);
       }
   };

   const handleDeleteSurvey = async (surveyId, surveyTitle) => {
       if (!window.confirm(`Are you sure you want to delete the survey "${surveyTitle}"? This action cannot be undone.`)) { return; }
       console.log(`AdminPage: Attempting to delete survey ID: ${surveyId}`);
       setIsSubmitting(true);
       try {
           await surveyApi.deleteSurvey(surveyId);
           toast.success(`Survey "${surveyTitle}" deleted successfully.`);
           fetchSurveys(); // Refresh the list
       } catch (err) {
           console.error(`AdminPage: Failed to delete survey ${surveyId}:`, err);
           const errorMessage = err.response?.data?.message || err.message || "Error deleting survey.";
           toast.error(errorMessage);
       } finally {
           setIsSubmitting(false);
       }
   };

   const handleStatusChange = async (surveyId, newStatus) => {
       console.log(`AdminPage: Changing status for survey ${surveyId} to ${newStatus}`);
       const originalSurveys = surveys.map(s => ({...s})); // Create a shallow copy of each survey object for potential revert
       
       // Optimistic UI Update
       setSurveys(prevSurveys =>
           prevSurveys.map(s => s._id === surveyId ? { ...s, status: newStatus } : s)
       );
       setIsSubmitting(true); // Disable inputs during update

       try {
           // Use updateSurveyStructure as it's defined in surveyApi.js for PATCH /surveys/:id
           const updatedSurveyResponse = await surveyApi.updateSurveyStructure(surveyId, { status: newStatus });
           const updatedSurvey = updatedSurveyResponse.data || updatedSurveyResponse; // surveyApi functions usually return { success, data }

           if (!updatedSurvey || !updatedSurvey.status) {
             console.error("AdminPage: Status update response missing survey data or status.", updatedSurveyResponse);
             throw new Error("Status update did not return a valid survey object with status.");
           }

           console.log('AdminPage: Status updated successfully:', updatedSurvey);
           toast.success(`Survey status updated to ${updatedSurvey.status}.`);
           // Update with server-confirmed data, merging to preserve other potential fields
           setSurveys(prevSurveys =>
               prevSurveys.map(s => s._id === surveyId ? { ...s, ...updatedSurvey } : s)
           );
       } catch (err) {
           console.error(`AdminPage: Failed to update status for survey ${surveyId}:`, err);
           const errorMessage = err.response?.data?.message || err.message || "Error updating status.";
           toast.error(errorMessage);
           setSurveys(originalSurveys); // Revert optimistic update on error
       } finally {
           setIsSubmitting(false);
       }
   };

   return (
       <div>
           <h1>Admin Dashboard</h1>
           <p>Create, build, and manage surveys.</p>

           <div style={{
               marginBottom: '30px',
               display: 'flex',
               flexWrap: 'wrap',
               gap: '10px',
               borderBottom: `1px solid var(--border-color)`,
               paddingBottom: '15px'
           }}>
               <Link to="/" className="button button-secondary"> Go to Survey Taker (Home) </Link>
           </div>

           {error && (
               <p style={{
                   color: 'var(--error-text)',
                   backgroundColor: 'var(--error-bg)',
                   border: `1px solid var(--error-border)`,
                   padding: '10px',
                   margin: '10px 0',
                   borderRadius: 'var(--border-radius-sm, 4px)'
               }}>
                   Error: {error}
               </p>
           )}

           <div style={{
               border: `1px solid var(--border-color)`,
               padding: '20px',
               marginBottom: '30px',
               borderRadius: 'var(--border-radius, 8px)',
               backgroundColor: 'var(--background-accent)'
           }}>
               <h2>Create New Survey</h2>
               <form onSubmit={handleCreateSurvey} style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                   <input
                       type="text"
                       value={newSurveyTitle}
                       onChange={(e) => setNewSurveyTitle(e.target.value)}
                       placeholder="Enter new survey title"
                       style={{ flexGrow: 1, minWidth: '250px' }}
                       aria-label="New survey title"
                       disabled={isSubmitting}
                   />
                   <button type="submit" className="button button-primary" disabled={isSubmitting}>
                       {isSubmitting ? 'Creating...' : 'Create Survey'}
                   </button>
               </form>
           </div>

           <h2>Existing Surveys</h2>
           {loading && <p>Loading surveys list...</p>}
           {!loading && surveys.length === 0 && !error && (
               <p style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
                   No surveys found. Use the form above to add one!
               </p>
           )}
           {!loading && surveys.length > 0 && (
               <div className="question-list-container">
                   <table className="question-table">
                       <thead>
                           <tr><th>Title</th><th>Status</th><th>Created</th><th>Actions</th></tr>
                       </thead>
                       <tbody>
                           {surveys.map((survey) => (
                               <tr key={survey._id}>
                                   <td>{survey.title}</td>
                                   <td>
                                       <select
                                           value={survey.status}
                                           onChange={(e) => handleStatusChange(survey._id, e.target.value)}
                                           disabled={isSubmitting}
                                           style={{
                                               padding: '5px 8px',
                                               borderRadius: 'var(--border-radius-sm)',
                                               border: '1px solid var(--input-border)',
                                               backgroundColor: 'var(--input-bg)',
                                               color: 'var(--input-text)',
                                               cursor: 'pointer'
                                           }}
                                           aria-label={`Status for survey ${survey.title}`}
                                       >
                                           <option value="draft">Draft</option>
                                           <option value="active">Active</option>
                                           <option value="closed">Closed</option>
                                           {/* <option value="archived">Archived</option> */} {/* Add if you want users to set this status */}
                                       </select>
                                   </td>
                                   <td>{formatDate(survey.createdAt)}</td>
                                   <td>
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
       </div>
   );
}

export default AdminPage;
// ----- END OF COMPLETE UPDATED FILE -----