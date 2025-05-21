// frontend/src/api/surveyApi.js
// ----- START OF UPDATED FILE (vNext9 - Added resumeSurveyWithCode) -----
import axios from 'axios';

// ... (envApiBaseUrl, effectiveApiRoutesBaseUrl, effectivePublicAccessRootUrl setup - same as before) ...
const envApiBaseUrl = process.env.REACT_APP_API_BASE_URL;
let effectiveApiRoutesBaseUrl;
let effectivePublicAccessRootUrl;

if (envApiBaseUrl) {
    effectiveApiRoutesBaseUrl = envApiBaseUrl;
    console.log(`[surveyApi] Using API base URL from environment: ${effectiveApiRoutesBaseUrl}`);
    try {
        const url = new URL(effectiveApiRoutesBaseUrl);
        effectivePublicAccessRootUrl = `${url.protocol}//${url.host}`;
    } catch (e) {
        console.error(
            "[surveyApi] Could not parse REACT_APP_API_BASE_URL to derive root URL. " +
            "Ensure it's a valid URL (e.g., https://domain.com/api). " +
            "Falling back for public access root URL.", e
        );
        effectivePublicAccessRootUrl = 'https://surveybuilderapi.onrender.com'; // Fallback if parsing fails
    }
} else {
    console.warn(
        "[surveyApi] REACT_APP_API_BASE_URL is not defined. " +
        "Falling back to 'http://localhost:3001/api' for API routes and 'http://localhost:3001' for public access. " +
        "Ensure REACT_APP_API_BASE_URL is set in your .env file for local development " +
        "and in Netlify environment variables for production."
    );
    effectiveApiRoutesBaseUrl = 'http://localhost:3001/api';
    effectivePublicAccessRootUrl = 'http://localhost:3001';
}
console.log(`[surveyApi] Effective API Routes Base URL: ${effectiveApiRoutesBaseUrl}`);
console.log(`[surveyApi] Effective Public Access Root URL: ${effectivePublicAccessRootUrl}`);


const apiClient = axios.create({ /* ... same as before ... */ baseURL: effectiveApiRoutesBaseUrl, headers: { 'Content-Type': 'application/json', }, });
apiClient.interceptors.request.use( /* ... same as before ... */ (config) => { const token = localStorage.getItem('token'); if (token) { config.headers['Authorization'] = `Bearer ${token}`; } if (config.surveyPassword) { config.headers['X-Survey-Password'] = config.surveyPassword; } const isSubmitRequest = config.url && config.url.includes('/submit') && config.method && config.method.toLowerCase() === 'post'; if (isSubmitRequest) { console.log('[AXIOS INTERCEPTOR - SUBMIT REQUEST DETAILS]'); console.log('  Axios config.baseURL:', config.baseURL); console.log('  Axios config.url (path relative to baseURL):', config.url); let fullUrl = config.baseURL; if (config.baseURL && config.baseURL.endsWith('/') && config.url && config.url.startsWith('/')) { fullUrl = config.baseURL + config.url.substring(1); } else if (config.baseURL && !config.baseURL.endsWith('/') && config.url && !config.url.startsWith('/')) { fullUrl = config.baseURL + '/' + config.url; } else { fullUrl = (config.baseURL || '') + (config.url || ''); } console.log('  Full URL being requested by Axios (constructed):', fullUrl); console.log('  Axios config.method:', config.method); console.log('  Axios config.data (payload):', config.data); } return config; }, (error) => { return Promise.reject(error); });
apiClient.interceptors.response.use( /* ... same as before ... */ (response) => response, (error) => { if (error.response && error.response.status === 401) { if (error.response.data && error.response.data.requiresPassword) { console.warn('[surveyApi] Survey requires password or password incorrect.'); } else if (error.config.url && !error.config.url.endsWith('/auth/login') && !error.config.url.endsWith('/auth/register')) { console.warn('[surveyApi] Unauthorized (401) response. Token might be invalid or expired. Logging out.'); localStorage.removeItem('token'); localStorage.removeItem('user'); } } return Promise.reject(error); });
const handleApiError = (error, functionName) => { /* ... same as before ... */ if (axios.isCancel(error) || error.name === 'AbortError') { console.log(`[surveyApi] ${functionName} request was aborted:`, error.message); } else { console.error(`[surveyApi] Error in ${functionName}:`, error.response?.data || error.message); if (error.response && (functionName.includes('update') || functionName.includes('create') || functionName.includes('delete'))) { console.error(`[surveyApi] Full error response for ${functionName}: Status ${error.response.status}`, error.response.data); } } const errToThrow = error.response?.data || error; if (typeof errToThrow === 'string') { throw new Error(errToThrow); } throw errToThrow; };

// --- Survey Endpoints ---
const getAllSurveys = async (options = {}) => { /* ... same as before ... */ try { const params = options.status ? { status: options.status } : {}; const response = await apiClient.get('/surveys', { params, signal: options.signal }); return response.data; } catch (error) { return handleApiError(error, 'getAllSurveys'); } };
const createSurvey = async (surveyData, options = {}) => { /* ... same as before ... */ try { const response = await apiClient.post('/surveys', surveyData, { signal: options.signal }); return response.data; } catch (error) { return handleApiError(error, 'createSurvey'); } };
const getSurveyById = async (surveyId, options = {}) => { /* ... same as before ... */ try { const { signal, surveyPassword, ...queryParams } = options; const config = { params: queryParams, signal: signal, }; if (surveyPassword) { config.surveyPassword = surveyPassword; } const response = await apiClient.get(`/surveys/${surveyId}`, config); return response.data; } catch (error) { return handleApiError(error, `getSurveyById (${surveyId})`); } };
const updateSurvey = async (surveyId, surveyData, options = {}) => { /* ... same as before ... */ try { const response = await apiClient.patch(`/surveys/${surveyId}`, surveyData, { signal: options.signal }); return response.data; } catch (error) { return handleApiError(error, `updateSurvey (${surveyId})`); } };
const updateSurveyStructure = async (surveyId, surveyStructureData, options = {}) => { /* ... same as before ... */ try { const response = await apiClient.patch(`/surveys/${surveyId}/structure`, surveyStructureData, { signal: options.signal }); return response.data; } catch (error) { return handleApiError(error, `updateSurveyStructure (${surveyId})`); } };
const deleteSurvey = async (surveyId, options = {}) => { /* ... same as before ... */ try { const response = await apiClient.delete(`/surveys/${surveyId}`, { signal: options.signal }); return response.data; } catch (error) { return handleApiError(error, `deleteSurvey (${surveyId})`); } };

// --- Question Endpoints ---
const createQuestion = async (questionData, options = {}) => { /* ... same as before ... */ try { const response = await apiClient.post('/questions', questionData, { signal: options.signal }); return response.data; } catch (error) { return handleApiError(error, 'createQuestion'); } };
const updateQuestionContent = async (questionId, updates, options = {}) => { /* ... same as before ... */ try { const response = await apiClient.patch(`/questions/${questionId}`, updates, { signal: options.signal }); return response.data; } catch (error) { return handleApiError(error, `updateQuestionContent (${questionId})`); } };
const deleteQuestionById = async (questionId, options = {}) => { /* ... same as before ... */ try { const response = await apiClient.delete(`/questions/${questionId}`, { signal: options.signal }); return response.data; } catch (error) { return handleApiError(error, `deleteQuestionById (${questionId})`); } };

// --- Survey Submission and Results Endpoints ---
const submitSurveyAnswers = async (surveyId, submissionData, options = {}) => { /* ... same as before ... */ try { const response = await apiClient.post(`/surveys/${surveyId}/submit`, submissionData, { signal: options.signal }); return response.data; } catch (error) { return handleApiError(error, `submitSurveyAnswers (${surveyId})`); } };
const savePartialResponse = async (surveyId, partialData, options = {}) => { /* ... same as before ... */ try { const response = await apiClient.post(`/surveys/${surveyId}/save-partial`, partialData, { signal: options.signal }); return response.data; } catch (error) { return handleApiError(error, `savePartialResponse (${surveyId})`); } };
const getSurveyResults = async (surveyId, options = {}) => { /* ... same as before ... */ try { const { signal, ...queryParams } = options; const response = await apiClient.get(`/surveys/${surveyId}/results`, { params: queryParams, signal: signal }); return response.data; } catch (error) { return handleApiError(error, `getSurveyResults (${surveyId})`); } };
const exportSurveyResults = async (surveyId, options = {}) => { /* ... same as before ... */ try { const { signal, format = 'csv', ...queryParams } = options; const response = await apiClient.get(`/surveys/${surveyId}/export`, { params: { ...queryParams, format }, signal: signal, responseType: format.toLowerCase() === 'csv' ? 'blob' : 'json' }); if (format.toLowerCase() === 'csv') { return { data: response.data, contentType: response.headers['content-type'], filename: `survey_${surveyId}_results.csv` }; } return response.data; } catch (error) { return handleApiError(error, `exportSurveyResults (${surveyId})`); } };

// --- Auth Endpoints ---
const loginUser = async (credentials, options = {}) => { /* ... same as before ... */ try { const response = await apiClient.post('/auth/login', credentials, { signal: options.signal }); if (response.data.token) { localStorage.setItem('token', response.data.token); if (response.data.user) { localStorage.setItem('user', JSON.stringify(response.data.user)); } } return response.data; } catch (error) { return handleApiError(error, 'loginUser'); } };
const registerUser = async (userData, options = {}) => { /* ... same as before ... */ try { const response = await apiClient.post('/auth/register', userData, { signal: options.signal }); if (response.data.token) { localStorage.setItem('token', response.data.token); if (response.data.user) { localStorage.setItem('user', JSON.stringify(response.data.user)); } } return response.data; } catch (error) { return handleApiError(error, 'registerUser'); } };
const logoutUser = () => { /* ... same as before ... */ localStorage.removeItem('token'); localStorage.removeItem('user'); };
const getMe = async (options = {}) => { /* ... same as before ... */ try { const { signal, ...queryParams } = options; const response = await apiClient.get('/auth/me', { params: queryParams, signal: signal }); return response.data; } catch (error) { return handleApiError(error, 'getMe'); } };

// --- Collector Endpoints ---
const getCollectorsForSurvey = async (surveyId, options = {}) => { /* ... same as before ... */ try { const { signal, ...queryParams } = options; const response = await apiClient.get(`/surveys/${surveyId}/collectors`, { params: queryParams, signal: signal }); return response.data; } catch (error) { return handleApiError(error, `getCollectorsForSurvey (${surveyId})`); } };
const createCollector = async (surveyId, collectorData, options = {}) => { /* ... same as before ... */ try { const response = await apiClient.post(`/surveys/${surveyId}/collectors`, collectorData, { signal: options.signal }); return response.data; } catch (error) { return handleApiError(error, `createCollector (${surveyId})`); } };
const updateCollector = async (surveyId, collectorId, collectorData, options = {}) => { /* ... same as before ... */ try { const response = await apiClient.put(`/surveys/${surveyId}/collectors/${collectorId}`, collectorData, { signal: options.signal }); return response.data; } catch (error) { return handleApiError(error, `updateCollector (${collectorId})`); } };
const deleteCollector = async (surveyId, collectorId, options = {}) => { /* ... same as before ... */ try { const response = await apiClient.delete(`/surveys/${surveyId}/collectors/${collectorId}`, { signal: options.signal }); return response.data; } catch (error) { return handleApiError(error, `deleteCollector (${collectorId})`); } };

// --- Public Survey Access Endpoint ---
const accessPublicSurvey = async (accessIdentifier, password = null, options = {}) => { /* ... same as before ... */ try { const publicAccessClient = axios.create({ baseURL: effectivePublicAccessRootUrl }); const config = { signal: options.signal }; const payload = password ? { password } : {}; console.log(`[surveyApi] Calling POST ${effectivePublicAccessRootUrl}/s/${accessIdentifier}`); const response = await publicAccessClient.post(`/s/${accessIdentifier}`, payload, config); return response.data; } catch (error) { if (axios.isCancel(error) || error.name === 'AbortError') { console.log(`[surveyApi] accessPublicSurvey (${accessIdentifier}) request was aborted:`, error.message); } else { console.error(`[surveyApi] Error accessing public survey ${accessIdentifier}:`, error.response?.data || error.message); if (error.response) { console.error(`[surveyApi] Full error response for accessPublicSurvey ${accessIdentifier}: Status ${error.response.status}`, error.response.data); } } throw error.response?.data || error; } };

// +++ NEW: Resume Survey with Code Endpoint +++
const resumeSurveyWithCode = async (accessIdentifier, resumeCode, options = {}) => {
    try {
        // Using the publicAccessClient as this is an unauthenticated public action
        const publicAccessClient = axios.create({ baseURL: effectivePublicAccessRootUrl });
        const config = { signal: options.signal };
        const payload = { resumeCode };

        console.log(`[surveyApi] Calling POST ${effectivePublicAccessRootUrl}/s/${accessIdentifier}/resume with code.`);
        // The backend will need a route like /s/:accessIdentifier/resume (POST)
        const response = await publicAccessClient.post(`/s/${accessIdentifier}/resume`, payload, config);
        // Expected response: { success: true, data: { surveyId, collectorId, surveyTitle, collectorSettings, partialResponse: {...} } }
        return response.data;
    } catch (error) {
        // Using handleApiError structure for consistency, though it's a public client
        if (axios.isCancel(error) || error.name === 'AbortError') {
            console.log(`[surveyApi] resumeSurveyWithCode (${accessIdentifier}) request was aborted:`, error.message);
        } else {
            console.error(`[surveyApi] Error resuming survey with code ${accessIdentifier}:`, error.response?.data || error.message);
            if (error.response) {
                console.error(`[surveyApi] Full error response for resumeSurveyWithCode ${accessIdentifier}: Status ${error.response.status}`, error.response.data);
            }
        }
        throw error.response?.data || error; // Re-throw for the component to handle
    }
};


const surveyApiFunctions = {
    getAllSurveys, createSurvey, getSurveyById,
    updateSurvey,
    updateSurveyStructure,
    deleteSurvey,
    createQuestion, updateQuestionContent, deleteQuestionById,
    submitSurveyAnswers,
    savePartialResponse,
    resumeSurveyWithCode, // <<< ADDED HERE
    getSurveyResults, exportSurveyResults,
    loginUser, registerUser, logoutUser, getMe,
    getCollectorsForSurvey, createCollector, updateCollector, deleteCollector,
    accessPublicSurvey,
};

export default surveyApiFunctions;
// ----- END OF UPDATED FILE (vNext9 - Added resumeSurveyWithCode) -----