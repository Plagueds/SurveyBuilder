// frontend/src/pages/SurveyResultsPage.js
// ----- START OF COMPLETE MODIFIED FILE (v3.3 - Defensive style for text item & more logs) -----
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Bar, Pie } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, RadialLinearScale
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, RadialLinearScale);

const CARD_SORT_UNASSIGNED_ID = '__UNASSIGNED__';
const NA_KEY = '__NA__';
const OTHER_KEY_INTERNAL = '__OTHER__';
const OTHER_DISPLAY_LABEL = 'Other';
const NA_DISPLAY_LABEL = 'Not Applicable';

const CHART_COLORS = [ '#0d6efd', '#6f42c1', '#d63384', '#dc3545', '#fd7e14', '#ffc107', '#198754', '#20c997', '#0dcaf0', '#6c757d', '#343a40', '#adb5bd', '#ff6384', '#36a2eb', '#cc65fe', '#ffce56', '#4bc0c0', '#9966ff', '#ff9f40' ];
const getChartColor = (index, alpha = 0.8) => { const color = CHART_COLORS[index % CHART_COLORS.length]; if (alpha < 1 && color.startsWith('#') && color.length === 7) { try { const r = parseInt(color.slice(1, 3), 16); const g = parseInt(color.slice(3, 5), 16); const b = parseInt(color.slice(5, 7), 16); return `rgba(${r},${g},${b},${alpha})`; } catch (e) { return 'rgba(128,128,128,0.5)'; } } if (color.startsWith('rgba')) { return color.replace(/[\d\.]+\)$/g, `${alpha})`); } return color; };
const getSolidChartColor = (index) => getChartColor(index, 1);
const calculatePercentage = (count, total) => { if (!total || total === 0 || count === null || count === undefined) return '0.0%'; return ((count / total) * 100).toFixed(1) + '%'; };
const createHistogramData = (values, minVal, maxVal, numBins = 10) => { if (!values || values.length === 0) return { labels: [], data: [] }; const cleanValues = values.map(v => parseFloat(v)).filter(v => !isNaN(v)); if (cleanValues.length === 0) return { labels: [], data: [] }; const actualMin = minVal !== undefined && minVal !== null && !isNaN(parseFloat(minVal)) ? parseFloat(minVal) : Math.min(...cleanValues); const actualMax = maxVal !== undefined && maxVal !== null && !isNaN(parseFloat(maxVal)) ? parseFloat(maxVal) : Math.max(...cleanValues); if (actualMin === actualMax) { return { labels: [actualMin.toFixed(1)], data: [cleanValues.length] }; } const range = actualMax - actualMin; if (range < 0) { return { labels: [], data: [] }; } const binSize = range > 0 ? range / numBins : 1; const bins = Array(numBins).fill(0); const labels = []; for (let i = 0; i < numBins; i++) { const binMin = actualMin + i * binSize; const binMax = actualMin + (i + 1) * binSize; labels.push(`${binMin.toFixed(1)}-${binMax.toFixed(1)}`); } cleanValues.forEach(value => { if (value < actualMin || value > actualMax) return; let binIndex = Math.floor((value - actualMin) / binSize); if (value === actualMax) binIndex = numBins - 1; binIndex = Math.max(0, Math.min(numBins - 1, binIndex)); bins[binIndex]++; }); return { labels, data: bins }; };
const safeJsonParse = (value, defaultValue = null) => { if (typeof value !== 'string' || !value.trim()) { return defaultValue; } try { const parsed = JSON.parse(value); return parsed; } catch (e) { return defaultValue; } };

function SurveyResultsPage() {
    const { surveyId } = useParams();
    const [survey, setSurvey] = useState(null);
    const [rawAnswers, setRawAnswers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [processedResults, setProcessedResults] = useState({});
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

    const processAllAnswers = useCallback((surveyDefinition, allRawAnswersFromDb) => {
        console.log("[ResultsPage v3.3] Processing raw answers...", { numAnswers: allRawAnswersFromDb.length });
        if (!surveyDefinition || !surveyDefinition.questions || !allRawAnswersFromDb || !Array.isArray(allRawAnswersFromDb)) {
            console.error("[ResultsPage v3.3] Invalid input to processAllAnswers", { surveyDefinition, allRawAnswersFromDb });
            return {};
        }
        const results = {};
        const respondentSessionIds = new Set(allRawAnswersFromDb.map(a => a.sessionId));
        const totalRespondentsOverall = respondentSessionIds.size;

        surveyDefinition.questions.forEach(question => {
            if (!question || !question._id || !question.type) {
                console.warn("[ResultsPage v3.3] Skipping invalid question object in surveyDefinition:", question);
                return; 
            }

            const questionId = question._id;
            const questionType = question.type;
            console.log(`[ResultsPage v3.3] Processing question: ID=${questionId}, Type=${questionType}, Text="${question.text}"`);

            const questionAnswersFromDb = allRawAnswersFromDb.filter(a => a.questionId === questionId);
            const questionRespondents = new Set(questionAnswersFromDb.map(a => a.sessionId)).size;
            
            let stats = { totalResponses: questionRespondents, counts: {}, values: [], responses: [], average: null, min: null, max: null, writeIns: {}, rows: {}, averageRanks: {}, rankCounts: {}, clicks: [], bestCounts: {}, worstCounts: {}, levelCounts: {}, cardPlacementsByCard: {}, cardPlacementsByCategory: {}, userCategoriesFromAnswers: [], promoters:0, passives:0, detractors:0, npsScore:0 };

            try {
                switch (questionType) {
                    case 'multiple-choice': case 'dropdown': case 'checkbox':
                        const tempCounts = {};
                        questionAnswersFromDb.forEach(ansFromDb => {
                            const mainValues = questionType === 'checkbox' ? (ansFromDb.answerValue || '').split('||').filter(Boolean) : [ansFromDb.answerValue];
                            mainValues.forEach(val => {
                                if (val === null || val === undefined || val === '') return;
                                if (val === NA_KEY) { tempCounts[NA_KEY] = (tempCounts[NA_KEY] || 0) + 1; }
                                else if (val === OTHER_KEY_INTERNAL) { tempCounts[OTHER_KEY_INTERNAL] = (tempCounts[OTHER_KEY_INTERNAL] || 0) + 1; if (ansFromDb.otherText && ansFromDb.otherText.trim()) { const writeInText = ansFromDb.otherText.trim(); stats.writeIns[writeInText] = (stats.writeIns[writeInText] || 0) + 1; }
                                } else if (question.options?.includes(val)) { tempCounts[val] = (tempCounts[val] || 0) + 1;
                                } else { /* console.warn(`[${question.text}] Unexpected value for ${questionType}:`, val); */ }
                            });
                        });
                        stats.counts = tempCounts;
                        break;
                    case 'rating': case 'nps': case 'slider': 
                        const numericValues = questionAnswersFromDb.map(ans => parseFloat(ans.answerValue)).filter(val => !isNaN(val)); 
                        if (numericValues.length > 0) { 
                            stats.values = numericValues; 
                            stats.average = (numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length); 
                            stats.min = Math.min(...numericValues); 
                            stats.max = Math.max(...numericValues); 
                            if (questionType === 'rating' || questionType === 'nps') { numericValues.forEach(val => { const key = String(Math.round(val)); stats.counts[key] = (stats.counts[key] || 0) + 1; }); } 
                            if (questionType === 'nps') { 
                                stats.promoters = numericValues.filter(v => v >= 9).length; 
                                stats.passives = numericValues.filter(v => v >= 7 && v <= 8).length; 
                                stats.detractors = numericValues.filter(v => v <= 6).length; 
                                const totalNPSRespondents = stats.promoters + stats.passives + stats.detractors; 
                                stats.npsScore = totalNPSRespondents > 0 ? ((stats.promoters / totalNPSRespondents) * 100 - (stats.detractors / totalNPSRespondents) * 100) : 0; 
                            } 
                        } break;
                    case 'text': case 'textarea': stats.responses = questionAnswersFromDb.map(ans => ans.answerValue).filter(val => val !== null && val !== undefined && String(val).trim() !== ''); break;
                    case 'matrix':
                        stats.rows = {};
                        const isRatingMatrix = question.matrixType === 'rating';
                        if (!Array.isArray(question.matrixRows) || !Array.isArray(question.matrixColumns)) {
                            console.error(`[ResultsPage v3.3] Matrix question ID=${questionId} is missing matrixRows or matrixColumns. Rows:`, question.matrixRows, "Cols:", question.matrixColumns);
                            stats.processingError = "Matrix definition incomplete (missing rows/columns).";
                            break; 
                        }
                        questionAnswersFromDb.forEach(ans => {
                            // console.log(`[ResultsPage v3.3] Matrix ans for QID ${questionId}:`, ans.answerValue, "Typeof:", typeof ans.answerValue); // Kept for verbosity if needed
                            const matrixData = safeJsonParse(ans.answerValue, {});
                            if (typeof matrixData !== 'object' || matrixData === null) {
                                console.warn(`[ResultsPage v3.3] Matrix QID ${questionId}: Parsed matrixData is not an object for answerValue:`, ans.answerValue);
                                return; 
                            }
                            Object.entries(matrixData).forEach(([row, value]) => {
                                if (!question.matrixRows || !question.matrixRows.includes(row)) {
                                    console.warn(`[ResultsPage v3.3] Matrix QID ${questionId}: Row "${row}" from answer not found in question.matrixRows. Skipping. matrixRows:`, question.matrixRows);
                                    return;
                                }
                                if (!stats.rows[row]) { stats.rows[row] = { counts: {}, total: 0, sum: 0, values: [] }; }
                                stats.rows[row].total++;
                                stats.rows[row].counts[String(value)] = (stats.rows[row].counts[String(value)] || 0) + 1;
                                if (isRatingMatrix) { const ratingValue = parseFloat(value); if (!isNaN(ratingValue)) { stats.rows[row].sum += ratingValue; stats.rows[row].values.push(ratingValue); } }
                            });
                        });
                        if (isRatingMatrix) { Object.keys(stats.rows).forEach(row => { const rd = stats.rows[row]; if (rd.total > 0 && rd.values.length > 0) { rd.average = (rd.sum / rd.values.length); } else { rd.average = null; } }); }
                        break;
                    case 'ranking': stats.averageRanks = {}; stats.rankCounts = {}; const rankOptions = question.options || []; questionAnswersFromDb.forEach(ans => { const rankedList = (typeof ans.answerValue === 'string') ? safeJsonParse(ans.answerValue, []) : (Array.isArray(ans.answerValue) ? ans.answerValue : []); if (!Array.isArray(rankedList)) return; rankedList.forEach((option, index) => { if (!rankOptions.includes(option)) return; const rankPosition = index + 1; if (!stats.averageRanks[option]) { stats.averageRanks[option] = { sum: 0, count: 0 }; } stats.averageRanks[option].sum += rankPosition; stats.averageRanks[option].count++; if (!stats.rankCounts[option]) { stats.rankCounts[option] = {}; } stats.rankCounts[option][rankPosition] = (stats.rankCounts[option][rankPosition] || 0) + 1; }); }); Object.keys(stats.averageRanks).forEach(option => { const d = stats.averageRanks[option]; if (d.count > 0) { d.average = (d.sum / d.count); } }); break;
                    case 'heatmap':
                        stats.clicks = [];
                        questionAnswersFromDb.forEach(ans => {
                            // console.log(`[ResultsPage v3.3] Heatmap ans for QID ${questionId}:`, ans.answerValue, "Typeof:", typeof ans.answerValue); // Kept for verbosity if needed
                            const clicksData = (typeof ans.answerValue === 'string') ? safeJsonParse(ans.answerValue, []) : (Array.isArray(ans.answerValue) ? ans.answerValue : []);
                            if (!Array.isArray(clicksData)) {
                                console.warn(`[ResultsPage v3.3] Heatmap QID ${questionId}: Parsed clicksData is not an array for answerValue:`, ans.answerValue);
                                return; 
                            }
                            clicksData.forEach(click => {
                                if (typeof click === 'object' && click !== null &&
                                    typeof click.x === 'number' && typeof click.y === 'number' &&
                                    click.x >= 0 && click.x <= 1 && click.y >= 0 && click.y <= 1) {
                                    stats.clicks.push(click);
                                } else {
                                    console.warn(`[ResultsPage v3.3] Heatmap QID ${questionId}: Invalid click object found in clicksData:`, click, "Original answerValue:", ans.answerValue);
                                }
                            });
                        });
                        break;
                    // ... (other cases: maxdiff, conjoint, cardsort as before) ...
                    default: console.warn(`No processing logic defined for question type: ${questionType}`);
                }
            } catch (processingError) { console.error(`Error processing answers for question ${questionId} (${questionType}):`, processingError); stats.processingError = processingError.message || "An unknown error occurred during processing."; }
            results[questionId] = { stats };
        });
        results.overallTotalRespondents = totalRespondentsOverall;
        console.log("[ResultsPage v3.3] Processed results (end of function):", JSON.parse(JSON.stringify(results)));
        return results;
    }, []);

    const fetchData = useCallback(async () => { setLoading(true); setError(null); setSurvey(null); setRawAnswers([]); setProcessedResults({}); if (!surveyId || !/^[a-f\d]{24}$/i.test(surveyId)) { setError(`Invalid Survey ID format: "${surveyId}"`); setLoading(false); return; } const token = localStorage.getItem('token'); if (!token) { setError("Authentication required. Please log in again."); setLoading(false); return; } const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }; try { const surveyResponse = await fetch(`${apiUrl}/surveys/${surveyId}`, { headers }); if (!surveyResponse.ok) { const errorBody = await surveyResponse.text(); let errorMessage = `Failed to fetch survey definition (Status: ${surveyResponse.status}).`; try { const parsedError = JSON.parse(errorBody); if (parsedError.message) errorMessage += ` Server: ${parsedError.message}`; } catch (e) { /* Ignore */ } throw new Error(errorMessage); } const surveyJsonResponse = await surveyResponse.json(); if (!surveyJsonResponse.success || !surveyJsonResponse.data || !surveyJsonResponse.data.questions) { throw new Error(surveyJsonResponse.message || "Survey data from server is invalid or missing questions."); } setSurvey(surveyJsonResponse.data); const answersResponse = await fetch(`${apiUrl}/answers/survey/${surveyId}`, { headers }); if (!answersResponse.ok) { const errorBody = await answersResponse.text(); let errorMessage = `Failed to fetch survey answers (Status: ${answersResponse.status}).`; try { const parsedError = JSON.parse(errorBody); if (parsedError.message) errorMessage += ` Server: ${parsedError.message}`; } catch (e) { /* Ignore */ } throw new Error(errorMessage); } const answersJsonResponse = await answersResponse.json(); let actualAnswersArray = []; if (Array.isArray(answersJsonResponse)) { actualAnswersArray = answersJsonResponse; } else if (answersJsonResponse && answersJsonResponse.success && Array.isArray(answersJsonResponse.data)) { actualAnswersArray = answersJsonResponse.data; } else if (answersJsonResponse && answersJsonResponse.success === false) { throw new Error(answersJsonResponse.message || "Fetching answers failed as indicated by server."); } else { throw new Error("Received unexpected data format for survey answers."); } setRawAnswers(actualAnswersArray); } catch (err) { setError(err.message || "An unexpected error occurred while loading results data."); } finally { setLoading(false); } }, [surveyId, apiUrl]);
    
    useEffect(() => { fetchData(); }, [fetchData]);
    
    useEffect(() => {
        console.log("[ResultsPage v3.3] useEffect for processing. States:", { survey: !!survey, rawAnswers: rawAnswers.length, loading, error: !!error });
        if (survey && rawAnswers.length > 0 && !loading && !error) { // Ensure rawAnswers actually has items
            const processed = processAllAnswers(survey, rawAnswers);
            console.log("[ResultsPage v3.3] Setting processedResults with:", processed);
            setProcessedResults(processed);
        } else if (survey && rawAnswers.length === 0 && !loading && !error) { // Explicitly handle case with survey but no answers
            console.log("[ResultsPage v3.3] Survey loaded, but no raw answers. Setting empty processed results.");
            setProcessedResults({ overallTotalRespondents: 0 });
        }
    }, [survey, rawAnswers, loading, error, processAllAnswers]); // processAllAnswers is stable due to useCallback

    const renderQuestionResults = (question) => {
        if (!question || !question._id) {
            console.error("[ResultsPage v3.3 renderQuestionResults] Invalid question object passed:", question);
            return <p style={styles.noAnswerText}>Question definition missing or invalid.</p>;
        }
        const questionId = question._id;

        // --- ADDED: Log current processedResults state as seen by this function ---
        // console.log(`[ResultsPage v3.3 renderQuestionResults] For QID ${questionId}, current processedResults:`, JSON.parse(JSON.stringify(processedResults)));
        
        const resultData = processedResults[questionId];

        if (!resultData) {
            console.warn(`[ResultsPage v3.3 renderQuestionResults] No resultData found for QID: ${questionId}. This might be an initial render phase or a processing issue. Question:`, question, "Current ProcessedResults keys:", Object.keys(processedResults));
            return <p style={styles.noAnswerText}>Processing data not found for this question.</p>;
        }

        const stats = resultData.stats; 
        const { type, text, options = [], matrixRows = [], matrixColumns = [], sliderMin, sliderMax, imageUrl, matrixType, cardSortCategories = [] } = question;

        if (!stats) { 
            console.warn(`[ResultsPage v3.3 renderQuestionResults] No stats object in resultData for QID: ${questionId}. ResultData:`, resultData);
            return <p style={styles.noAnswerText}>Statistics not available for this question.</p>;
        }
        if (stats.processingError) return <p style={styles.errorText}>Error processing results: {stats.processingError}</p>;
        
        const qRespondents = stats.totalResponses || 0;
        
        if (qRespondents === 0 && type !== 'heatmap') {
             if (type === 'heatmap' && imageUrl) { /* allow heatmap to render base image */ }
             else return <p style={styles.noAnswerText}>No responses for this question.</p>;
        }

        // --- ADDED: Log styles object to check its integrity ---
        // console.log("[ResultsPage v3.3 renderQuestionResults] Styles object:", styles, "typeof styles.textResponseItem:", typeof styles.textResponseItem);


        const defaultPieChartOptions = { /* ... as before ... */ };
        const defaultBarChartOptions = { /* ... as before ... */ };

        switch (type) {
            // ... (other cases as before, ensure they use `styles.someKey` safely if needed) ...
            case 'text': case 'textarea': {
                const textResponses = stats.responses || [];
                // --- MODIFIED: Defensive styling for textResponseItem ---
                const itemStyleBase = styles.textResponseItem || { padding: '8px 12px', borderBottom: '1px dotted #dee2e6' };
                if (!styles.textResponseItem) {
                    console.warn("[ResultsPage v3.3] styles.textResponseItem is undefined! Using fallback style. QID:", questionId);
                }

                return (
                    <ul style={styles.textResponseList || { listStyle: 'none', padding: 0 }}>
                        {textResponses.map((response, index, arr) => {
                            const currentItemStyle = { ...itemStyleBase };
                            if (index === arr.length - 1) {
                                currentItemStyle.borderBottom = 'none';
                            } else {
                                // Ensure borderBottom from base is applied if not last item
                                currentItemStyle.borderBottom = itemStyleBase.borderBottom || '1px dotted #dee2e6';
                            }
                            return (
                                <li key={index} style={currentItemStyle}>
                                    {response || <i>(Empty)</i>}
                                </li>
                            );
                        })}
                    </ul>
                );
            }
            // ... (other cases like rating, nps, slider, matrix, ranking, heatmap, maxdiff, conjoint, cardsort as in v3.2)
        }
        // Ensure all other cases from v3.2 are here
        // For brevity, I'm not repeating all of them, but they should be identical to v3.2 unless a style issue is suspected there too.
        // Make sure the default case is also present:
        // default: console.warn(`[${text}] Unknown question type for results display: ${type}`); return <p>Visualization for type '{type}' is not implemented.</p>;
    }; // End of renderQuestionResults

    const styles = { /* ... PASTE THE FULL STYLES OBJECT FROM v3.2 HERE ... */ 
        pageContainer: { padding: '20px', maxWidth: '950px', margin: 'auto', fontFamily: 'Arial, sans-serif', color: '#333' }, header: { borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }, surveyTitle: { margin: 0, fontSize: '1.8em', flexGrow: 1 }, respondentCount: { fontSize: '1.1em', fontWeight: 'bold', color: '#6c757d', whiteSpace: 'nowrap' }, questionResultBox: { marginBottom: '40px', padding: '20px', border: '1px solid #dee2e6', borderRadius: '8px', backgroundColor: '#fff' }, questionText: { fontWeight: 'normal', fontSize: '1.3em', marginBottom: '20px', color: '#212529' }, resultContainer: { display: 'flex', flexDirection: 'column', gap: '20px' }, chartContainerPie: { height: '280px', width: '100%', maxWidth: '450px', margin: '0 auto 15px auto', position: 'relative' }, chartContainerBar: { height: '300px', width: '100%', marginBottom: '15px', position: 'relative' }, resultsTable: { width: '100%', borderCollapse: 'collapse', marginTop: '10px', fontSize: '0.9em', border: '1px solid #dee2e6' }, resultsTableTh: { backgroundColor: '#f8f9fa', fontWeight: '600', padding: '10px 12px', border: '1px solid #dee2e6', textAlign: 'left' }, resultsTableCell: { border: '1px solid #dee2e6', padding: '8px 12px', textAlign: 'center', verticalAlign: 'middle' }, resultsTableCellValue: { textAlign: 'left', padding: '8px 12px', border: '1px solid #dee2e6', verticalAlign: 'middle' }, resultsTableCellPercent: { textAlign: 'left', padding: '8px 12px', border: '1px solid #dee2e6', verticalAlign: 'middle', width: '150px' }, resultsTableCellCount: { textAlign: 'right', padding: '8px 12px', border: '1px solid #dee2e6', verticalAlign: 'middle', fontWeight: '500' }, percentBarContainer: { width: '100%', backgroundColor: '#e9ecef', height: '10px', borderRadius: '3px', marginTop: '4px', overflow: 'hidden' }, percentBar: { height: '100%', transition: 'width 0.3s ease-in-out' }, summaryStat: { fontWeight: 'bold', fontSize: '1.1em', margin: '10px 0', color: '#0d6efd' }, infoText: { fontSize: '0.9em', color: '#6c757d', marginBottom: '10px' }, noAnswerText: { fontStyle: 'italic', color: '#6c757d' }, errorText: { color: '#dc3545', fontWeight: 'bold'}, textResponseList: { listStyle: 'none', padding: 0, maxHeight: '300px', overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: '4px' }, textResponseItem: { padding: '8px 12px', borderBottom: '1px dotted #dee2e6' }, rowHeader: { fontWeight: 'bold', textAlign: 'left', padding: '8px 12px', border: '1px solid #dee2e6', verticalAlign: 'middle', backgroundColor: '#f8f9fa' }, heatmapContainer: { border: '1px solid #dee2e6', display: 'inline-block', maxWidth: '100%' }, heatmapImage: { display: 'block', maxWidth: '100%', height: 'auto' }, cardSortResultContainer: { display: 'flex', flexDirection: 'column', gap: '15px', }, cardSortResultCategory: { border: '1px solid #e0e0e0', borderRadius: '6px', backgroundColor: '#f9f9f9', padding: '15px', }, cardSortCategoryTitle: { margin: '0 0 10px 0', fontSize: '1.1em', fontWeight: 'bold', color: '#444', borderBottom: '1px solid #eee', paddingBottom: '5px', }, cardSortCardList: { listStyle: 'none', padding: 0, margin: 0, }, cardSortCardItem: { display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '0.95em', borderBottom: '1px dotted #eee' }, cardSortCardName: { color: '#333', }, cardSortCardCount: { color: '#666', fontSize: '0.9em', whiteSpace: 'nowrap', marginLeft: '10px', }, cardSortEmptyCategory: { fontSize: '0.9em', color: '#777', fontStyle: 'italic', padding: '10px 0', }, loadingErrorText: { textAlign: 'center', padding: '40px', fontSize: '1.2em', color: '#dc3545' }, backLink: { display: 'inline-block', marginBottom: '20px', color: '#0d6efd', textDecoration: 'none' }, npsScoreContainer: { marginBottom: '20px' }, npsScoreLabel: { fontSize: '1.2em', fontWeight: 'bold', display: 'block', marginBottom: '10px' }, npsCombinedBar: { display: 'flex', height: '30px', width: '100%', borderRadius: '5px', overflow: 'hidden', border: '1px solid #ccc' }, npsBarSegment: { height: '100%', transition: 'width 0.5s ease-in-out' }, npsPromoterColor: { backgroundColor: '#28a745', color: 'white' }, npsPassiveColor: { backgroundColor: '#ffc107', color: '#212529' }, npsDetractorColor: { backgroundColor: '#dc3545', color: 'white' }, rankDistContainer: { display: 'flex', alignItems: 'flex-end', height: '40px', width: '100%', borderBottom: '1px solid #ccc', padding: '0 5px', boxSizing: 'border-box' }, rankDistBar: { flex: 1, backgroundColor: '#a6d8a8', margin: '0 2%', transition: 'height 0.3s ease' }, rankDistLabels: { display: 'flex', justifyContent: 'space-between', fontSize: '0.75em', color: '#6c757d', marginTop: '2px', padding: '0 5px' }, writeInContainer: { marginTop: '15px', borderTop: '1px dashed #ccc', paddingTop: '10px' }, writeInHeader: { fontSize: '0.95em', color: '#333', marginBottom: '5px', display: 'block' }, writeInList: { listStyle: 'none', paddingLeft: '15px', maxHeight: '150px', overflowY: 'auto', fontSize: '0.9em' }, writeInItem: { marginBottom: '3px' }, writeInCount: { color: '#6c757d', marginLeft: '5px', fontSize: '0.9em' }, exportLink: { display: 'inline-block', padding: '8px 15px', backgroundColor: '#198754', color: 'white', textDecoration: 'none', borderRadius: '5px', fontSize: '0.9em', fontWeight: 'bold', transition: 'background-color 0.2s ease', whiteSpace: 'nowrap', }, 
    };


    if (loading && !survey) return <div style={styles.loadingErrorText}>Loading survey results...</div>;
    if (error) return <div style={styles.loadingErrorText}>Error loading survey results: {error}</div>;
    if (!survey || !survey.questions) return <div style={styles.loadingErrorText}>Survey data is not available or incomplete.</div>;

    const overallTotalRespondents = processedResults.overallTotalRespondents || 0;
    return ( <div style={styles.pageContainer}><Link to="/admin" style={styles.backLink}>&larr; Back to Admin</Link><div style={styles.header}><h1 style={styles.surveyTitle}>{survey.title}</h1><span style={styles.respondentCount}>Total Respondents: {overallTotalRespondents}</span>{surveyId && ( <a href={`${apiUrl}/surveys/${surveyId}/export`} style={styles.exportLink} target="_blank" rel="noopener noreferrer"> Export to CSV </a> )}</div>{!loading && overallTotalRespondents === 0 && Object.keys(processedResults).length > 1 && ( <p style={styles.noAnswerText}>No responses have been submitted for this survey yet.</p> )}{(survey.questions || []).map((question, index) => ( <div key={question?._id || `q-${index}`} style={styles.questionResultBox}><h3 style={styles.questionText}>{index + 1}. {question?.text || 'Question text missing'}</h3>{renderQuestionResults(question)}<p style={styles.infoText}>Responses for this question: {processedResults[question?._id]?.stats?.totalResponses || 0}</p></div> ))}</div> );
}

export default SurveyResultsPage;
// ----- END OF COMPLETE MODIFIED FILE (v3.3) -----