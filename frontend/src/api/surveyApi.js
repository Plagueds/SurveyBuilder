// frontend/src/api/surveyApi.js
// ----- START OF COMPLETE MODIFIED FILE -----
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
    // Derive the root URL (e.g., https://surveybuilderapi.onrender.com) from the base URL
    try {
        const url = new URL(effectiveApiRoutesBaseUrl);
        effectivePublicAccessRootUrl = `${url.protocol}//${url.host}`;
    } catch (e) {
        console.error(
            "[surveyApi] Could not parse REACT_APP_API_BASE_URL to derive root URL. " +
            "Ensure it's a valid URL (e.g., https://domain.com/api). " +
            "Falling back for public access root URL.", e
        );
        // Fallback if parsing fails - this indicates a misconfiguration of REACT_APP_API_BASE_URL
        effectivePublicAccessRootUrl = 'https://surveybuilderapi.onrender.com'; // Hardcoded production fallback
    }
} else {
    // This fallback is primarily for local development if .env is missing or misconfigured.
    // For production builds on Netlify, REACT_APP_API_BASE_URL MUST be set.
    console.warn(
        "[surveyApi] REACT_APP_API_BASE_URL is not defined. " +
        "Falling back to 'http://localhost:3001/api' for API routes and 'http://localhost:3001' for public access. " +
        "Ensure REACT_APP_API_BASE_URL is set in your .env file for local development " +
        "and in Netlify environment variables for production."
    );
    effectiveApiRoutesBaseUrl = 'http://localhost:3001/api'; // Fallback for local dev API routes
    effectivePublicAccessRootUrl = 'http://localhost:3001'; // Fallback for local dev public access
}

console.log(`[surveyApi] Effective API Routes Base URL: ${effectiveApiRoutesBaseUrl}`);
console.log(`[surveyApi] Effective Public Access Root URL: ${effectivePublicAccessRootUrl}`);


const apiClient = axios.create({
    baseURL: effectiveApiRoutesBaseUrl, // e.g., http://localhost:3001/api or https://surveybuilderapi.onrender.com/api
    headers: {
        'Content-Type': 'application/json',
    },
});

// --- Interceptor to add Authorization token if available ---
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

// --- Interceptor to handle 401 errors (optional but good for UX) ---
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            // More specific check to avoid logging out on /auth/login 401s
            if (error.config.url && !error.config.url.endsWith('/auth/login') && !error.config.url.endsWith('/auth/register')) {
                console.warn('[surveyApi] Unauthorized (401) response. Token might be invalid or expired. Logging out.');
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                // Optionally redirect to login page
                // if (window.location.pathname !== '/login') {
                //     window.location.href = '/login';
                // }
            }
        }
        return Promise.reject(error);
    }
);


// --- Survey Endpoints ---
// All paths here are relative to effectiveApiRoutesBaseUrl (e.g., /surveys will become https://domain.com/api/surveys)
export const getAllSurveys = async (status = null) => {
    try {
        const params = status ? { status } : {};
        const response = await apiClient.get('/surveys', { params });
        return response.data;
    } catch (error) {
        console.error('[surveyApi] Error fetching all surveys:', error.response?.data || error.message);
        throw error.response?.data || new Error('Failed to fetch surveys');
    }
};

export const createSurvey = async (surveyData) => {
    try {
        const response = await apiClient.post('/surveys', surveyData);
        return response.data;
    } catch (error) {
        console.error('[surveyApi] Error creating survey:', error.response?.data || error.message);
        throw error.response?.data || new Error('Failed to create survey');
    }
};

export const getSurveyById = async (surveyId) => {
    try {
        const response = await apiClient.get(`/surveys/${surveyId}`);
        return response.data;
    } catch (error) {
        console.error(`[surveyApi] Error fetching survey ${surveyId}:`, error.response?.data || error.message);
        throw error.response?.data || new Error(`Failed to fetch survey ${surveyId}`);
    }
};

export const updateSurveyStructure = async (surveyId, surveyStructureData) => {
    try {
        const response = await apiClient.patch(`/surveys/${surveyId}`, surveyStructureData);
        return response.data;
    } catch (error) {
        console.error(`[surveyApi] Error updating survey structure ${surveyId}:`, error.response ? error.response.data : error.message);
        if (error.response) {
            console.error(`[surveyApi] Full error response for updateSurveyStructure ${surveyId}: Status ${error.response.status}`, error.response.data);
        }
        throw error.response?.data || new Error(`Failed to update survey structure ${surveyId}`);
    }
};

export const deleteSurvey = async (surveyId) => {
    try {
        const response = await apiClient.delete(`/surveys/${surveyId}`);
        return response.data;
    } catch (error) {
        console.error(`[surveyApi] Error deleting survey ${surveyId}:`, error.response?.data || error.message);
        throw error.response?.data || new Error(`Failed to delete survey ${surveyId}`);
    }
};

// --- Question Endpoints ---
export const createQuestion = async (questionData) => {
    try {
        const response = await apiClient.post('/questions', questionData);
        return response.data;
    } catch (error) {
        console.error('[surveyApi] Error creating question:', error.response?.data || error.message);
        throw error.response?.data || new Error('Failed to create question');
    }
};

export const updateQuestionContent = async (questionId, updates) => {
    try {
        const response = await apiClient.patch(`/questions/${questionId}`, updates);
        return response.data;
    } catch (error) {
        console.error(`[surveyApi] Error updating question ${questionId}:`, error.response?.data || error.message);
        throw error.response?.data || new Error(`Failed to update question ${questionId}`);
    }
};

export const deleteQuestionById = async (questionId) => {
    try {
        const response = await apiClient.delete(`/questions/${questionId}`);
        return response.data;
    } catch (error) {
        console.error(`[surveyApi] Error deleting question ${questionId}:`, error.response?.data || error.message);
        throw error.response?.data || new Error(`Failed to delete question ${questionId}`);
    }
};

// --- Survey Submission and Results Endpoints ---
export const submitSurveyAnswers = async (surveyId, submissionData) => {
    try {
        const response = await apiClient.post(`/surveys/${surveyId}/submit`, submissionData);
        return response.data;
    } catch (error) {
        console.error(`[surveyApi] Error submitting answers for survey ${surveyId}:`, error.response?.data || error.message);
        throw error.response?.data || new Error(`Failed to submit answers for survey ${surveyId}`);
    }
};

export const getSurveyResults = async (surveyId) => {
    try {
        const response = await apiClient.get(`/surveys/${surveyId}/results`);
        return response.data;
    } catch (error) {
        console.error(`[surveyApi] Error fetching results for survey ${surveyId}:`, error.response?.data || error.message);
        throw error.response?.data || new Error(`Failed to fetch results for survey ${surveyId}`);
    }
};

export const exportSurveyResults = async (surveyId) => {
    try {
        const response = await apiClient.get(`/surveys/${surveyId}/export`, { responseType: 'blob' });
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
        console.error(`[surveyApi] Error exporting results for survey ${surveyId}:`, error.response?.data || error.message);
        throw error.response?.data || new Error(`Failed to export results for survey ${surveyId}`);
    }
};

// --- Auth Endpoints ---
export const loginUser = async (credentials) => {
    try {
        const response = await apiClient.post('/auth/login', credentials);
        if (response.data.token) {
            localStorage.setItem('token', response.data.token);
            if (response.data.user) localStorage.setItem('user', JSON.stringify(response.data.user));
        }
        return response.data;
    } catch (error) {
        console.error('[surveyApi] Error logging in:', error.response?.data || error.message);
        throw error.response ? error : new Error('Login failed');
    }
};

export const registerUser = async (userData) => {
    try {
        const response = await apiClient.post('/auth/register', userData);
        if (response.data.token) {
            localStorage.setItem('token', response.data.token);
            if (response.data.user) localStorage.setItem('user', JSON.stringify(response.data.user));
        }
        return response.data;
    } catch (error) {
        console.error('[surveyApi] Error registering user:', error.response?.data || error.message);
        throw error.response ? error : new Error('Registration failed');
    }
};

export const logoutUser = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // Consider redirecting to home or login page after logout
    // window.location.href = '/';
};

export const getMe = async () => {
    try {
        const response = await apiClient.get('/auth/me');
        return response.data;
    } catch (error) {
        console.error('[surveyApi] Error fetching user profile (/auth/me):', error.response?.data || error.message);
        throw error.response ? error : new Error('Failed to fetch user profile');
    }
};

// --- Collector Endpoints ---
export const getCollectorsForSurvey = async (surveyId) => {
    try {
        const response = await apiClient.get(`/surveys/${surveyId}/collectors`);
        return response.data;
    } catch (error) { // <<< SYNTAX ERROR WAS HERE: _PAGE_CONTENT_ removed
        console.error(`[surveyApi] Error fetching collectors for survey ${surveyId}:`, error.response?.data || error.message);
        throw error.response?.data || new Error(`Failed to fetch collectors for survey ${surveyId}`);
    }
};

export const createCollector = async (surveyId, collectorData) => {
    try {
        const response = await apiClient.post(`/surveys/${surveyId}/collectors`, collectorData);
        return response.data;
    } catch (error) {
        console.error(`[surveyApi] Error creating collector for survey ${surveyId}:`, error.response?.data || error.message);
        throw error.response?.data || new Error(`Failed to create collector for survey ${surveyId}`);
    }
};

export const updateCollector = async (surveyId, collectorId, collectorData) => {
    try {
        const response = await apiClient.put(`/surveys/${surveyId}/collectors/${collectorId}`, collectorData);
        return response.data;
    } catch (error) {
        console.error(`[surveyApi] Error updating collector ${collectorId} for survey ${surveyId}:`, error.response?.data || error.message);
        throw error.response?.data || new Error(`Failed to update collector ${collectorId}`);
    }
};

export const deleteCollector = async (surveyId, collectorId) => {
    try {
        const response = await apiClient.delete(`/surveys/${surveyId}/collectors/${collectorId}`);
        return response.data;
    } catch (error) {
        console.error(`[surveyApi] Error deleting collector ${collectorId} for survey ${surveyId}:`, error.response?.data || error.message);
        throw error.response?.data || new Error(`Failed to delete collector ${collectorId}`);
    }
};

// --- Public Survey Access Endpoint ---
// This function now uses effectivePublicAccessRootUrl
export const accessPublicSurvey = async (accessIdentifier, password = null) => {
    try {
        const payload = password ? { password } : {};
        // Create a new axios instance specifically for this non-/api prefixed route
        // It will use the effectivePublicAccessRootUrl (e.g., https://surveybuilderapi.onrender.com or http://localhost:3001)
        const publicAccessClient = axios.create({ baseURL: effectivePublicAccessRootUrl });
        console.log(`[surveyApi] Calling POST ${effectivePublicAccessRootUrl}/s/${accessIdentifier}`);
        // The path here is relative to the baseURL, so '/s/...' is correct.
        const response = await publicAccessClient.post(`/s/${accessIdentifier}`, payload);
        return response.data;
    } catch (error) {
        console.error(`[surveyApi] Error accessing public survey ${accessIdentifier}:`, error.response?.data || error.message);
        if (error.response) {
            console.error(`[surveyApi] Full error response for accessPublicSurvey ${accessIdentifier}: Status ${error.response.status}`, error.response.data);
            throw error; // Throw the whole error object so the component can inspect error.response.data
        }
        throw new Error(error.message || `Failed to access survey ${accessIdentifier}`);
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
// ----- END OF COMPLETE MODIFIED FILE -----