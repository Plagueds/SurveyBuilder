// frontend/src/index.js
// ----- START OF COMPLETE UPDATED FILE -----
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Ensure this is your main global stylesheet
import App from './App'; // This can still be your simplified App.js for testing this step
// import reportWebVitals from './reportWebVitals'; // Uncomment if you use it
import { BrowserRouter } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css'; // CSS for react-toastify
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext'; // Ensure this path is correct

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  // <React.StrictMode> // Keep commented for now, or enable if you want to test its effects separately later
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider> {/* AuthProvider is now active and wrapping App */}
          <App />
          <ToastContainer
            position="top-right"
            autoClose={3000} // Or your preferred duration
            hideProgressBar={false}
            newestOnTop={false}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme="colored" // Or "light", "dark"
          />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  // </React.StrictMode>
);

// If you use reportWebVitals:
// import reportWebVitals from './reportWebVitals';
// reportWebVitals(console.log); // Or your preferred handler
// ----- END OF COMPLETE UPDATED FILE -----