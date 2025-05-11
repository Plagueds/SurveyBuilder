// src/context/ThemeContext.js
// ----- START OF COMPLETE NEW FILE -----
import React, { createContext, useState, useEffect, useMemo } from 'react';

// Create the context
const ThemeContext = createContext();

// Create a provider component
export const ThemeProvider = ({ children }) => {
    // Initialize state, trying to read from localStorage first
    const [theme, setTheme] = useState(() => {
        const storedTheme = localStorage.getItem('surveyAppTheme');
        return storedTheme ? storedTheme : 'light'; // Default to light
    });

    // Effect to update localStorage and body class when theme changes
    useEffect(() => {
        localStorage.setItem('surveyAppTheme', theme);
        // Add/remove 'dark-mode' class to the body element
        document.body.classList.remove('light-mode', 'dark-mode');
        document.body.classList.add(theme === 'dark' ? 'dark-mode' : 'light-mode');
    }, [theme]);

    // Function to toggle the theme
    const toggleTheme = () => {
        setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
    };

    // Memoize the context value to prevent unnecessary re-renders
    const value = useMemo(() => ({ theme, toggleTheme }), [theme]);

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};

// Custom hook to use the theme context easily
export const useTheme = () => {
    const context = React.useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
// ----- END OF COMPLETE NEW FILE -----