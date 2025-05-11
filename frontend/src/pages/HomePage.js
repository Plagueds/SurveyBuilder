// frontend/src/pages/HomePage.js
// ----- START OF MODIFIED FILE -----
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import surveyApi from '../api/surveyApi';

function HomePage() {
    const [activeSurveys, setActiveSurveys] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchActiveSurveys = useCallback(async () => {
        console.log("HomePage: Fetching active surveys using surveyApi...");
        setLoading(true);
        setError(null);
        try {
            const responseData = await surveyApi.getAllSurveys('active');
            console.log("HomePage: Raw response from getAllSurveys:", responseData);

            if (responseData && responseData.success && Array.isArray(responseData.data)) {
                setActiveSurveys(responseData.data);
                console.log("HomePage: Active surveys set:", responseData.data);
            } else if (Array.isArray(responseData)) {
                // Fallback if the API were to directly return an array (less likely given current logs)
                setActiveSurveys(responseData);
                console.log("HomePage: Active surveys set (direct array):", responseData);
            } else {
                // Handle cases where the response structure is not as expected
                console.warn("HomePage: Unexpected data structure for active surveys or operation not successful.", responseData);
                // If responseData.success is false, use its message if available
                if (responseData && !responseData.success && responseData.message) {
                    setError(responseData.message);
                } else if (!responseData || !responseData.success) {
                    setError("Failed to retrieve active surveys or data is in an unexpected format.");
                }
                setActiveSurveys([]);
            }

        } catch (err) {
            console.error("HomePage: Failed to fetch active surveys:", err);
            const errorMessage = err.response?.data?.message || err.message || "Could not load available surveys.";
            setError(errorMessage);
            setActiveSurveys([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchActiveSurveys();
    }, [fetchActiveSurveys]);

    return (
        <div>
            <h1>Available Surveys</h1>
            <p>Select a survey below to participate.</p>

            {error && (
                <p style={{
                    color: 'var(--error-text)',
                    backgroundColor: 'var(--error-bg)',
                    border: `1px solid var(--error-border)`,
                    padding: '10px',
                    margin: '20px 0',
                    borderRadius: 'var(--border-radius-sm, 4px)'
                }}>
                    Error loading surveys: {error}
                </p>
            )}

            {loading && <p>Loading available surveys...</p>}

            {!loading && !error && activeSurveys.length === 0 && (
                <p style={{
                    color: 'var(--text-muted)',
                    marginTop: '30px',
                    padding: '15px',
                    border: `1px dashed var(--border-color)`,
                    borderRadius: 'var(--border-radius-sm, 4px)',
                    textAlign: 'center',
                    backgroundColor: 'var(--background-accent)'
                 }}>
                    No active surveys available at the moment. Please check back later.
                </p>
            )}

            {!loading && !error && activeSurveys.length > 0 && (
                <ul style={{ listStyle: 'none', padding: 0 }}>
                    {activeSurveys.map(survey => (
                        <li key={survey._id} style={{
                            border: `1px solid var(--border-color)`,
                            borderRadius: 'var(--border-radius, 8px)',
                            marginBottom: '15px',
                            padding: '15px 20px',
                            backgroundColor: 'var(--background-secondary)',
                            boxShadow: 'var(--shadow-medium, 0 2px 5px rgba(0,0,0,0.1))',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '15px'
                        }}>
                            <div>
                                <h3 style={{ marginTop: 0, marginBottom: '5px', color: 'var(--text-primary)' }}>{survey.title}</h3>
                                {survey.description && (
                                    <p style={{
                                        fontSize: '0.9em',
                                        color: 'var(--text-secondary)',
                                        margin: 0
                                    }}>
                                        {survey.description}
                                    </p>
                                )}
                            </div>
                            <Link
                                to={`/surveys/${survey._id}`}
                                className="button button-primary"
                                style={{ flexShrink: 0 }}
                            >
                                Take Survey
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default HomePage;
// ----- END OF MODIFIED FILE -----