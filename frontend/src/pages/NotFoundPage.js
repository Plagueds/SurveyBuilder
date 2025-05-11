// frontend/src/pages/NotFoundPage.js
import React from 'react';
import { Link } from 'react-router-dom';
// Optional: You can create a NotFoundPage.css if you want more specific styling
// import './NotFoundPage.css'; 

function NotFoundPage() {
  return (
    <div style={{ 
      textAlign: 'center', 
      marginTop: '50px', 
      padding: '20px', 
      color: 'var(--text-primary)', // Using theme variable
      backgroundColor: 'var(--background-secondary)', // Using theme variable
      borderRadius: 'var(--border-radius)',
      boxShadow: 'var(--shadow-medium)'
    }}>
      <h2>404 - Page Not Found</h2>
      <p style={{ color: 'var(--text-secondary)' }}>
        Sorry, the page you are looking for does not exist or may have been moved.
      </p>
      <Link 
        to="/" 
        className="button button-primary" // Use global button styles
        style={{ marginTop: '20px' }} // Additional inline style if needed
      >
        Go to Homepage
      </Link>
    </div>
  );
}

export default NotFoundPage;