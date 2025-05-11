// frontend/src/components/Navbar.js
import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import './Navbar.css'; // <--- MAKE SURE THIS LINE IS PRESENT AND CORRECT


function Navbar() {
    const { theme, toggleTheme } = useTheme();
    const { isAuthenticated, user, logout, isLoading } = useAuth();
    const navigate = useNavigate(); 

    // ADD THIS CONSOLE LOG
    console.log('[Navbar] Rendering. isLoading:', isLoading, 'isAuthenticated:', isAuthenticated, 'User:', user);

    const handleLogout = () => {
        logout(); 
    };

    return (
        <nav className="main-navbar">
            <Link to="/" className="navbar-brand">
                Survey App
            </Link>

            <ul className="navbar-links-list">
                <li>
                    <NavLink
                        to="/"
                        className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
                        end
                    >
                        Take Survey {/* This should always be visible based on current logic */}
                    </NavLink>
                </li>
                {isAuthenticated && ( // Admin Dashboard link conditional
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
                        {/* These are the links we are interested in */}
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