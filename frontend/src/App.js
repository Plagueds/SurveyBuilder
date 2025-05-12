// frontend/src/App.js
// ----- START OF COMPLETE MODIFIED FILE (v1.2 - Added route for Survey Thank You Preview) -----
import React from 'react';
import { Routes, Route, useLocation, Navigate, Outlet } from 'react-router-dom';
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
    const { isAuthenticated, isLoading: authIsLoading } = useAuth();

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
                    
                    {/* ADDED ROUTE FOR SURVEY PREVIEW THANK YOU PAGE */}
                    <Route path="/survey/:surveyId/thankyou-preview" element={<ThankYouPage />} />
                    
                    <Route path="/thank-you" element={<ThankYouPage />} /> {/* Generic thank you page */}
                    
                    {/* --- Protected Routes Wrapper --- */}
                    <Route element={isAuthenticated ? <Outlet /> : <Navigate to="/login" state={{ from: location }} replace />}>
                        <Route path="/admin" element={<AdminPage />} />
                        <Route path="/admin/surveys/:surveyId" element={<AdminSurveyDetailPage />} />
                        <Route path="/admin/surveys/:surveyId/build" element={<SurveyBuildPage />} />
                        <Route path="/admin/surveys/:surveyId/results" element={<SurveyResultsPage />} />
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
                    <Route 
                        path="*" 
                        element={
                            isAuthenticated
                                ? <NotFoundPage /> 
                                : <Navigate to="/login" replace /> 
                        }
                    />
                </Routes>
            </main>
        </div>
    );
}

export default App;
// ----- END OF COMPLETE MODIFIED FILE (v1.2 - Added route for Survey Thank You Preview) -----