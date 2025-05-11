// frontend/src/pages/RegisterPage.js
// ----- START OF NEW FILE -----
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import styles from './AuthPage.module.css'; // Reuse the same CSS module

const RegisterPage = () => {
    const [name, setName] = useState(''); // Or username, depending on your backend
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const { register, isAuthenticated, isLoading, authError, clearAuthError } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (isAuthenticated) {
            navigate('/admin', { replace: true }); // Redirect if already logged in
        }
        clearAuthError();
    }, [isAuthenticated, navigate, clearAuthError]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name || !email || !password || !confirmPassword) {
            toast.warn('Please fill in all fields.');
            return;
        }
        if (password !== confirmPassword) {
            toast.error('Passwords do not match.');
            return;
        }
        // Add more password strength validation if needed

        try {
            // Adjust the payload according to your backend's registration endpoint requirements
            await register({ name, email, password }); 
            toast.success('Registration successful! Redirecting...');
            navigate('/admin'); // Or to a profile setup page, or login page for confirmation
        } catch (error) {
            toast.error(error.message || error.error || 'Registration failed. Please try again.');
        }
    };

    return (
        <div className={styles.authPageContainer}>
            <div className={styles.authFormCard}>
                <h1 className={styles.authTitle}>Create Account</h1>
                <form onSubmit={handleSubmit} className={styles.authForm}>
                    {authError && (
                        <p className={styles.errorMessageServer}>{authError}</p>
                    )}
                    <div className={styles.formGroup}>
                        <label htmlFor="name">Full Name</label> {/* Or Username */}
                        <input
                            type="text"
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            disabled={isLoading}
                            className={styles.formInput}
                        />
                    </div>
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
                            minLength="6" // Example: enforce min length
                            disabled={isLoading}
                            className={styles.formInput}
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label htmlFor="confirmPassword">Confirm Password</label>
                        <input
                            type="password"
                            id="confirmPassword"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            minLength="6"
                            disabled={isLoading}
                            className={styles.formInput}
                        />
                    </div>
                    <button type="submit" disabled={isLoading} className={`${styles.authButton} button button-primary`}>
                        {isLoading ? 'Creating Account...' : 'Register'}
                    </button>
                </form>
                <p className={styles.authRedirectText}>
                    Already have an account? <Link to="/login" className={styles.authLink}>Login here</Link>
                </p>
            </div>
        </div>
    );
};

export default RegisterPage;
// ----- END OF NEW FILE -----