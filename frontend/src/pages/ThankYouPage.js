// frontend/src/pages/ThankYouPage.js
// ----- START OF UPDATED FILE (v2.0 - Using CSS Module) -----
import React from 'react';
import { Link } from 'react-router-dom';
import styles from './ThankYouPage.module.css'; // <-- Import the new CSS module

function ThankYouPage() {
    return (
        // Use the container class from the CSS module
        <div className={styles.thankYouContainer}>
            {/* Apply specific classes to elements */}
            <h1 className={styles.thankYouHeading}>Thank You!</h1>
            <p className={styles.thankYouMessage}>
                Your survey response has been successfully submitted.
            </p>
            {/* Apply button class to the Link */}
            <Link to="/" className={styles.homeButton}>
                Go to Homepage
            </Link>
        </div>
    );
}

export default ThankYouPage;
// ----- END OF UPDATED FILE (v2.0 - Using CSS Module) -----