// frontend/src/api/surveyApi.js
// ----- START OF COMPLETE MODIFIED FILE -----
import axios from 'axios';

// API_BASE_URL is for routes under /api. For public /s routes, we'll construct differently.
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '/api'; 
const ROOT_URL = ''; // Assuming backend and frontend are served from the same origin, or this needs to be configured.
                     // If your backend is on a different port during development (e.g., localhost:3001)
                     // and frontend on localhost:3000, you'd use the full backend URL here or rely on proxy.
                     // For simplicity, assuming same origin or proxy setup.

const apiClient = axios.create({
    baseURL: API_BASE_URL, // For /api prefixed routes
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
            console.warn('[surveyApi] Unauthorized (401) response. Token might be invalid or expired.');
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        }
        return Promise.reject(error);
    }
);


// --- Survey Endpoints ---
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
        // This uses apiClient, so it will be POST /api/surveys/:surveyId/submit
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
    } catch (error) {
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
export const accessPublicSurvey = async (accessIdentifier, password = null) => {
    try {
        const payload = password ? { password } : {};
        // Create a new axios instance specifically for this non-/api prefixed route
        // It will use the ROOT_URL (empty string for same origin, or your backend's full base URL)
        const publicAccessClient = axios.create({ baseURL: ROOT_URL }); 
        console.log(`[surveyApi] Calling POST ${ROOT_URL}/s/${accessIdentifier}`);
        const response = await publicAccessClient.post(`/s/${accessIdentifier}`, payload); // <<< MODIFIED: This will now be POST /s/:accessIdentifier
        return response.data;
    } catch (error) {
        console.error(`[surveyApi] Error accessing public survey ${accessIdentifier}:`, error.response?.data || error.message);
        if (error.response) {
            // Log the full error response for better debugging
            console.error(`[surveyApi] Full error response for accessPublicSurvey ${accessIdentifier}: Status ${error.response.status}`, error.response.data);
            throw error.response.data; // Throw the data part of the error response
        }
        throw new Error(`Failed to access survey ${accessIdentifier}`); // Fallback error
    }
};


const surveyApiFunctions = { // Renamed to avoid conflict with the filename if imported as default
    getAllSurveys, createSurvey, getSurveyById, updateSurveyStructure, deleteSurvey,
    createQuestion, updateQuestionContent, deleteQuestionById,
    submitSurveyAnswers, getSurveyResults, exportSurveyResults,
    loginUser, registerUser, logoutUser, getMe,
    getCollectorsForSurvey, createCollector, updateCollector, deleteCollector,
    accessPublicSurvey,
};

export default surveyApiFunctions; // Export the object
// ----- END OF COMPLETE MODIFIED FILE -----