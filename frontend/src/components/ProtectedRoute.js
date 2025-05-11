// frontend/src/components/ProtectedRoute.js
// ----- START OF NEW FILE -----
import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = () => {
    const { isAuthenticated, isLoading } = useAuth();
    const location = useLocation();

    if (isLoading) {
        // Optional: Show a loading spinner or a blank page while auth state is being determined
        // This prevents a flash of the login page if the user is actually authenticated but isLoading is true initially
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <p>Loading authentication status...</p> {/* Replace with a proper spinner component */}
            </div>
        );
    }

    if (!isAuthenticated) {
        // Redirect them to the /login page, but save the current location they were
        // trying to go to when they were redirected. This allows us to send them
        // along to that page after they login, which is a nicer user experience
        // than dropping them off on the home page.
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return <Outlet />; // Renders the child route's element (e.g., AdminPage)
};

export default ProtectedRoute;
// ----- END OF NEW FILE -----