// frontend/src/pages/LoginPage.js
// ----- START OF MODIFIED FILE -----
import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import styles from './AuthPage.module.css';

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { login, isAuthenticated, isLoading, authError, clearAuthError } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const from = location.state?.from?.pathname || '/admin';

    useEffect(() => {
        if (isAuthenticated) {
            // User is already authenticated, redirect them
            // No toast needed here as it's a silent redirect for good UX
            navigate(from, { replace: true });
        }
        // Clear any previous auth errors when the component mounts or user navigates here
        // This ensures that if a user navigates away and back, old errors are gone.
        return () => { // Cleanup on unmount
            clearAuthError();
        };
    }, [isAuthenticated, navigate, from, clearAuthError]);

    // Effect to clear authError if user starts typing again
    useEffect(() => {
        if (email || password) { // Or more specifically, on focus or change of inputs
            clearAuthError();
        }
    }, [email, password, clearAuthError]);


    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email || !password) {
            toast.warn('Please enter both email and password.');
            return;
        }
        // Clear previous authError before attempting login
        clearAuthError();

        try {
            await login({ email, password }); // This will throw an error on failure
            // If login is successful, AuthContext's login will navigate.
            // If AuthContext's login does NOT navigate, you can navigate here.
            // The current AuthContext.login *does* navigate.
            // A success toast can be shown here if AuthContext doesn't, or if you want it specifically from LoginPage.
            // toast.success('Login successful! Redirecting...'); // AuthContext already shows a success toast
        } catch (error) {
            // The error object here is the one re-thrown by AuthContext's login
            // It should contain the message that AuthContext set for authError.
            console.error("LoginPage handleSubmit error:", error);
            // Use the error message directly from the caught error.
            // AuthContext's login function already tries to make this message specific.
            const displayMessage = error.message || 'Login failed. Please check your credentials.';
            toast.error(displayMessage);
            // authError in AuthContext is already set by the login function in AuthContext
            // So the <p className={styles.errorMessageServer}>{authError}</p> will display it.
        }
    };

    return (
        <div className={styles.authPageContainer}>
            <div className={styles.authFormCard}>
                <h1 className={styles.authTitle}>Login</h1>
                <form onSubmit={handleSubmit} className={styles.authForm}>
                    {/* This will display the error message set in AuthContext */}
                    {authError && (
                        <p className={styles.errorMessageServer}>{authError}</p>
                    )}
                    <div className={styles.formGroup}>
                        <label htmlFor="email">Email Address</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            disabled={isLoading}
                            className={styles.formInput}
                            aria-describedby={authError ? "auth-error-message" : undefined}
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label htmlFor="password">Password</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            disabled={isLoading}
                            className={styles.formInput}
                            aria-describedby={authError ? "auth-error-message" : undefined}
                        />
                    </div>
                    {/* For accessibility, link the error message to the form overall or relevant fields */}
                    {authError && <span id="auth-error-message" className="sr-only">Error: {authError}</span>}
                    <button type="submit" disabled={isLoading} className={`${styles.authButton} button button-primary`}>
                        {isLoading ? 'Logging in...' : 'Login'}
                    </button>
                </form>
                <p className={styles.authRedirectText}>
                    Don't have an account? <Link to="/register" className={styles.authLink}>Register here</Link>
                </p>
            </div>
        </div>
    );
};

export default LoginPage;
// ----- END OF MODIFIED FILE -----