// frontend/src/api/surveyApi.js
// ----- START OF COMPLETE MODIFIED FILE (vNext - Fix getSurveyById params) -----
import axios from 'axios';

// This is expected to be the FULL BASE URL for your /api routes.
// In development (e.g., from .env): REACT_APP_API_BASE_URL=http://localhost:3001/api
// In production (e.g., in Netlify): REACT_APP_API_BASE_URL=https://surveybuilderapi.onrender.com/api
const envApiBaseUrl = process.env.REACT_APP_API_BASE_URL;

let effectiveApiRoutesBaseUrl; // For /api routes, e.g., http://localhost:3001/api
let effectivePublicAccessRootUrl; // For /s routes, e.g., http://localhost:3001

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
        effectivePublicAccessRootUrl = 'https://surveybuilderapi.onrender.com'; // Hardcoded production fallback
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
            if (error.config.url && !error.config.url.endsWith('/auth/login') && !error.config.url.endsWith('/auth/register')) {
                console.warn('[surveyApi] Unauthorized (401) response. Token might be invalid or expired. Logging out.');
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                // if (window.location.pathname !== '/login') {
                //     window.location.href = '/login';
                // }
            }
        }
        return Promise.reject(error);
    }
);

// Helper for consistent error handling with AbortSignal
const handleApiError = (error, functionName) => {
    if (axios.isCancel(error) || error.name === 'AbortError') {
        console.log(`[surveyApi] ${functionName} request was aborted:`, error.message);
    } else {
        console.error(`[surveyApi] Error in ${functionName}:`, error.response?.data || error.message);
        if (error.response && (functionName.includes('update') || functionName.includes('create') || functionName.includes('delete'))) {
             console.error(`[surveyApi] Full error response for ${functionName}: Status ${error.response.status}`, error.response.data);
        }
    }
    throw error.response?.data || error; // Re-throw for component handling
};

// --- Survey Endpoints ---
export const getAllSurveys = async (options = {}) => {
    try {
        const params = options.status ? { status: options.status } : {};
        const response = await apiClient.get('/surveys', { params, signal: options.signal });
        return response.data;
    } catch (error) {
        return handleApiError(error, 'getAllSurveys');
    }
};

export const createSurvey = async (surveyData, options = {}) => {
    try {
        const response = await apiClient.post('/surveys', surveyData, { signal: options.signal });
        return response.data;
    } catch (error) {
        return handleApiError(error, 'createSurvey');
    }
};

export const getSurveyById = async (surveyId, options = {}) => {
    try {
        // --- MODIFICATION START ---
        // Destructure known query parameters from options.
        // Any other properties in options (like 'signal') will be handled separately or ignored by 'params'.
        const { signal, ...queryParams } = options; 
        
        // Pass queryParams as the 'params' object to axios.
        // Pass signal directly in the axios config.
        const response = await apiClient.get(`/surveys/${surveyId}`, { 
            params: queryParams, 
            signal: signal 
        });
        // --- MODIFICATION END ---
        return response.data;
    } catch (error) {
        return handleApiError(error, `getSurveyById (${surveyId})`);
    }
};

export const updateSurveyStructure = async (surveyId, surveyStructureData, options = {}) => {
    try {
        const response = await apiClient.patch(`/surveys/${surveyId}`, surveyStructureData, { signal: options.signal });
        return response.data;
    } catch (error) {
        return handleApiError(error, `updateSurveyStructure (${surveyId})`);
    }
};

export const deleteSurvey = async (surveyId, options = {}) => {
    try {
        const response = await apiClient.delete(`/surveys/${surveyId}`, { signal: options.signal });
        return response.data;
    } catch (error) {
        return handleApiError(error, `deleteSurvey (${surveyId})`);
    }
};

// --- Question Endpoints ---
export const createQuestion = async (questionData, options = {}) => {
    try {
        const response = await apiClient.post('/questions', questionData, { signal: options.signal });
        return response.data;
    } catch (error) {
        return handleApiError(error, 'createQuestion');
    }
};

export const updateQuestionContent = async (questionId, updates, options = {}) => {
    try {
        const response = await apiClient.patch(`/questions/${questionId}`, updates, { signal: options.signal });
        return response.data;
    } catch (error) {
        return handleApiError(error, `updateQuestionContent (${questionId})`);
    }
};

export const deleteQuestionById = async (questionId, options = {}) => {
    try {
        const response = await apiClient.delete(`/questions/${questionId}`, { signal: options.signal });
        return response.data;
    } catch (error) {
        return handleApiError(error, `deleteQuestionById (${questionId})`);
    }
};

// --- Survey Submission and Results Endpoints ---
export const submitSurveyAnswers = async (surveyId, submissionData, options = {}) => {
    try {
        const response = await apiClient.post(`/surveys/${surveyId}/submit`, submissionData, { signal: options.signal });
        return response.data;
    } catch (error) {
        return handleApiError(error, `submitSurveyAnswers (${surveyId})`);
    }
};

export const getSurveyResults = async (surveyId, options = {}) => {
    try {
        // --- MODIFICATION FOR CONSISTENCY (if options might contain query params) ---
        const { signal, ...queryParams } = options;
        const response = await apiClient.get(`/surveys/${surveyId}/results`, { 
            params: queryParams, 
            signal: signal 
        });
        // --- END MODIFICATION ---
        return response.data;
    } catch (error) {
        return handleApiError(error, `getSurveyResults (${surveyId})`);
    }
};

export const exportSurveyResults = async (surveyId, options = {}) => {
    try {
        // --- MODIFICATION FOR CONSISTENCY (if options might contain query params) ---
        const { signal, ...queryParams } = options;
        const response = await apiClient.get(`/surveys/${surveyId}/export`, { 
            responseType: 'blob', 
            params: queryParams,
            signal: signal 
        });
        // --- END MODIFICATION ---
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        const contentDisposition = response.headers['content-disposition'];
        let fileName = `survey_${surveyId}_results.csv`;
        if (contentDisposition) {
            const fileNameMatch = contentDisposition.match(/filename="?(.+)"?/i);
            if (fileNameMatch?.[1]) fileName = fileNameMatch[1];
        }
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        return { success: true, fileName };
    } catch (error) {
        return handleApiError(error, `exportSurveyResults (${surveyId})`);
    }
};

// --- Auth Endpoints ---
export const loginUser = async (credentials, options = {}) => {
    try {
        const response = await apiClient.post('/auth/login', credentials, { signal: options.signal });
        if (response.data.token) {
            localStorage.setItem('token', response.data.token);
            if (response.data.user) localStorage.setItem('user', JSON.stringify(response.data.user));
        }
        return response.data;
    } catch (error) {
        return handleApiError(error, 'loginUser');
    }
};

export const registerUser = async (userData, options = {}) => {
    try {
        const response = await apiClient.post('/auth/register', userData, { signal: options.signal });
        if (response.data.token) {
            localStorage.setItem('token', response.data.token);
            if (response.data.user) localStorage.setItem('user', JSON.stringify(response.data.user));
        }
        return response.data;
    } catch (error) {
        return handleApiError(error, 'registerUser');
    }
};

export const logoutUser = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
};

export const getMe = async (options = {}) => {
    try {
        const { signal, ...queryParams } = options; // For consistency if any params were ever needed
        const response = await apiClient.get('/auth/me', { params: queryParams, signal: signal });
        return response.data;
    } catch (error) {
        return handleApiError(error, 'getMe');
    }
};

// --- Collector Endpoints ---
export const getCollectorsForSurvey = async (surveyId, options = {}) => {
    try {
        const { signal, ...queryParams } = options;
        const response = await apiClient.get(`/surveys/${surveyId}/collectors`, { params: queryParams, signal: signal });
        return response.data;
    } catch (error) {
        return handleApiError(error, `getCollectorsForSurvey (${surveyId})`);
    }
};

export const createCollector = async (surveyId, collectorData, options = {}) => {
    try {
        const response = await apiClient.post(`/surveys/${surveyId}/collectors`, collectorData, { signal: options.signal });
        return response.data;
    } catch (error) {
        return handleApiError(error, `createCollector (${surveyId})`);
    }
};

export const updateCollector = async (surveyId, collectorId, collectorData, options = {}) => {
    try {
        const response = await apiClient.put(`/surveys/${surveyId}/collectors/${collectorId}`, collectorData, { signal: options.signal });
        return response.data;
    } catch (error) {
        return handleApiError(error, `updateCollector (${collectorId})`);
    }
};

export const deleteCollector = async (surveyId, collectorId, options = {}) => {
    try {
        const response = await apiClient.delete(`/surveys/${surveyId}/collectors/${collectorId}`, { signal: options.signal });
        return response.data;
    } catch (error) {
        return handleApiError(error, `deleteCollector (${collectorId})`);
    }
};

// --- Public Survey Access Endpoint ---
// This one seems to be structured differently, using a POST and a different base URL.
// It's not directly related to the getSurveyById issue for SurveyTakingPage.
export const accessPublicSurvey = async (accessIdentifier, password = null, options = {}) => {
    try {
        const payload = password ? { password } : {};
        // This uses a different axios instance or base URL logic.
        const publicAccessClient = axios.create({ baseURL: effectivePublicAccessRootUrl });
        console.log(`[surveyApi] Calling POST ${effectivePublicAccessRootUrl}/s/${accessIdentifier}`);
        const response = await publicAccessClient.post(`/s/${accessIdentifier}`, payload, { signal: options.signal });
        return response.data;
    } catch (error) {
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
    getAllSurveys, createSurvey, getSurveyById, updateSurveyStructure, deleteSurvey,
    createQuestion, updateQuestionContent, deleteQuestionById,
    submitSurveyAnswers, getSurveyResults, exportSurveyResults,
    loginUser, registerUser, logoutUser, getMe,
    getCollectorsForSurvey, createCollector, updateCollector, deleteCollector,
    accessPublicSurvey,
};

export default surveyApiFunctions;
// ----- END OF COMPLETE MODIFIED FILE (vNext - Fix getSurveyById params) -----