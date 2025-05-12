// frontend/src/App.js
// ----- START OF COMPLETE MODIFIED FILE (v1.1 - Updated default routing) -----
import React from 'react';
import { Routes, Route, useLocation, Navigate, Outlet } from 'react-router-dom'; // Added Navigate, Outlet
import 'react-toastify/dist/ReactToastify.css';
import './App.css';

// --- Context Hook ---
import { useAuth } from './context/AuthContext';

// --- Component Imports ---
import Navbar from './components/Navbar';
// ProtectedRoute is already imported and will be used as an element wrapper

// --- Page Imports ---
// HomePage is no longer the primary landing page, but keep import if used elsewhere (e.g. as a placeholder)
// import HomePage from './pages/HomePage'; 
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AdminPage from './pages/AdminPage';
import AdminSurveyDetailPage from './pages/AdminSurveyDetailPage';
import SurveyBuildPage from './pages/SurveyBuildPage';
import SurveyResultsPage from './pages/SurveyResultsPage';
import SurveyTakingPage from './pages/SurveyTakingPage';
import SurveyPreviewPage from './pages/SurveyPreviewPage';
import ThankYouPage from './pages/ThankYouPage';
import NotFoundPage from './pages/NotFoundPage';
import PublicSurveyHandler from './pages/PublicSurveyHandler';

function App() {
    const location = useLocation();
    const { isAuthenticated, isLoading: authIsLoading } = useAuth(); // Renamed isLoading to authIsLoading

    // Determine if Navbar should be shown.
    // Example: Don't show on login/register if you prefer a cleaner look for those pages.
    const hideNavbarOnRoutes = ['/login', '/register'];
    const showNavbar = !hideNavbarOnRoutes.includes(location.pathname);

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
                    {/* --- Authentication Routes --- */}
                    {/* If authenticated, redirect from /login and /register to /admin */}
                    <Route 
                        path="/login" 
                        element={isAuthenticated ? <Navigate to="/admin" replace /> : <LoginPage />} 
                    />
                    <Route 
                        path="/register" 
                        element={isAuthenticated ? <Navigate to="/admin" replace /> : <RegisterPage />} 
                    />

                    {/* --- Public Survey Taking Flow --- */}
                    <Route path="/s/:accessIdentifier" element={<PublicSurveyHandler />} />
                    <Route path="/surveys/:surveyId/c/:collectorId" element={<SurveyTakingPage />} />
                    <Route path="/surveys/:surveyId/preview" element={<SurveyPreviewPage />} />
                    <Route path="/thank-you" element={<ThankYouPage />} />
                    
                    {/* --- Protected Routes Wrapper --- */}
                    {/* If not authenticated, ProtectedRoute logic (from ProtectedRoute.js) will redirect to /login */}
                    <Route element={isAuthenticated ? <Outlet /> : <Navigate to="/login" state={{ from: location }} replace />}>
                        <Route path="/admin" element={<AdminPage />} />
                        <Route path="/admin/surveys/:surveyId" element={<AdminSurveyDetailPage />} />
                        <Route path="/admin/surveys/:surveyId/build" element={<SurveyBuildPage />} />
                        <Route path="/admin/surveys/:surveyId/results" element={<SurveyResultsPage />} />
                        {/* Add any other admin/protected routes here */}
                    </Route>
                    
                    {/* --- Root Path Handling --- */}
                    <Route 
                        path="/" 
                        element={
                            isAuthenticated 
                                ? <Navigate to="/admin" replace /> 
                                : <Navigate to="/login" replace />
                        } 
                    />

                    {/* --- Catch-all for Not Found --- */}
                    {/* Redirect to an appropriate page based on auth status */}
                    <Route 
                        path="*" 
                        element={
                            isAuthenticated
                                ? <NotFoundPage /> // Or <Navigate to="/admin" replace />
                                : <Navigate to="/login" replace /> 
                        }
                    />
                </Routes>
            </main>
        </div>
    );
}

export default App;
// ----- END OF COMPLETE MODIFIED FILE (v1.1 - Updated default routing) -----