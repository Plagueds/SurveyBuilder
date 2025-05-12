// frontend/src/pages/ThankYouPage.js
// ----- START OF COMPLETE MODIFIED FILE (v2.1 - Preview Aware) -----
import React from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import styles from './ThankYouPage.module.css';

function ThankYouPage() {
    const { surveyId } = useParams(); // Gets surveyId if path is /survey/:surveyId/thankyou-preview
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const isRecordedPreview = queryParams.get('recorded') === 'true';

    // Determine if this is a preview thank you page based on surveyId presence in URL
    const isPreview = !!surveyId; 

    let heading = "Thank You!";
    let message = "Your survey response has been successfully submitted.";
    let primaryLinkPath = "/";
    let primaryLinkText = "Go to Homepage";
    let secondaryLinkPath = null;
    let secondaryLinkText = null;

    if (isPreview) {
        if (isRecordedPreview) {
            heading = "Preview Response 'Recorded'";
            message = "Your responses for this preview have been logged to the console for testing purposes. This was a preview and not a live submission.";
        } else {
            heading = "Preview Mode";
            message = "This was a preview of the survey. Your responses were not submitted or saved.";
        }
        primaryLinkPath = `/surveys/${surveyId}/preview`;
        primaryLinkText = "Back to Survey Preview";
        secondaryLinkPath = `/admin/surveys/${surveyId}/build`; // Link to survey builder
        secondaryLinkText = "Edit Survey";
    }
    // Add a case for generic /thank-you if a collectorId was part of the original survey taking URL
    // This might come from a redirect after SurveyTakingPage submission
    const fromCollector = location.state?.fromCollector; 
    if (!isPreview && fromCollector) {
         // Potentially customize message or links if coming from a specific collector submission
         // For now, it uses the default message.
    }


    return (
        <div className={styles.thankYouContainer}>
            <h1 className={styles.thankYouHeading}>{heading}</h1>
            <p className={styles.thankYouMessage}>{message}</p>
            
            <div className={styles.buttonContainer}>
                <Link to={primaryLinkPath} className={styles.primaryButton}>
                    {primaryLinkText}
                </Link>
                {secondaryLinkPath && (
                    <Link to={secondaryLinkPath} className={styles.secondaryButton}>
                        {secondaryLinkText}
                    </Link>
                )}
            </div>
        </div>
    );
}

export default ThankYouPage;
// ----- END OF COMPLETE MODIFIED FILE (v2.1 - Preview Aware) -----