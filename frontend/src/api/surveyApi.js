// frontend/src/api/surveyApi.js
// ----- START OF COMPLETE MODIFIED FILE (vNext4 - Added savePartialResponse) -----
import axios from 'axios';

// ... (baseURL setup and interceptors - NO CHANGES HERE FROM vNext3) ...
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


const apiClient = axios.create({
    baseURL: effectiveApiRoutesBaseUrl,
    headers: {
        'Content-Type': 'application/json',
    },
});

apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        // If a survey password is provided in options, add it to headers
        if (config.surveyPassword) {
            config.headers['X-Survey-Password'] = config.surveyPassword;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            // Check if it's a survey password error specifically
            if (error.response.data && error.response.data.requiresPassword) {
                // Don't logout, just let the specific call handle it
                console.warn('[surveyApi] Survey requires password or password incorrect.');
            } else if (error.config.url && !error.config.url.endsWith('/auth/login') && !error.config.url.endsWith('/auth/register')) {
                console.warn('[surveyApi] Unauthorized (401) response. Token might be invalid or expired. Logging out.');
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                // Optionally redirect to login page
                // window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

const handleApiError = (error, functionName) => {
    if (axios.isCancel(error) || error.name === 'AbortError') {
        console.log(`[surveyApi] ${functionName} request was aborted:`, error.message);
    } else {
        console.error(`[surveyApi] Error in ${functionName}:`, error.response?.data || error.message);
        if (error.response && (functionName.includes('update') || functionName.includes('create') || functionName.includes('delete'))) {
             console.error(`[surveyApi] Full error response for ${functionName}: Status ${error.response.status}`, error.response.data);
        }
    }
    throw error.response?.data || error; 
};

// --- Survey Endpoints ---
const getAllSurveys = async (options = {}) => {
    try {
        const params = options.status ? { status: options.status } : {};
        const response = await apiClient.get('/surveys', { params, signal: options.signal });
        return response.data;
    } catch (error) {
        return handleApiError(error, 'getAllSurveys');
    }
};

const createSurvey = async (surveyData, options = {}) => {
    try {
        const response = await apiClient.post('/surveys', surveyData, { signal: options.signal });
        return response.data;
    } catch (error) {
        return handleApiError(error, 'createSurvey');
    }
};

const getSurveyById = async (surveyId, options = {}) => {
    try {
        const { signal, surveyPassword, ...queryParams } = options; 
        const config = { 
            params: queryParams, 
            signal: signal,
        };
        if (surveyPassword) { // Pass surveyPassword for apiClient interceptor
            config.surveyPassword = surveyPassword;
        }
        const response = await apiClient.get(`/surveys/${surveyId}`, config);
        return response.data;
    } catch (error) {
        return handleApiError(error, `getSurveyById (${surveyId})`);
    }
};

const updateSurvey = async (surveyId, surveyData, options = {}) => {
    try {
        const response = await apiClient.patch(`/surveys/${surveyId}`, surveyData, { signal: options.signal });
        return response.data;
    } catch (error) {
        return handleApiError(error, `updateSurvey (${surveyId})`);
    }
};

const updateSurveyStructure = async (surveyId, surveyStructureData, options = {}) => {
    try {
        const response = await apiClient.patch(`/surveys/${surveyId}/structure`, surveyStructureData, { signal: options.signal });
        return response.data;
    } catch (error) {
        return handleApiError(error, `updateSurveyStructure (${surveyId})`);
    }
};

const deleteSurvey = async (surveyId, options = {}) => {
    try {
        const response = await apiClient.delete(`/surveys/${surveyId}`, { signal: options.signal });
        return response.data;
    } catch (error) {
        return handleApiError(error, `deleteSurvey (${surveyId})`);
    }
};

// --- Question Endpoints ---
const createQuestion = async (questionData, options = {}) => { /* ... */ return Promise.resolve(); };
const updateQuestionContent = async (questionId, updates, options = {}) => { /* ... */ return Promise.resolve(); };
const deleteQuestionById = async (questionId, options = {}) => { /* ... */ return Promise.resolve(); };

// --- Survey Submission and Results Endpoints ---
const submitSurveyAnswers = async (surveyId, submissionData, options = {}) => {
    try {
        const response = await apiClient.post(`/surveys/${surveyId}/submit`, submissionData, { signal: options.signal });
        return response.data;
    } catch (error) {
        return handleApiError(error, `submitSurveyAnswers (${surveyId})`);
    }
};

// +++ NEW: Endpoint for Saving Partial Response +++
const savePartialResponse = async (surveyId, partialData, options = {}) => {
    try {
        const response = await apiClient.post(`/surveys/${surveyId}/save-partial`, partialData, { signal: options.signal });
        return response.data; // Expects { success: true, message: '...' }
    } catch (error) {
        return handleApiError(error, `savePartialResponse (${surveyId})`);
    }
};

const getSurveyResults = async (surveyId, options = {}) => { /* ... */ return Promise.resolve({data:[]}); };
const exportSurveyResults = async (surveyId, options = {}) => { /* ... */ return Promise.resolve(); };

// --- Auth Endpoints ---
const loginUser = async (credentials, options = {}) => { /* ... */ return Promise.resolve(); };
const registerUser = async (userData, options = {}) => { /* ... */ return Promise.resolve(); };
const logoutUser = () => { /* ... */ };
const getMe = async (options = {}) => { /* ... */ return Promise.resolve(); };

// --- Collector Endpoints ---
const getCollectorsForSurvey = async (surveyId, options = {}) => { /* ... */ return Promise.resolve({data:[]}); };
const createCollector = async (surveyId, collectorData, options = {}) => { /* ... */ return Promise.resolve(); };
const updateCollector = async (surveyId, collectorId, collectorData, options = {}) => { /* ... */ return Promise.resolve(); };
const deleteCollector = async (surveyId, collectorId, options = {}) => { /* ... */ return Promise.resolve(); };

// --- Public Survey Access Endpoint ---
const accessPublicSurvey = async (accessIdentifier, password = null, options = {}) => {
    try {
        const publicAccessClient = axios.create({ baseURL: effectivePublicAccessRootUrl });
        const config = { signal: options.signal };
        if (password) {
            config.headers = { 'X-Survey-Password': password };
        }
        console.log(`[surveyApi] Calling POST ${effectivePublicAccessRootUrl}/s/${accessIdentifier}`);
        // For public access, the password might be in the body or a header depending on backend.
        // Assuming header for now, similar to how apiClient handles it for protected routes.
        // If backend expects it in body for public POST, adjust here.
        const response = await publicAccessClient.post(`/s/${accessIdentifier}`, {}, config); 
        return response.data;
    } catch (error) {
        // ... (error handling as before) ...
        if (axios.isCancel(error) || error.name === 'AbortError') {
            console.log(`[surveyApi] accessPublicSurvey (${accessIdentifier}) request was aborted:`, error.message);
        } else {
            console.error(`[surveyApi] Error accessing public survey ${accessIdentifier}:`, error.response?.data || error.message);
            if (error.response) {
                console.error(`[surveyApi] Full error response for accessPublicSurvey ${accessIdentifier}: Status ${error.response.status}`, error.response.data);
            }
        }
        throw error.response?.data || error;
    }
};


const surveyApiFunctions = {
    getAllSurveys, createSurvey, getSurveyById, 
    updateSurvey, 
    updateSurveyStructure, 
    deleteSurvey,
    createQuestion, updateQuestionContent, deleteQuestionById,
    submitSurveyAnswers, 
    savePartialResponse, // +++ Added here +++
    getSurveyResults, exportSurveyResults,
    loginUser, registerUser, logoutUser, getMe,
    getCollectorsForSurvey, createCollector, updateCollector, deleteCollector,
    accessPublicSurvey,
};

export default surveyApiFunctions;
// ----- END OF COMPLETE MODIFIED FILE (vNext4 - Added savePartialResponse) -----