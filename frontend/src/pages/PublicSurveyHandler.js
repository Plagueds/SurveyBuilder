// frontend/src/pages/PublicSurveyHandler.js
// ----- START OF COMPLETE UPDATED FILE (v1.1 - Pass reCAPTCHA settings) -----
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import surveyApiFunctions from '../api/surveyApi';

const PublicSurveyHandler = () => {
    const { accessIdentifier } = useParams();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const handleAccess = async () => {
            setIsLoading(true);
            setError(null);
            try {
                console.log(`[PublicSurveyHandler] Accessing survey with identifier: ${accessIdentifier}`);
                const response = await surveyApiFunctions.accessPublicSurvey(accessIdentifier);
                console.log('[PublicSurveyHandler] Response from accessPublicSurvey:', response);

                // <<< MODIFIED: Expect collectorSettings in response.data >>>
                if (response && response.success && response.data && response.data.surveyId && response.data.collectorId) {
                    const { surveyId, collectorId, collectorSettings } = response.data; // Expect collectorSettings
                    
                    console.log(`[PublicSurveyHandler] Extracted surveyId: '${surveyId}', collectorId: '${collectorId}'`);
                    console.log(`[PublicSurveyHandler] Collector Settings received:`, collectorSettings);


                    if (typeof surveyId !== 'string' || surveyId.includes('<anonymous') || surveyId.length < 5) {
                        throw new Error(`Invalid surveyId ('${surveyId}') received from API.`);
                    }
                    if (typeof collectorId !== 'string' || collectorId.includes('<anonymous') || collectorId.length < 5) {
                        throw new Error(`Invalid collectorId ('${collectorId}') received from API.`);
                    }

                    console.log(`[PublicSurveyHandler] Navigating to: /surveys/${surveyId}/c/${collectorId} with settings.`);
                    navigate(`/surveys/${surveyId}/c/${collectorId}`, {
                        replace: true,
                        state: { collectorSettings: collectorSettings || {} } // <<< MODIFIED: Pass collectorSettings via route state
                    });
                } else {
                    const message = response?.message || 'API response lacked success flag or necessary data (surveyId, collectorId, collectorSettings).';
                    console.error('[PublicSurveyHandler] API response issue or missing data:', response);
                    throw new Error(message);
                }
            } catch (err) {
                const errorMessage = err.message || 'An unexpected error occurred in PublicSurveyHandler.';
                console.error(`[PublicSurveyHandler] CATCH BLOCK: Error processing survey access for ${accessIdentifier}:`, err);
                setError(`${errorMessage}`);
                toast.error(`Error: ${errorMessage}`);
                setIsLoading(false);
            }
        };

        if (!accessIdentifier) {
            setError('No access identifier provided in the link.');
            setIsLoading(false);
            toast.error('Invalid survey link: Missing identifier.');
            return;
        }
        handleAccess();
    }, [accessIdentifier, navigate]);

    if (isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 60px)', flexDirection: 'column', padding: '20px', boxSizing: 'border-box' }}>
                <div className="spinner" style={{ width: '50px', height: '50px', borderTopColor: '#3498db', borderLeftColor: '#3498db', marginBottom: '20px' }}></div>
                <p style={{ fontSize: '1.2em' }}>Loading survey, please wait...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 60px)', flexDirection: 'column', padding: '20px', boxSizing: 'border-box', textAlign: 'center' }}>
                <h2 style={{ color: '#c0392b', marginBottom: '15px' }}>Survey Access Error</h2>
                <p style={{ marginBottom: '25px', fontSize: '1.1em', maxWidth: '600px' }}>{error}</p>
                <button
                    onClick={() => navigate('/')}
                    style={{ padding: '10px 20px', fontSize: '1em', color: 'white', backgroundColor: '#3498db', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
                >
                    Go to Homepage
                </button>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 60px)', padding: '20px', boxSizing: 'border-box' }}>
            <p>Finalizing survey access...</p>
        </div>
    );
};

export default PublicSurveyHandler;
// ----- END OF COMPLETE UPDATED FILE (v1.1 - Pass reCAPTCHA settings) -----