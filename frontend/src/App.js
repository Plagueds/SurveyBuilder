// frontend/src/App.js
// ----- START OF COMPLETE MODIFIED FILE -----
import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';

// --- Context Hook ---
import { useAuth } from './context/AuthContext';

// --- Component Imports ---
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

// --- Page Imports ---
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AdminPage from './pages/AdminPage';
import AdminSurveyDetailPage from './pages/AdminSurveyDetailPage';
import SurveyBuildPage from './pages/SurveyBuildPage';
import SurveyResultsPage from './pages/SurveyResultsPage';
import SurveyTakingPage from './pages/SurveyTakingPage';
import SurveyPreviewPage from './pages/SurveyPreviewPage'; // <<<--- ADD THIS IMPORT
import ThankYouPage from './pages/ThankYouPage';
import NotFoundPage from './pages/NotFoundPage';
import PublicSurveyHandler from './pages/PublicSurveyHandler';

function App() {
    const location = useLocation();
    const { isLoading: authIsLoading } = useAuth();

    const showNavbar = true; // You might want to make this conditional based on location.pathname

    if (authIsLoading) {
        return (
            <div className="app-loading-container">
                <div className="spinner"></div>
                <p>Loading Application...</p>
            </div>
        );
    }

    return (
        <div className="App">
            {showNavbar && <Navbar />}
            <main className={`main-content ${showNavbar ? 'with-navbar' : 'without-navbar'}`}>
                <Routes>
                    {/* --- Public Routes --- */}
                    <Route path="/" element={<HomePage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />

                    {/* Route for public survey access via /s/identifier */}
                    <Route path="/s/:accessIdentifier" element={<PublicSurveyHandler />} />
                    
                    {/* Route for actually taking a survey (navigated to from PublicSurveyHandler) */}
                    <Route path="/surveys/:surveyId/c/:collectorId" element={<SurveyTakingPage />} />

                    {/* NEW Route for previewing a survey (no collector, no submission saving) */}
                    {/* This can be accessed by anyone who knows the surveyId, or protected if needed */}
                    <Route path="/surveys/:surveyId/preview" element={<SurveyPreviewPage />} />
                    
                    <Route path="/thank-you" element={<ThankYouPage />} />

                    {/* --- Protected Admin Routes --- */}
                    <Route element={<ProtectedRoute />}>
                        <Route path="/admin" element={<AdminPage />} />
                        <Route path="/admin/surveys/:surveyId" element={<AdminSurveyDetailPage />} />
                        <Route path="/admin/surveys/:surveyId/build" element={<SurveyBuildPage />} />
                        <Route path="/admin/surveys/:surveyId/results" element={<SurveyResultsPage />} />
                        {/* You could also place a protected preview route here if needed:
                        <Route path="/admin/surveys/:surveyId/preview" element={<SurveyPreviewPage />} />
                        But a general preview page is often more flexible. */}
                    </Route>

                    <Route path="*" element={<NotFoundPage />} />
                </Routes>
            </main>
        </div>
    );
}

export default App;
// ----- END OF COMPLETE MODIFIED FILE -----