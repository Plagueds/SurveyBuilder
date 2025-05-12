// frontend/src/components/Navbar.js
// ----- START OF COMPLETE MODIFIED FILE (v1.1 - Removed "Take Survey" link) -----
import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';


function Navbar() {
    const { theme, toggleTheme } = useTheme();
    const { isAuthenticated, user, logout, isLoading } = useAuth();
    const navigate = useNavigate();

    console.log('[Navbar] Rendering. isLoading:', isLoading, 'isAuthenticated:', isAuthenticated, 'User:', user);

    const handleLogout = () => {
        logout();
        // Optionally navigate to login or home after logout
        // navigate('/login'); 
    };

    // Determine the root path based on authentication
    // This ensures the brand link goes to an appropriate page
    const rootPath = isAuthenticated ? "/admin" : "/login";

    return (
        <nav className="main-navbar">
            <Link to={rootPath} className="navbar-brand">
                Survey App
            </Link>

            <ul className="navbar-links-list">
                {/* "Take Survey" link removed */}
                {isAuthenticated && (
                    <li>
                        <NavLink
                            to="/admin"
                            className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
                        >
                            Admin Dashboard
                        </NavLink>
                    </li>
                )}
            </ul>

            <div className="navbar-actions-container">
                {isLoading ? (
                    <span className="navbar-loading-text">Loading...</span>
                ) : isAuthenticated && user ? (
                    <>
                        <span className="navbar-user-greeting">
                            Welcome, {user.name || user.email || 'User'}
                        </span>
                        <button onClick={handleLogout} className="nav-button logout-button">
                            Logout
                        </button>
                    </>
                ) : (
                    <>
                        <NavLink
                            to="/login"
                            className={({ isActive }) => isActive ? 'nav-link auth-link active' : 'nav-link auth-link'}
                        >
                            Login
                        </NavLink>
                        <NavLink
                            to="/register"
                            className={({ isActive }) => isActive ? 'nav-link auth-link active' : 'nav-link auth-link'}
                        >
                            Register
                        </NavLink>
                    </>
                )}
                <div className="navbar-theme-toggle-container">
                    <button
                        onClick={toggleTheme}
                        className="theme-toggle-button"
                        title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
                    >
                        {theme === 'light' ? '🌙' : '☀️'}
                    </button>
                </div>
            </div>
        </nav>
    );
}

export default Navbar;
// ----- END OF COMPLETE MODIFIED FILE (v1.1 - Removed "Take Survey" link) -----