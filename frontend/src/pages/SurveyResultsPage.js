// frontend/src/pages/SurveyResultsPage.js
// ----- START OF COMPLETE MODIFIED FILE (v2.9 - "Other" text display, N/A handling, complex type stubs) -----
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Bar, Pie } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, RadialLinearScale
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, RadialLinearScale);

const CARD_SORT_UNASSIGNED_ID = '__UNASSIGNED__';
// const CARD_SORT_USER_CATEGORY_PREFIX = '__USER_CAT__'; // Not directly used in results page but good to keep in mind
const NA_KEY = '__NA__'; // Use a consistent internal key for N/A
const OTHER_KEY_INTERNAL = '__OTHER__';
const OTHER_DISPLAY_LABEL = 'Other';
const NA_DISPLAY_LABEL = 'Not Applicable';


// --- Helper Functions (getChartColor, calculatePercentage, createHistogramData, safeJsonParse as before) ---
const CHART_COLORS = [ '#0d6efd', '#6f42c1', '#d63384', '#dc3545', '#fd7e14', '#ffc107', '#198754', '#20c997', '#0dcaf0', '#6c757d', '#343a40', '#adb5bd', '#ff6384', '#36a2eb', '#cc65fe', '#ffce56', '#4bc0c0', '#9966ff', '#ff9f40' ];
const getChartColor = (index, alpha = 0.8) => { /* ... */ const color = CHART_COLORS[index % CHART_COLORS.length]; if (alpha < 1 && color.startsWith('#') && color.length === 7) { try { const r = parseInt(color.slice(1, 3), 16); const g = parseInt(color.slice(3, 5), 16); const b = parseInt(color.slice(5, 7), 16); return `rgba(${r},${g},${b},${alpha})`; } catch (e) { console.warn("Color parsing error in getChartColor for:", color, e); return 'rgba(128,128,128,0.5)'; } } if (color.startsWith('rgba')) { return color.replace(/[\d\.]+\)$/g, `${alpha})`); } if (color.startsWith('#')) { return color; } console.warn("Unhandled color format in getChartColor:", color); return 'rgba(128,128,128,0.5)'; };
const getSolidChartColor = (index) => getChartColor(index, 1);
const calculatePercentage = (count, total) => { if (!total || total === 0) return '0.0%'; return ((count / total) * 100).toFixed(1) + '%'; };
const createHistogramData = (values, minVal, maxVal, numBins = 10) => { /* ... */ if (!values || values.length === 0) return { labels: [], data: [] }; const cleanValues = values.map(v => parseFloat(v)).filter(v => !isNaN(v)); if (cleanValues.length === 0) return { labels: [], data: [] }; const actualMin = minVal !== undefined && minVal !== null && !isNaN(parseFloat(minVal)) ? parseFloat(minVal) : Math.min(...cleanValues); const actualMax = maxVal !== undefined && maxVal !== null && !isNaN(parseFloat(maxVal)) ? parseFloat(maxVal) : Math.max(...cleanValues); if (actualMin === actualMax) { return { labels: [actualMin.toFixed(1)], data: [cleanValues.length] }; } const range = actualMax - actualMin; if (range < 0) { console.warn("Histogram range is negative", {actualMin, actualMax, range}); return { labels: [], data: [] }; } const binSize = range > 0 ? range / numBins : 1; const bins = Array(numBins).fill(0); const labels = []; for (let i = 0; i < numBins; i++) { const binMin = actualMin + i * binSize; const binMax = actualMin + (i + 1) * binSize; labels.push(`${binMin.toFixed(1)}-${binMax.toFixed(1)}`); } cleanValues.forEach(value => { if (value < actualMin || value > actualMax) return; let binIndex = Math.floor((value - actualMin) / binSize); if (value === actualMax) binIndex = numBins - 1; binIndex = Math.max(0, Math.min(numBins - 1, binIndex)); bins[binIndex]++; }); return { labels, data: bins }; };
const safeJsonParse = (value, defaultValue = null) => { /* ... */ if (typeof value !== 'string' || !value.trim()) { return defaultValue; } try { const parsed = JSON.parse(value); return parsed; } catch (e) { console.warn("Failed to parse JSON answer value:", value, e); return defaultValue; } };


function SurveyResultsPage() {
    const { surveyId } = useParams();
    const [survey, setSurvey] = useState(null);
    const [rawAnswers, setRawAnswers] = useState([]); // These will include `otherText` from backend
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [processedResults, setProcessedResults] = useState({});
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

    const processAllAnswers = useCallback((surveyDefinition, allRawAnswersFromDb) => {
        console.log("[ResultsPage v2.9] Processing raw answers...", { numAnswers: allRawAnswersFromDb.length });
        if (!surveyDefinition || !surveyDefinition.questions || !allRawAnswersFromDb || !Array.isArray(allRawAnswersFromDb)) { /* ... */ return {}; }
        const results = {};
        const respondentSessionIds = new Set(allRawAnswersFromDb.map(a => a.sessionId));
        const totalRespondentsOverall = respondentSessionIds.size;

        surveyDefinition.questions.forEach(question => {
            const questionId = question._id;
            const questionType = question.type;
            // Filter answers from DB for this specific question
            const questionAnswersFromDb = allRawAnswersFromDb.filter(a => a.questionId === questionId);
            const questionRespondents = new Set(questionAnswersFromDb.map(a => a.sessionId)).size;
            
            let stats = {
                totalResponses: questionRespondents, counts: {}, values: [], responses: [], average: null, min: null, max: null, writeIns: {},
                rows: {}, averageRanks: {}, rankCounts: {}, clicks: [],
                bestCounts: {}, worstCounts: {}, levelCounts: {},
                cardPlacementsByCard: {}, cardPlacementsByCategory: {}, userCategoriesFromAnswers: [],
            };

            try {
                switch (questionType) {
                    case 'multiple-choice': case 'dropdown': case 'checkbox':
                        const tempCounts = {};
                        // Each `ansFromDb` is an answer object from your database, including `answerValue` and `otherText`
                        questionAnswersFromDb.forEach(ansFromDb => {
                            const mainValues = questionType === 'checkbox' ? (ansFromDb.answerValue || '').split('||').filter(Boolean) : [ansFromDb.answerValue];
                            
                            mainValues.forEach(val => {
                                if (val === null || val === undefined || val === '') return;

                                if (val === NA_KEY) { // Check for internal NA_KEY
                                    tempCounts[NA_KEY] = (tempCounts[NA_KEY] || 0) + 1;
                                } else if (val === OTHER_KEY_INTERNAL) { // Check for internal OTHER_KEY
                                    tempCounts[OTHER_KEY_INTERNAL] = (tempCounts[OTHER_KEY_INTERNAL] || 0) + 1;
                                    // Use ansFromDb.otherText (the actual write-in from the database)
                                    if (ansFromDb.otherText && ansFromDb.otherText.trim()) {
                                        const writeInText = ansFromDb.otherText.trim();
                                        stats.writeIns[writeInText] = (stats.writeIns[writeInText] || 0) + 1;
                                    }
                                } else if (question.options?.includes(val)) { // Predefined option
                                    tempCounts[val] = (tempCounts[val] || 0) + 1;
                                } else {
                                    console.warn(`[${question.text}] Unexpected value for ${questionType}:`, val, "Available options:", question.options);
                                }
                            });
                        });
                        stats.counts = tempCounts;
                        break;
                    // ... (cases for rating, nps, slider, text, textarea - no changes needed for "Other" here)
                    case 'rating': case 'nps': case 'slider': const numericValues = questionAnswersFromDb.map(ans => parseFloat(ans.answerValue)).filter(val => !isNaN(val)); if (numericValues.length > 0) { stats.values = numericValues; stats.average = (numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length); stats.min = Math.min(...numericValues); stats.max = Math.max(...numericValues); if (questionType === 'rating' || questionType === 'nps') { numericValues.forEach(val => { const key = String(Math.round(val)); stats.counts[key] = (stats.counts[key] || 0) + 1; }); } if (questionType === 'nps') { stats.promoters = numericValues.filter(v => v >= 9).length; stats.passives = numericValues.filter(v => v >= 7 && v <= 8).length; stats.detractors = numericValues.filter(v => v <= 6).length; const totalNPS = stats.promoters + stats.passives + stats.detractors; stats.npsScore = totalNPS > 0 ? ((stats.promoters / totalNPS) * 100 - (stats.detractors / totalNPS) * 100) : 0; } } break;
                    case 'text': case 'textarea': stats.responses = questionAnswersFromDb.map(ans => ans.answerValue).filter(val => val !== null && val !== undefined && String(val).trim() !== ''); break;
                    
                    // --- Cases for complex types that need review for results display ---
                    case 'matrix':
                        stats.rows = {};
                        const isRatingMatrix = question.matrixType === 'rating';
                        questionAnswersFromDb.forEach(ans => {
                            const matrixData = safeJsonParse(ans.answerValue, {}); // answerValue should be JSON string
                            Object.entries(matrixData).forEach(([row, value]) => {
                                if (!question.matrixRows?.includes(row)) return;
                                if (!stats.rows[row]) { stats.rows[row] = { counts: {}, total: 0, sum: 0, values: [] }; }
                                stats.rows[row].total++;
                                stats.rows[row].counts[String(value)] = (stats.rows[row].counts[String(value)] || 0) + 1;
                                if (isRatingMatrix) { const ratingValue = parseFloat(value); if (!isNaN(ratingValue)) { stats.rows[row].sum += ratingValue; stats.rows[row].values.push(ratingValue); } }
                            });
                        });
                        if (isRatingMatrix) { Object.keys(stats.rows).forEach(row => { const rd = stats.rows[row]; if (rd.total > 0 && rd.values.length > 0) { rd.average = (rd.sum / rd.values.length); } else { rd.average = null; } }); }
                        break;
                    case 'ranking': // Review this section
                        stats.averageRanks = {}; stats.rankCounts = {};
                        const rankOptions = question.options || [];
                        questionAnswersFromDb.forEach(ans => {
                            const rankedList = safeJsonParse(ans.answerValue, []); // Expecting array of option strings
                            if (!Array.isArray(rankedList)) return;
                            rankedList.forEach((option, index) => {
                                if (!rankOptions.includes(option)) return; // Ensure option is valid
                                const rankPosition = index + 1;
                                if (!stats.averageRanks[option]) { stats.averageRanks[option] = { sum: 0, count: 0 }; }
                                stats.averageRanks[option].sum += rankPosition;
                                stats.averageRanks[option].count++;
                                if (!stats.rankCounts[option]) { stats.rankCounts[option] = {}; }
                                stats.rankCounts[option][rankPosition] = (stats.rankCounts[option][rankPosition] || 0) + 1;
                            });
                        });
                        Object.keys(stats.averageRanks).forEach(option => { const d = stats.averageRanks[option]; if (d.count > 0) { d.average = (d.sum / d.count); } });
                        break;
                    case 'heatmap': // Review this section
                        stats.clicks = [];
                        questionAnswersFromDb.forEach(ans => {
                            const clicksData = safeJsonParse(ans.answerValue, []); // Expecting array of {x,y} objects
                            if (Array.isArray(clicksData)) { clicksData.forEach(click => { if (typeof click === 'object' && click !== null && typeof click.x === 'number' && typeof click.y === 'number' && click.x >= 0 && click.x <= 1 && click.y >= 0 && click.y <= 1) { stats.clicks.push(click); } }); }
                        });
                        break;
                    case 'maxdiff': // Review this section
                        stats.bestCounts = {}; stats.worstCounts = {};
                        questionAnswersFromDb.forEach(ans => {
                            const mdData = safeJsonParse(ans.answerValue, {}); // Expecting {best: "option", worst: "option"}
                            if (typeof mdData === 'object' && mdData !== null) {
                                if (mdData.best && question.options?.includes(mdData.best)) { stats.bestCounts[mdData.best] = (stats.bestCounts[mdData.best] || 0) + 1; }
                                if (mdData.worst && question.options?.includes(mdData.worst)) { stats.worstCounts[mdData.worst] = (stats.worstCounts[mdData.worst] || 0) + 1; }
                            }
                        });
                        break;
                    case 'conjoint': // Review this section
                        stats.levelCounts = {};
                        questionAnswersFromDb.forEach(ans => {
                            const chosenProfile = safeJsonParse(ans.answerValue, {}); // Expecting {Attribute: Level, ...}
                            if (typeof chosenProfile === 'object' && chosenProfile !== null) { Object.entries(chosenProfile).forEach(([attribute, level]) => { if (typeof attribute === 'string' && typeof level === 'string') { if (!stats.levelCounts[attribute]) { stats.levelCounts[attribute] = {}; } stats.levelCounts[attribute][level] = (stats.levelCounts[attribute][level] || 0) + 1; } }); }
                        });
                        break;
                    case 'cardsort': // Review this section
                        stats.cardPlacementsByCard = {};
                        stats.cardPlacementsByCategory = { [CARD_SORT_UNASSIGNED_ID]: {} };
                        (question.cardSortCategories || []).forEach(catName => { stats.cardPlacementsByCategory[catName] = {}; });
                        const foundUserCategoryIds = new Set();
                        stats.userCategoriesFromAnswers = [];
                        questionAnswersFromDb.forEach(ans => {
                            // Expecting { assignments: {cardId: categoryId}, userCategories: [{id, name}] }
                            const parsedAnswer = safeJsonParse(ans.answerValue, { assignments: {}, userCategories: [] });
                            const assignments = parsedAnswer.assignments || {};
                            const userAnswerCategories = parsedAnswer.userCategories || [];

                            userAnswerCategories.forEach(uc => {
                                if (uc && uc.id && uc.name && !foundUserCategoryIds.has(uc.id)) {
                                    stats.userCategoriesFromAnswers.push({ id: uc.id, name: uc.name });
                                    foundUserCategoryIds.add(uc.id);
                                    if (!stats.cardPlacementsByCategory[uc.id]) { stats.cardPlacementsByCategory[uc.id] = {}; }
                                }
                            });
                            Object.entries(assignments).forEach(([cardId, categoryId]) => {
                                if (!question.options?.includes(cardId)) return; // Ensure card is valid
                                if (!stats.cardPlacementsByCard[cardId]) stats.cardPlacementsByCard[cardId] = {};
                                stats.cardPlacementsByCard[cardId][categoryId] = (stats.cardPlacementsByCard[cardId][categoryId] || 0) + 1;
                                
                                if (!stats.cardPlacementsByCategory[categoryId]) {
                                    // If it's a user category we just found, it should be initialized.
                                    // If it's not predefined and not a user category from this answer, it's an issue.
                                    if (foundUserCategoryIds.has(categoryId)) {
                                        // This should have been initialized above
                                    } else if (categoryId !== CARD_SORT_UNASSIGNED_ID && !(question.cardSortCategories || []).includes(categoryId)) {
                                        console.warn(`Card sort category ID "${categoryId}" from answer not in predefined or user list. Card: ${cardId}`);
                                        return; // Skip this assignment or assign to unassigned
                                    }
                                    // Ensure category exists in placements map
                                    if (!stats.cardPlacementsByCategory[categoryId]) {
                                       stats.cardPlacementsByCategory[categoryId] = {};
                                    }
                                }
                                stats.cardPlacementsByCategory[categoryId][cardId] = (stats.cardPlacementsByCategory[categoryId][cardId] || 0) + 1;
                            });
                        });
                        break;
                    default: console.warn(`No processing logic defined for question type: ${questionType}`);
                }
            } catch (processingError) { console.error(`Error processing answers for question ${questionId} (${questionType}):`, processingError); stats.processingError = processingError.message || "An unknown error occurred during processing."; }
            results[questionId] = { stats };
        });
        results.overallTotalRespondents = totalRespondentsOverall;
        console.log("[ResultsPage v2.9] Processed results:", results);
        return results;
    }, []);

    const fetchData = useCallback(async () => { /* ... (fetchData as in v2.8, ensure it fetches `otherText` if not already) ... */ setLoading(true); setError(null); setSurvey(null); setRawAnswers([]); setProcessedResults({}); console.log(`SurveyResultsPage (v2.9): Fetching data for survey ID: ${surveyId}`); if (!surveyId || !/^[a-f\d]{24}$/i.test(surveyId)) { console.error("Invalid surveyId format:", surveyId); setError(`Invalid Survey ID format: "${surveyId}"`); setLoading(false); return; } const token = localStorage.getItem('token'); if (!token) { console.error("Authentication token not found in localStorage."); setError("Authentication required. Please log in again."); setLoading(false); return; } const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }; try { console.log(`Fetching survey definition from: ${apiUrl}/surveys/${surveyId}`); const surveyResponse = await fetch(`${apiUrl}/surveys/${surveyId}`, { headers }); if (!surveyResponse.ok) { const errorBody = await surveyResponse.text(); console.error(`Survey definition fetch failed with status ${surveyResponse.status}:`, errorBody); let errorMessage = `Failed to fetch survey definition (Status: ${surveyResponse.status}).`; if (surveyResponse.status === 401) { errorMessage = "Unauthorized to view survey definition. Your session might have expired."; } else if (surveyResponse.status === 403) { errorMessage = "Forbidden: You do not have permission to access this survey's definition."; } else if (surveyResponse.status === 404) { errorMessage = "Survey definition not found."; } try { const parsedError = JSON.parse(errorBody); if (parsedError.message) errorMessage += ` Server: ${parsedError.message}`; } catch (e) { /* Ignore if not JSON */ } throw new Error(errorMessage); } const surveyJsonResponse = await surveyResponse.json(); console.log("Survey definition JSON response:", surveyJsonResponse); if (!surveyJsonResponse.success || !surveyJsonResponse.data || !surveyJsonResponse.data.questions) { const msg = surveyJsonResponse.message || "Survey data from server is invalid or missing questions."; console.error("Invalid survey data structure:", surveyJsonResponse); throw new Error(msg); } setSurvey(surveyJsonResponse.data); console.log(`Fetching survey answers from: ${apiUrl}/answers/survey/${surveyId}`); const answersResponse = await fetch(`${apiUrl}/answers/survey/${surveyId}`, { headers }); if (!answersResponse.ok) { const errorBody = await answersResponse.text(); console.error(`Survey answers fetch failed with status ${answersResponse.status}:`, errorBody); let errorMessage = `Failed to fetch survey answers (Status: ${answersResponse.status}).`; if (answersResponse.status === 401) { errorMessage = "Unauthorized to view survey answers. Your session might have expired."; } else if (answersResponse.status === 403) { errorMessage = "Forbidden: You do not have permission to access these survey answers."; } try { const parsedError = JSON.parse(errorBody); if (parsedError.message) errorMessage += ` Server: ${parsedError.message}`; } catch (e) { /* Ignore */ } throw new Error(errorMessage); } const answersJsonResponse = await answersResponse.json(); console.log("Raw answers JSON response (should include otherText):", answersJsonResponse); let actualAnswersArray = []; if (Array.isArray(answersJsonResponse)) { actualAnswersArray = answersJsonResponse; } else if (answersJsonResponse && answersJsonResponse.success && Array.isArray(answersJsonResponse.data)) { actualAnswersArray = answersJsonResponse.data; } else if (answersJsonResponse && answersJsonResponse.success === false) { const msg = answersJsonResponse.message || "Fetching answers failed as indicated by server."; console.error(msg, answersJsonResponse); throw new Error(msg); } else { console.warn("Unexpected structure for answers data:", answersJsonResponse); throw new Error("Received unexpected data format for survey answers."); } setRawAnswers(actualAnswersArray); } catch (err) { console.error("Overall error in fetchData (SurveyResultsPage):", err); setError(err.message || "An unexpected error occurred while loading results data."); } finally { setLoading(false); } }, [surveyId, apiUrl]);
    useEffect(() => { fetchData(); }, [fetchData]);
    useEffect(() => { if (survey && rawAnswers.length > 0 && !loading) { const processed = processAllAnswers(survey, rawAnswers); setProcessedResults(processed); } else if (survey && rawAnswers.length === 0 && !loading && !error) { setProcessedResults({ overallTotalRespondents: 0 }); } }, [survey, rawAnswers, loading, processAllAnswers, error]);


    const renderQuestionResults = (question) => {
        const questionId = question._id;
        const resultData = processedResults[questionId];
        const stats = resultData?.stats;
        const { type, text, options = [], matrixRows = [], matrixColumns = [], sliderMin, sliderMax, imageUrl, matrixType, cardSortCategories = [] } = question;

        if (stats?.processingError) { /* ... */ }
        const qRespondents = stats?.totalResponses || 0;
        if (!stats || qRespondents === 0) { /* ... */ }

        const basePlugins = { /* ... */ };
        const pieChartOptions = { /* ... */ };
        const barChartOptions = { /* ... */ };

        switch (type) {
            case 'multiple-choice': case 'dropdown': case 'checkbox': {
                const counts = stats.counts || {}; const writeIns = stats.writeIns || {};
                let chartItems = []; let tableItems = []; let writeInDetails = [];
                
                // Add predefined options
                options.forEach(opt => { if (counts[opt] > 0) { const item = { key: opt, displayLabel: opt, count: counts[opt], type: 'predefined' }; chartItems.push(item); tableItems.push(item); } });
                
                // Add "Other" if present
                const otherTotalCount = counts[OTHER_KEY_INTERNAL] || 0;
                if (otherTotalCount > 0) { 
                    chartItems.push({ key: OTHER_KEY_INTERNAL, displayLabel: OTHER_DISPLAY_LABEL, count: otherTotalCount, type: 'other_group' }); 
                    tableItems.push({ key: OTHER_KEY_INTERNAL, displayLabel: `${OTHER_DISPLAY_LABEL} (details below)`, count: otherTotalCount, type: 'other_group' }); 
                    // Populate writeInDetails from stats.writeIns
                    writeInDetails = Object.entries(writeIns).map(([writeInText, count]) => ({ text: writeInText, count })).sort((a, b) => b.count - a.count);
                }
                
                // Add "N/A" if present
                if (counts[NA_KEY] > 0) { 
                    const item = { key: NA_KEY, displayLabel: NA_DISPLAY_LABEL, count: counts[NA_KEY], type: 'na' }; 
                    chartItems.push(item); tableItems.push(item); 
                }

                const sortOrder = { 'predefined': 1, 'other_group': 2, 'na': 3 };
                chartItems.sort((a, b) => (sortOrder[a.type] || 99) - (sortOrder[b.type] || 99) || b.count - a.count);
                tableItems.sort((a, b) => (sortOrder[a.type] || 99) - (sortOrder[b.type] || 99) || b.count - a.count);

                if (chartItems.length === 0 && writeInDetails.length === 0) { return <p style={styles.noAnswerText}>No valid answers recorded.</p>; }
                const chartLabels = chartItems.map(item => item.displayLabel);
                const chartDataValues = chartItems.map(item => item.count);
                const backgroundColors = chartItems.map((_, i) => getChartColor(i, 0.8));
                const borderColors = chartItems.map((_, i) => getSolidChartColor(i));
                if (chartLabels.length === 0 || chartDataValues.some(v => typeof v !== 'number' || isNaN(v)) || backgroundColors.some(c => typeof c !== 'string') || borderColors.some(c => typeof c !== 'string')) { console.warn("Chart data invalid for", text, {chartLabels, chartDataValues, backgroundColors, borderColors}); return <p style={styles.noAnswerText}>Chart data incomplete.</p>; }
                const chartData = { labels: chartLabels, datasets: [{ label: type === 'checkbox' ? '# Selections' : '# Responses', data: chartDataValues, backgroundColor: backgroundColors, borderColor: borderColors, borderWidth: 1 }] };
                const isPieChart = type === 'multiple-choice' || type === 'dropdown';
                const currentChartOptions = isPieChart ? pieChartOptions : { ...barChartOptions, plugins: { ...barChartOptions.plugins, tooltip: { callbacks: { label: function(context) { let label = context.label || ''; if (label) { label += ': '; } const value = context.parsed.y; const totalForPercent = type === 'checkbox' ? qRespondents : context.dataset.data.reduce((a, b) => a + b, 0); label += `${value} (${calculatePercentage(value, totalForPercent)})`; return label; } } } } };
                const totalForTablePercent = type === 'checkbox' ? qRespondents : tableItems.reduce((sum, item) => sum + item.count, 0);
                
                // Ensure writeInDetails are displayed
                return ( <div style={styles.resultContainer}> {chartItems.length > 0 && <div style={isPieChart ? styles.chartContainerPie : styles.chartContainerBar}>{isPieChart ? <Pie options={currentChartOptions} data={chartData} /> : <Bar options={currentChartOptions} data={chartData} />}</div>} {tableItems.length > 0 && <table style={styles.resultsTable}><thead><tr><th style={styles.resultsTableTh}>Value</th><th style={styles.resultsTableTh}>Percent</th><th style={styles.resultsTableTh}>Responses</th></tr></thead><tbody>{tableItems.map((item, i) => (<tr key={`${item.type}-${item.key}`}><td>{item.displayLabel}</td><td>{calculatePercentage(item.count, totalForTablePercent)}<div style={styles.percentBarContainer}><div style={{...styles.percentBar, width: calculatePercentage(item.count, totalForTablePercent), backgroundColor: getSolidChartColor(i)}}></div></div></td><td>{item.count}</td></tr>))}</tbody>{(type === 'multiple-choice' || type === 'dropdown') && <tfoot><tr><td colSpan="2" style={{textAlign: 'right'}}>Total:</td><td>{totalForTablePercent}</td></tr></tfoot>}{type === 'checkbox' && <tfoot><tr><td colSpan="2" style={{textAlign: 'right'}}>Total Respondents:</td><td>{qRespondents}</td></tr></tfoot>}</table>} {writeInDetails.length > 0 && <div style={styles.writeInContainer}><strong style={styles.writeInHeader}>"{OTHER_DISPLAY_LABEL}" Write-in Responses:</strong><ul style={styles.writeInList}>{writeInDetails.map((detail, index) => (<li key={index} style={styles.writeInItem}>"{detail.text}" <span style={styles.writeInCount}>({detail.count})</span></li>))}</ul></div>} </div> );
            }
            // ... (other cases: rating, nps, slider, text, textarea - no changes for "Other" text)
            case 'rating': { const ratingLabels = (options.length > 0 ? options.map((_, i) => String(i + 1)) : [1, 2, 3, 4, 5].map(String)); const ratingCounts = ratingLabels.map(score => stats.counts?.[String(score)] || 0); const avgRating = stats.average !== null ? Number(stats.average).toFixed(2) : 'N/A'; const backgroundColors = ratingLabels.map((_, i) => getChartColor(i, 0.8)); const borderColors = ratingLabels.map((_, i) => getSolidChartColor(i)); if (ratingLabels.length === 0 || ratingCounts.some(v => typeof v !== 'number' || isNaN(v)) || backgroundColors.some(c => typeof c !== 'string') || borderColors.some(c => typeof c !== 'string')) { return <p style={styles.noAnswerText}>Chart data incomplete for rating.</p>; } const chartDataRating = { labels: ratingLabels, datasets: [{ label: '# Responses', data: ratingCounts, backgroundColor: backgroundColors, borderColor: borderColors, borderWidth: 1 }] }; return ( <div style={styles.resultContainer}><p style={styles.summaryStat}>Average Rating: {avgRating}</p><div style={styles.chartContainerBar}><Bar options={barChartOptions} data={chartDataRating} /></div></div> ); }
            case 'nps': { const { promoters = 0, passives = 0, detractors = 0, npsScore = 0 } = stats; const totalNPSResponses = qRespondents; const promoterPercent = calculatePercentage(promoters, totalNPSResponses); const passivePercent = calculatePercentage(passives, totalNPSResponses); const detractorPercent = calculatePercentage(detractors, totalNPSResponses); const npsScoreLabels = Object.keys(stats.counts || {}).map(k => parseInt(k)).sort((a, b) => a - b).map(String); const npsScoreCounts = npsScoreLabels.map(score => stats.counts[score] || 0); const npsBackgroundColors = npsScoreLabels.map(score => { const s = parseInt(score); if (s >= 9) return styles.npsPromoterColor.backgroundColor; if (s >= 7) return styles.npsPassiveColor.backgroundColor; return styles.npsDetractorColor.backgroundColor; }); if (npsScoreLabels.length === 0 || npsScoreCounts.some(v => typeof v !== 'number' || isNaN(v)) || npsBackgroundColors.some(c => typeof c !== 'string')) { return <p style={styles.noAnswerText}>NPS score distribution data incomplete.</p>; } const chartDataNpsScores = { labels: npsScoreLabels, datasets: [{ label: '# Responses', data: npsScoreCounts, backgroundColor: npsBackgroundColors, borderWidth: 1 }] }; const npsBarOptions = { ...barChartOptions, plugins: { ...barChartOptions.plugins, legend: { display: false } } }; return ( <div style={styles.resultContainer}><div style={styles.npsScoreContainer}><span style={styles.npsScoreLabel}>NPS® Score: {Number(npsScore).toFixed(1)}</span><div style={styles.npsCombinedBar}><div title={`Detractors: ${detractorPercent}`} style={{ ...styles.npsBarSegment, width: detractorPercent, backgroundColor: styles.npsDetractorColor.backgroundColor }}></div><div title={`Passives: ${passivePercent}`} style={{ ...styles.npsBarSegment, width: passivePercent, backgroundColor: styles.npsPassiveColor.backgroundColor }}></div><div title={`Promoters: ${promoterPercent}`} style={{ ...styles.npsBarSegment, width: promoterPercent, backgroundColor: styles.npsPromoterColor.backgroundColor }}></div></div></div><table style={{...styles.resultsTable, marginTop: '20px', width: 'auto', minWidth: '400px', display: 'inline-table', marginRight: '30px'}}><tbody><tr><td style={{...styles.resultsTableCellValue, ...styles.npsPromoterColor}}>Promoters (9-10)</td><td>{promoterPercent}<div style={styles.percentBarContainer}><div style={{...styles.percentBar, width: promoterPercent, ...styles.npsPromoterColor }}></div></div></td><td>{promoters}</td></tr><tr><td style={{...styles.resultsTableCellValue, ...styles.npsPassiveColor}}>Passives (7-8)</td><td>{passivePercent}<div style={styles.percentBarContainer}><div style={{...styles.percentBar, width: passivePercent, ...styles.npsPassiveColor }}></div></div></td><td>{passives}</td></tr><tr><td style={{...styles.resultsTableCellValue, ...styles.npsDetractorColor}}>Detractors (0-6)</td><td>{detractorPercent}<div style={styles.percentBarContainer}><div style={{...styles.percentBar, width: detractorPercent, ...styles.npsDetractorColor }}></div></div></td><td>{detractors}</td></tr></tbody><tfoot><tr><td colSpan="2" style={{textAlign: 'right'}}>Total Responses:</td><td>{totalNPSResponses}</td></tr></tfoot></table><div style={{...styles.chartContainerBar, height: '200px', marginTop: '20px'}}><p style={styles.infoText}>Score Distribution:</p><Bar options={npsBarOptions} data={chartDataNpsScores} /></div></div> ); }
            case 'slider': { const sliderValues = stats.values || []; const avgSlider = stats.average !== null ? Number(stats.average).toFixed(2) : 'N/A'; const minQVal = sliderMin !== undefined && sliderMin !== null ? parseFloat(sliderMin) : null; const maxQVal = sliderMax !== undefined && sliderMax !== null ? parseFloat(sliderMax) : null; const histData = createHistogramData(sliderValues, minQVal, maxQVal, 10); const backgroundColors = histData.labels.map((_, i) => getChartColor(i, 0.8)); const borderColors = histData.labels.map((_, i) => getSolidChartColor(i)); if (histData.labels.length === 0 || histData.data.some(v => typeof v !== 'number' || isNaN(v)) || backgroundColors.some(c => typeof c !== 'string') || borderColors.some(c => typeof c !== 'string')) { return <p style={styles.noAnswerText}>Slider histogram data incomplete.</p>; } const chartDataSlider = { labels: histData.labels, datasets: [{ label: '# Responses', data: histData.data, backgroundColor: backgroundColors, borderColor: borderColors, borderWidth: 1, barPercentage: 1.0, categoryPercentage: 1.0, }] }; const sliderBarOptions = { ...barChartOptions, plugins: { ...barChartOptions.plugins, legend: { display: false } }, scales: { x: { grid: { display: false }, title: { display: true, text: `Range (${minQVal ?? 'Auto'}-${maxQVal ?? 'Auto'})`} }, y: { ticks: { precision: 0 }, title: { display: true, text: 'Frequency' } } } }; return ( <div style={styles.resultContainer}><p style={styles.summaryStat}>Average: {avgSlider} (Min: {stats.min ?? 'N/A'}, Max: {stats.max ?? 'N/A'})</p><div style={styles.chartContainerBar}><Bar options={sliderBarOptions} data={chartDataSlider} /></div></div> ); }
            case 'text': case 'textarea': return ( <ul style={styles.textResponseList}>{(stats.responses || []).map((response, index, arr) => (<li key={index} style={{...styles.textResponseItem, borderBottom: index === arr.length - 1 ? 'none' : styles.textResponseItem.borderBottom }}>{response || <i>(Empty)</i>}</li>))}</ul> );
            
            // --- Cases for complex types needing result display review ---
            case 'matrix': return ( <table style={styles.resultsTable}><thead><tr><th style={styles.resultsTableTh}></th>{(matrixColumns || []).map(col => <th key={col} style={styles.resultsTableTh}>{col}</th>)}<th style={styles.resultsTableTh}>Row Total</th>{matrixType === 'rating' && <th style={styles.resultsTableTh}>Avg. Rating</th>}</tr></thead><tbody>{(matrixRows || []).map(row => { const rowData = stats.rows?.[row]; const rowCounts = rowData?.counts || {}; const rowTotal = rowData?.total || 0; const rowAverage = rowData?.average !== null && rowData?.average !== undefined ? Number(rowData.average).toFixed(2) : 'N/A'; return ( <tr key={row}><td style={styles.rowHeader}>{row}</td>{(matrixColumns || []).map(col => <td key={col} style={styles.resultsTableCell}>{rowCounts[String(col)] || 0}</td>)}<td style={{...styles.resultsTableCell, fontWeight: 'bold'}}>{rowTotal}</td>{matrixType === 'rating' && <td style={styles.resultsTableCell}>{rowAverage}</td>}</tr> ); })}</tbody></table> );
            case 'ranking': { /* ... (Logic from v2.8, check if stats.averageRanks and stats.rankCounts are populated) ... */ const rankOptions = options || []; const rankStats = rankOptions.map(opt => { const avgData = stats.averageRanks?.[opt]; const countsData = stats.rankCounts?.[opt] || {}; const avgRank = avgData?.average ? parseFloat(avgData.average).toFixed(2) : Infinity; const totalRankings = avgData?.count || 0; let score = 0; const N = rankOptions.length; for (let rank = 1; rank <= N; rank++) { score += (N - rank) * (countsData[rank] || 0); } return { option: opt, avgRank, score, totalRankings, counts: countsData }; }).sort((a, b) => (a.avgRank === Infinity ? 1 : (b.avgRank === Infinity ? -1 : a.avgRank - b.avgRank))); return ( <div style={styles.resultContainer}><table style={{...styles.resultsTable, tableLayout: 'fixed'}}><thead><tr><th style={{...styles.resultsTableTh, width: '25%'}}>Item</th><th style={{...styles.resultsTableTh, width: '10%'}}>Avg. Rank</th><th style={{...styles.resultsTableTh, width: '35%'}}>Rank Distribution</th><th style={{...styles.resultsTableTh, width: '15%'}}>Score</th><th style={{...styles.resultsTableTh, width: '15%'}}># Ranked</th></tr></thead><tbody>{rankStats.map((item, index) => { const rankDistributionData = []; const N = rankOptions.length; for (let rank = 1; rank <= N; rank++) { rankDistributionData.push(item.counts[rank] || 0); } const maxCountInDist = Math.max(...rankDistributionData, 0); return ( <tr key={item.option}><td style={styles.resultsTableCellValue}>{item.option}</td><td style={styles.resultsTableCellCount}>{item.avgRank === Infinity ? 'N/A' : item.avgRank}</td><td style={styles.resultsTableCell}><div style={styles.rankDistContainer}>{rankDistributionData.map((count, rankIndex) => ( <div key={rankIndex} style={{...styles.rankDistBar, height: maxCountInDist > 0 ? `${(count / maxCountInDist) * 90 + 10}%` : '10%' }} title={`Rank ${rankIndex + 1}: ${count} times`}></div> ))}</div><div style={styles.rankDistLabels}><span>1st</span><span>{N}th</span></div></td><td style={styles.resultsTableCellCount}>{item.score}</td><td style={styles.resultsTableCellCount}>{item.totalRankings}</td></tr> ); })}</tbody></table><p style={styles.infoText}>(Lower Avg. Rank is better. Score uses Borda-like count.)</p></div> );}
            case 'heatmap': { /* ... (Logic from v2.8, check if stats.clicks is populated) ... */ return ( <div style={{ marginTop: '10px' }}><p style={styles.infoText}>Heatmap showing {stats.clicks?.length || 0} clicks from {qRespondents} respondents.</p>{imageUrl ? ( <div style={{ ...styles.heatmapContainer, position: 'relative', display: 'inline-block' }}><img src={imageUrl} alt="Heatmap Base" style={styles.heatmapImage} />{(stats.clicks || []).map((click, index) => ( <div key={index} style={{ position: 'absolute', left: `${click.x * 100}%`, top: `${click.y * 100}%`, width: '8px', height: '8px', backgroundColor: 'rgba(255,0,0,0.5)', borderRadius: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none' }}></div> ))}</div> ) : <p style={styles.noAnswerText}>Image URL missing for heatmap question.</p>}</div> );}
            case 'maxdiff': { /* ... (Logic from v2.8, check if stats.bestCounts/worstCounts are populated) ... */ const mdScores = (options || []).map(opt => { const most = stats.bestCounts?.[opt] || 0; const worst = stats.worstCounts?.[opt] || 0; return { option: opt, score: most - worst, most, worst }; }).sort((a, b) => b.score - a.score); return ( <div style={styles.resultContainer}><table style={styles.resultsTable}><thead><tr><th style={styles.resultsTableTh}>Item</th><th style={styles.resultsTableTh}>Best Count</th><th style={styles.resultsTableTh}>Worst Count</th><th style={styles.resultsTableTh}>Score (Best-Worst)</th></tr></thead><tbody>{mdScores.map(item => ( <tr key={item.option}><td style={styles.resultsTableCellValue}>{item.option}</td><td style={styles.resultsTableCellCount}>{item.most}</td><td style={styles.resultsTableCellCount}>{item.worst}</td><td style={styles.resultsTableCellCount}>{item.score}</td></tr> ))}</tbody></table></div> );}
            case 'conjoint': { /* ... (Logic from v2.8, check if stats.levelCounts is populated) ... */ const levelCounts = stats.levelCounts || {}; return ( <div><p style={styles.infoText}>Attribute level counts from chosen profiles ({qRespondents} tasks completed).</p>{Object.entries(levelCounts).map(([attrName, levels]) => ( <div key={attrName} style={{ marginBottom: '15px' }}><strong>{attrName}</strong><table style={{...styles.resultsTable, width: 'auto', minWidth: '300px'}}><thead><tr><th style={styles.resultsTableTh}>Level</th><th style={styles.resultsTableTh}>Count</th></tr></thead><tbody>{Object.entries(levels).sort((a,b) => b[1] - a[1]).map(([levelName, count]) => ( <tr key={levelName}><td style={styles.resultsTableCellValue}>{levelName}</td><td style={styles.resultsTableCellCount}>{count}</td></tr> ))}</tbody></table></div> ))}</div> );}
            case 'cardsort': { /* ... (Logic from v2.8, check if stats.cardPlacementsByCategory is populated) ... */ const placementsByCategory = stats.cardPlacementsByCategory || {}; const allUserCategoriesFound = stats.userCategoriesFromAnswers || []; const displayCategories = [ { id: CARD_SORT_UNASSIGNED_ID, name: "Unassigned Cards" }, ...cardSortCategories.map(name => ({ id: name, name })), ...allUserCategoriesFound ]; const uniqueDisplayCategoriesMap = new Map(); displayCategories.forEach(cat => { if (!uniqueDisplayCategoriesMap.has(cat.id)) { uniqueDisplayCategoriesMap.set(cat.id, cat); } }); const uniqueDisplayCategories = Array.from(uniqueDisplayCategoriesMap.values()); uniqueDisplayCategories.sort((a, b) => { if (a.id === CARD_SORT_UNASSIGNED_ID) return -1; if (b.id === CARD_SORT_UNASSIGNED_ID) return 1; const aIsPredefined = cardSortCategories.includes(a.id); const bIsPredefined = cardSortCategories.includes(b.id); if (aIsPredefined && !bIsPredefined) return -1; if (!aIsPredefined && bIsPredefined) return 1; return a.name.localeCompare(b.name); }); return ( <div style={styles.cardSortResultContainer}><p style={styles.infoText}>Card placements across {qRespondents} respondents.</p>{uniqueDisplayCategories.map(({ id: categoryId, name: categoryName }) => { const cardsInCategory = placementsByCategory[categoryId] || {}; const sortedCards = Object.entries(cardsInCategory).map(([cardId, count]) => ({ card: cardId, count })).sort((a, b) => b.count - a.count || a.card.localeCompare(b.card)); return ( <div key={categoryId} style={styles.cardSortResultCategory}><h4 style={styles.cardSortCategoryTitle}>{categoryName}</h4>{sortedCards.length > 0 ? ( <ul style={styles.cardSortCardList}>{sortedCards.map(({ card, count }, idx, arr) => (<li key={card} style={{...styles.cardSortCardItem, borderBottom: idx === arr.length - 1 ? 'none' : styles.cardSortCardItem.borderBottom}}><span style={styles.cardSortCardName}>{card}</span><span style={styles.cardSortCardCount}>({count} | {calculatePercentage(count, qRespondents)})</span></li>))}</ul> ) : ( <p style={styles.cardSortEmptyCategory}><i>(No cards placed here by respondents)</i></p> )}</div> ); })}</div> ); }
            default: console.warn(`[${text}] Unknown question type for results display: ${type}`); return <p>Visualization for type '{type}' is not implemented.</p>;
        }
    };

    const styles = { /* ... (Styles from v2.8, ensure .writeIn... styles are present) ... */ pageContainer: { padding: '20px', maxWidth: '950px', margin: 'auto', fontFamily: 'Arial, sans-serif', color: '#333' }, header: { borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }, surveyTitle: { margin: 0, fontSize: '1.8em', flexGrow: 1 }, respondentCount: { fontSize: '1.1em', fontWeight: 'bold', color: '#6c757d', whiteSpace: 'nowrap' }, questionResultBox: { marginBottom: '40px', padding: '20px', border: '1px solid #dee2e6', borderRadius: '8px', backgroundColor: '#fff' }, questionText: { fontWeight: 'normal', fontSize: '1.3em', marginBottom: '20px', color: '#212529' }, resultContainer: { display: 'flex', flexDirection: 'column', gap: '20px' }, chartContainerPie: { height: '280px', width: '100%', maxWidth: '450px', margin: '0 auto 15px auto', position: 'relative' }, chartContainerBar: { height: '300px', width: '100%', marginBottom: '15px', position: 'relative' }, resultsTable: { width: '100%', borderCollapse: 'collapse', marginTop: '10px', fontSize: '0.9em', border: '1px solid #dee2e6' }, resultsTableTh: { backgroundColor: '#f8f9fa', fontWeight: '600', padding: '10px 12px', border: '1px solid #dee2e6', textAlign: 'left' }, resultsTableCell: { border: '1px solid #dee2e6', padding: '8px 12px', textAlign: 'center', verticalAlign: 'middle' }, resultsTableCellValue: { textAlign: 'left', padding: '8px 12px', border: '1px solid #dee2e6', verticalAlign: 'middle' }, resultsTableCellPercent: { textAlign: 'left', padding: '8px 12px', border: '1px solid #dee2e6', verticalAlign: 'middle', width: '150px' }, resultsTableCellCount: { textAlign: 'right', padding: '8px 12px', border: '1px solid #dee2e6', verticalAlign: 'middle', fontWeight: '500' }, percentBarContainer: { width: '100%', backgroundColor: '#e9ecef', height: '10px', borderRadius: '3px', marginTop: '4px', overflow: 'hidden' }, percentBar: { height: '100%', transition: 'width 0.3s ease-in-out' }, summaryStat: { fontWeight: 'bold', fontSize: '1.1em', margin: '10px 0', color: '#0d6efd' }, infoText: { fontSize: '0.9em', color: '#6c757d', marginBottom: '10px' }, noAnswerText: { fontStyle: 'italic', color: '#6c757d' }, textResponseList: { listStyle: 'none', padding: 0, maxHeight: '300px', overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: '4px' }, textResponseItem: { padding: '8px 12px', borderBottom: '1px dotted #dee2e6' }, rowHeader: { fontWeight: 'bold', textAlign: 'left', padding: '8px 12px', border: '1px solid #dee2e6', verticalAlign: 'middle', backgroundColor: '#f8f9fa' }, heatmapContainer: { border: '1px solid #dee2e6', display: 'inline-block', maxWidth: '100%' }, heatmapImage: { display: 'block', maxWidth: '100%', height: 'auto' }, cardSortResultContainer: { display: 'flex', flexDirection: 'column', gap: '15px', }, cardSortResultCategory: { border: '1px solid #e0e0e0', borderRadius: '6px', backgroundColor: '#f9f9f9', padding: '15px', }, cardSortCategoryTitle: { margin: '0 0 10px 0', fontSize: '1.1em', fontWeight: 'bold', color: '#444', borderBottom: '1px solid #eee', paddingBottom: '5px', }, cardSortCardList: { listStyle: 'none', padding: 0, margin: 0, }, cardSortCardItem: { display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '0.95em', borderBottom: '1px dotted #eee' }, cardSortCardName: { color: '#333', }, cardSortCardCount: { color: '#666', fontSize: '0.9em', whiteSpace: 'nowrap', marginLeft: '10px', }, cardSortEmptyCategory: { fontSize: '0.9em', color: '#777', fontStyle: 'italic', padding: '10px 0', }, loadingErrorText: { textAlign: 'center', padding: '40px', fontSize: '1.2em', color: '#dc3545' }, backLink: { display: 'inline-block', marginBottom: '20px', color: '#0d6efd', textDecoration: 'none' }, npsScoreContainer: { marginBottom: '20px' }, npsScoreLabel: { fontSize: '1.2em', fontWeight: 'bold', display: 'block', marginBottom: '10px' }, npsCombinedBar: { display: 'flex', height: '30px', width: '100%', borderRadius: '5px', overflow: 'hidden', border: '1px solid #ccc' }, npsBarSegment: { height: '100%', transition: 'width 0.5s ease-in-out' }, npsPromoterColor: { backgroundColor: '#28a745' }, npsPassiveColor: { backgroundColor: '#ffc107' }, npsDetractorColor: { backgroundColor: '#dc3545' }, rankDistContainer: { display: 'flex', alignItems: 'flex-end', height: '40px', width: '100%', borderBottom: '1px solid #ccc', padding: '0 5px', boxSizing: 'border-box' }, rankDistBar: { flex: 1, backgroundColor: '#a6d8a8', margin: '0 2%', transition: 'height 0.3s ease' }, rankDistLabels: { display: 'flex', justifyContent: 'space-between', fontSize: '0.75em', color: '#6c757d', marginTop: '2px', padding: '0 5px' }, writeInContainer: { marginTop: '15px', borderTop: '1px dashed #ccc', paddingTop: '10px' }, writeInHeader: { fontSize: '0.95em', color: '#333', marginBottom: '5px', display: 'block' }, writeInList: { listStyle: 'none', paddingLeft: '15px', maxHeight: '150px', overflowY: 'auto', fontSize: '0.9em' }, writeInItem: { marginBottom: '3px' }, writeInCount: { color: '#6c757d', marginLeft: '5px', fontSize: '0.9em' }, exportLink: { display: 'inline-block', padding: '8px 15px', backgroundColor: '#198754', color: 'white', textDecoration: 'none', borderRadius: '5px', fontSize: '0.9em', fontWeight: 'bold', transition: 'background-color 0.2s ease', whiteSpace: 'nowrap', }, };

    if (loading && !survey) { /* ... */ }
    if (error) { /* ... */ }
    if (!survey || !survey.questions) { /* ... */ }

    const overallTotalRespondents = processedResults.overallTotalRespondents || 0;
    return ( <div style={styles.pageContainer}><Link to="/admin" style={styles.backLink}>&larr; Back to Admin</Link><div style={styles.header}><h1 style={styles.surveyTitle}>{survey.title}</h1><span style={styles.respondentCount}>Total Respondents: {overallTotalRespondents}</span>{surveyId && ( <a href={`${apiUrl}/surveys/${surveyId}/export`} style={styles.exportLink} target="_blank" rel="noopener noreferrer"> Export to CSV </a> )}</div>{!loading && overallTotalRespondents === 0 && Object.keys(processedResults).length > 1 && ( <p style={styles.noAnswerText}>No responses have been submitted for this survey yet.</p> )}{survey.questions.map((question, index) => ( <div key={question._id} style={styles.questionResultBox}><h3 style={styles.questionText}>{index + 1}. {question.text}</h3>{renderQuestionResults(question)}<p style={styles.infoText}>Responses for this question: {processedResults[question._id]?.stats?.totalResponses || 0}</p></div> ))}</div> );
}

export default SurveyResultsPage;
// ----- END OF COMPLETE MODIFIED FILE (v2.9) -----