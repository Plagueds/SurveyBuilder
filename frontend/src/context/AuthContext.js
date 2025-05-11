// frontend/src/context/AuthContext.js
// ----- START OF MODIFIED FILE -----
import React, { createContext, useState, useEffect, useCallback, useContext, useMemo } from 'react';
import surveyApi from '../api/surveyApi'; // Your API service
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify'; // Import toast for success messages

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(() => localStorage.getItem('token')); // Initialize from localStorage
    const [isLoading, setIsLoading] = useState(true); // Start true until initial check is done
    const [authError, setAuthError] = useState(null);
    const navigate = useNavigate();
    const location = useLocation();

    // console.log('[AuthContext] Initializing. Token from state:', token);

    const clearAuthData = useCallback(() => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        // Do not clear authError here, let components decide when to clear UI errors
    }, []);


    const fetchUserProfile = useCallback(async (currentToken) => {
        // console.log('[AuthContext] fetchUserProfile called with token:', currentToken);
        if (!currentToken) {
            // console.log('[AuthContext] fetchUserProfile: No token provided, clearing user state.');
            clearAuthData();
            return null;
        }

        try {
            // console.log('[AuthContext] fetchUserProfile: Attempting to call surveyApi.getMe()');
            const response = await surveyApi.getMe();
            // console.log('[AuthContext] fetchUserProfile: Response from surveyApi.getMe():', response);
            
            if (response.success && response.user) {
                // console.log('[AuthContext] fetchUserProfile: User profile fetched successfully:', response.user);
                setUser(response.user);
                localStorage.setItem('user', JSON.stringify(response.user));
                // Token is already set in state by the caller or initializeAuth
                return response.user;
            } else {
                // console.warn('[AuthContext] fetchUserProfile: Failed to get user from response or response.success is false.');
                clearAuthData(); // Clear auth data if getMe fails but doesn't throw 401
                throw new Error(response.message || 'Failed to fetch user profile (API success false or no user data).');
            }
        } catch (error) {
            // This catch is for network errors or if surveyApi.getMe throws (e.g., 401 handled by interceptor)
            // console.error("[AuthContext] fetchUserProfile: Error fetching user profile:", error.message || error);
            clearAuthData(); // Interceptor in surveyApi already clears for 401, this is a fallback.
            return null;
        }
    }, [clearAuthData]);

    useEffect(() => {
        const initializeAuth = async () => {
            // console.log('[AuthContext] initializeAuth: Starting initial authentication check.');
            setIsLoading(true);
            const storedToken = localStorage.getItem('token');
            // console.log('[AuthContext] initializeAuth: Token from localStorage:', storedToken);
            if (storedToken) {
                setToken(storedToken); // Sync state with localStorage
                await fetchUserProfile(storedToken);
            } else {
                // console.log('[AuthContext] initializeAuth: No token found in localStorage.');
                // No token, so user is not authenticated. isLoading will be set to false.
            }
            setIsLoading(false);
            // console.log('[AuthContext] initializeAuth: Finished. isLoading:', false);
        };
        initializeAuth();
    }, [fetchUserProfile]); // fetchUserProfile is stable due to useCallback

    const login = useCallback(async (credentials) => {
        // console.log('[AuthContext] login: Attempting login with credentials:', credentials);
        setIsLoading(true);
        setAuthError(null); // Clear previous errors
        try {
            const response = await surveyApi.loginUser(credentials); // surveyApi.loginUser handles localStorage for token/user
            // console.log('[AuthContext] login: Response from surveyApi.loginUser:', response);
            if (response.success && response.token && response.user) {
                setToken(response.token); // Update state
                setUser(response.user);   // Update state
                // localStorage is already set by surveyApi.loginUser

                toast.success(response.message || 'Login successful!'); // Success toast

                const fromPath = location.state?.from?.pathname || '/admin'; // Default to admin or previous page
                // console.log('[AuthContext] login: Success! Navigating to:', fromPath);
                navigate(fromPath, { replace: true });
                setIsLoading(false); // Set loading false after navigation and state updates
                return response; // Return response for LoginPage if it needs to do more
            } else {
                // This case should ideally be caught by surveyApi.loginUser throwing an error
                const errorMessage = response.message || "Login failed: Invalid response from server.";
                setAuthError(errorMessage);
                setIsLoading(false);
                throw new Error(errorMessage);
            }
        } catch (error) {
            // This error is from surveyApi.loginUser (e.g., network error, 401, 500)
            // console.error("[AuthContext] login: Catch block error:", error);
            // The error object from surveyApi.loginUser should be an Axios error object or a new Error.
            // error.response.data.message (for Axios errors from backend)
            // error.message (for new Error or network issues)
            const errorMessage = error.response?.data?.message || error.message || 'Login failed. Please check your credentials.';
            setAuthError(errorMessage);
            // Clear potentially stale token/user if login attempt fails badly,
            // though 401s are handled by surveyApi interceptor.
            if (!error.response || (error.response && error.response.status !== 401)) {
                 // If not a 401 (which interceptor handles), or no response, explicitly clear.
                clearAuthData();
            }
            setIsLoading(false);
            throw error; // Re-throw the original error (or a new Error with the message) for LoginPage
        }
    }, [navigate, location.state, clearAuthData]);

    const register = useCallback(async (userData) => {
        // console.log('[AuthContext] register: Attempting registration with data:', userData);
        setIsLoading(true);
        setAuthError(null);
        try {
            const response = await surveyApi.registerUser(userData); // surveyApi.registerUser handles localStorage
            // console.log('[AuthContext] register: Response from surveyApi.registerUser:', response);
            if (response.success && response.token && response.user) {
                setToken(response.token);
                setUser(response.user);
                // localStorage is set by surveyApi.registerUser

                toast.success(response.message || 'Registration successful!');
                
                // console.log('[AuthContext] register: Success! Navigating to / (homepage).');
                navigate('/', { replace: true }); // Or to '/login'
                setIsLoading(false);
                return response;
            } else {
                const errorMessage = response.message || "Registration failed: Invalid response from server.";
                setAuthError(errorMessage);
                setIsLoading(false);
                throw new Error(errorMessage);
            }
        } catch (error) {
            // console.error("[AuthContext] register: Catch block error:", error);
            const errorMessage = error.response?.data?.message || error.message || 'Registration failed. Please try again.';
            setAuthError(errorMessage);
            // No need to clearAuthData here as they weren't authenticated yet.
            setIsLoading(false);
            throw error; // Re-throw
        }
    }, [navigate]);

    const logout = useCallback(() => {
        // console.log('[AuthContext] logout: Logging out user.');
        surveyApi.logoutUser(); // surveyApi.logoutUser clears localStorage
        clearAuthData(); // Clears state
        setAuthError(null); // Clear any lingering auth errors
        toast.info('You have been logged out.'); // Logout toast
        // console.log('[AuthContext] logout: Navigating to /login.');
        navigate('/login', { replace: true });
    }, [navigate, clearAuthData]);

    // This effect listens for changes to localStorage from other tabs/windows.
    useEffect(() => {
        const handleStorageChange = (event) => {
            // console.log('[AuthContext] handleStorageChange: Event key:', event.key);
            if (event.key === 'token') {
                const newTokenValue = event.newValue;
                // console.log('[AuthContext] handleStorageChange: New token value from storage event:', newTokenValue);
                if (newTokenValue && newTokenValue !== token) { // Check if it's actually different
                    setToken(newTokenValue);
                    fetchUserProfile(newTokenValue); // Validate and fetch user for the new token
                } else if (!newTokenValue && token) { // Token was removed from another tab
                    clearAuthData();
                }
            } else if (event.key === 'user' && event.newValue === null && user) { // User explicitly removed
                 clearAuthData();
            }
            // We don't need to handle 'user' being set, as 'token' change drives user profile fetching.
        };

        window.addEventListener('storage', handleStorageChange);
        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [fetchUserProfile, clearAuthData, token, user]); // Added token and user to dependencies

    const clearAuthError = useCallback(() => {
        setAuthError(null);
    }, []);

    const contextValue = useMemo(() => {
        // Determine isAuthenticated based on presence of token AND user object
        // This prevents a brief "authenticated" state if token exists but user fetch fails or is pending
        const isAuthenticated = !!token && !!user; 
        // console.log('[AuthContext] Recomputing contextValue. Token:', token, 'User:', user, 'IsAuthenticated:', isAuthenticated, 'IsLoading:', isLoading);
        return {
            user,
            token,
            isAuthenticated,
            isLoading,
            authError,
            login,
            register,
            logout,
            clearAuthError,
            // fetchUserProfile, // Expose if needed by other parts of app, but usually internal
        };
    }, [user, token, isLoading, authError, login, register, logout, clearAuthError]);

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined || context === null) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
// ----- END OF MODIFIED FILE -----