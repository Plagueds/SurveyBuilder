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
import ThankYouPage from './pages/ThankYouPage';
import NotFoundPage from './pages/NotFoundPage';
import PublicSurveyHandler from './pages/PublicSurveyHandler'; // <<<--- NEW: Import for /s/ links

function App() {
    const location = useLocation();
    const { isLoading: authIsLoading } = useAuth();

    const showNavbar = true;

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

                    {/* MODIFIED Route for SurveyTakingPage to include collectorId */}
                    {/* This is the route that SurveyTakingPage will use directly */}
                    <Route path="/surveys/:surveyId/c/:collectorId" element={<SurveyTakingPage />} />

                    {/* NEW Route to handle public /s/:accessIdentifier links */}
                    {/* This will fetch survey/collector details and then navigate or render SurveyTakingPage */}
                    <Route path="/s/:accessIdentifier" element={<PublicSurveyHandler />} />
                    
                    <Route path="/thank-you" element={<ThankYouPage />} />

                    {/* --- Protected Admin Routes --- */}
                    <Route element={<ProtectedRoute />}>
                        <Route path="/admin" element={<AdminPage />} />
                        <Route path="/admin/surveys/:surveyId" element={<AdminSurveyDetailPage />} />
                        <Route path="/admin/surveys/:surveyId/build" element={<SurveyBuildPage />} />
                        <Route path="/admin/surveys/:surveyId/results" element={<SurveyResultsPage />} />
                    </Route>

                    <Route path="*" element={<NotFoundPage />} />
                </Routes>
            </main>
        </div>
    );
}

export default App;
// ----- END OF COMPLETE MODIFIED FILE -----