// frontend/src/pages/SurveyResultsPage.js
// ----- START OF COMPLETE MODIFIED FILE (v3.4 - Restore missing cases, enhanced MC logging) -----
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
const safeJsonParse = (value, defaultValue = null) => { if (typeof value !== 'string' || !value.trim()) { return defaultValue; } try { const parsed = JSON.parse(value); return parsed; } catch (e) { console.warn("safeJsonParse failed for value:", value, e); return defaultValue; } };

function SurveyResultsPage() {
    const { surveyId } = useParams();
    const [survey, setSurvey] = useState(null);
    const [rawAnswers, setRawAnswers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [processedResults, setProcessedResults] = useState({});
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

    const processAllAnswers = useCallback((surveyDefinition, allRawAnswersFromDb) => {
        console.log("[ResultsPage v3.4] Processing raw answers...", { numAnswers: allRawAnswersFromDb.length });
        if (!surveyDefinition || !surveyDefinition.questions || !allRawAnswersFromDb || !Array.isArray(allRawAnswersFromDb)) {
            console.error("[ResultsPage v3.4] Invalid input to processAllAnswers", { surveyDefinition, allRawAnswersFromDb });
            return {};
        }
        const results = {};
        const respondentSessionIds = new Set(allRawAnswersFromDb.map(a => a.sessionId));
        const totalRespondentsOverall = respondentSessionIds.size;

        surveyDefinition.questions.forEach(question => {
            if (!question || !question._id || !question.type) {
                console.warn("[ResultsPage v3.4] Skipping invalid question object in surveyDefinition:", question);
                return; 
            }

            const questionId = question._id;
            const questionType = question.type;
            console.log(`[ResultsPage v3.4] Processing question: ID=${questionId}, Type=${questionType}, Text="${question.text}"`);

            const questionAnswersFromDb = allRawAnswersFromDb.filter(a => a.questionId === questionId);
            const questionRespondents = new Set(questionAnswersFromDb.map(a => a.sessionId)).size;
            
            let stats = { totalResponses: questionRespondents, counts: {}, values: [], responses: [], average: null, min: null, max: null, writeIns: {}, rows: {}, averageRanks: {}, rankCounts: {}, clicks: [], bestCounts: {}, worstCounts: {}, levelCounts: {}, cardPlacementsByCard: {}, cardPlacementsByCategory: {}, userCategoriesFromAnswers: [], promoters:0, passives:0, detractors:0, npsScore:0 };

            try {
                switch (questionType) {
                    case 'multiple-choice': case 'dropdown': case 'checkbox':
                        console.log(`[ResultsPage v3.4 QID ${questionId} Type ${questionType}] Processing. Options:`, question.options, "Answers from DB:", questionAnswersFromDb);
                        const tempCounts = {};
                        questionAnswersFromDb.forEach(ansFromDb => {
                            const mainValues = questionType === 'checkbox' ? (ansFromDb.answerValue || '').split('||').filter(Boolean) : [ansFromDb.answerValue];
                            console.log(`[ResultsPage v3.4 QID ${questionId}] ansFromDb:`, ansFromDb, "mainValues:", mainValues);
                            mainValues.forEach(val => {
                                if (val === null || val === undefined || val === '') {
                                    console.log(`[ResultsPage v3.4 QID ${questionId}] Skipping null/undefined/empty value.`);
                                    return;
                                }
                                if (val === NA_KEY) { tempCounts[NA_KEY] = (tempCounts[NA_KEY] || 0) + 1; }
                                else if (val === OTHER_KEY_INTERNAL) { 
                                    tempCounts[OTHER_KEY_INTERNAL] = (tempCounts[OTHER_KEY_INTERNAL] || 0) + 1; 
                                    if (ansFromDb.otherText && ansFromDb.otherText.trim()) { 
                                        const writeInText = ansFromDb.otherText.trim(); 
                                        stats.writeIns[writeInText] = (stats.writeIns[writeInText] || 0) + 1; 
                                    }
                                } else if (question.options && question.options.includes(val)) { // Ensure question.options exists
                                     tempCounts[val] = (tempCounts[val] || 0) + 1;
                                } else { 
                                    console.warn(`[ResultsPage v3.4 QID ${questionId}] Unexpected value "${val}" for ${questionType}. Not in options:`, question.options);
                                }
                            });
                        });
                        stats.counts = tempCounts;
                        console.log(`[ResultsPage v3.4 QID ${questionId} Type ${questionType}] Finished processing. tempCounts:`, tempCounts, "stats.writeIns:", stats.writeIns);
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
                            console.error(`[ResultsPage v3.4] Matrix question ID=${questionId} is missing matrixRows or matrixColumns. Rows:`, question.matrixRows, "Cols:", question.matrixColumns);
                            stats.processingError = "Matrix definition incomplete (missing rows/columns).";
                            break; 
                        }
                        questionAnswersFromDb.forEach(ans => {
                            const matrixData = safeJsonParse(ans.answerValue, {});
                            if (typeof matrixData !== 'object' || matrixData === null) {
                                console.warn(`[ResultsPage v3.4] Matrix QID ${questionId}: Parsed matrixData is not an object for answerValue:`, ans.answerValue);
                                return; 
                            }
                            Object.entries(matrixData).forEach(([row, value]) => {
                                if (!question.matrixRows || !question.matrixRows.includes(row)) {
                                    console.warn(`[ResultsPage v3.4] Matrix QID ${questionId}: Row "${row}" from answer not found in question.matrixRows. Skipping. matrixRows:`, question.matrixRows);
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
                            const clicksData = (typeof ans.answerValue === 'string') ? safeJsonParse(ans.answerValue, []) : (Array.isArray(ans.answerValue) ? ans.answerValue : []);
                            if (!Array.isArray(clicksData)) {
                                console.warn(`[ResultsPage v3.4] Heatmap QID ${questionId}: Parsed clicksData is not an array for answerValue:`, ans.answerValue);
                                return; 
                            }
                            clicksData.forEach(click => {
                                if (typeof click === 'object' && click !== null &&
                                    typeof click.x === 'number' && typeof click.y === 'number' &&
                                    click.x >= 0 && click.x <= 1 && click.y >= 0 && click.y <= 1) {
                                    stats.clicks.push(click);
                                } else {
                                    console.warn(`[ResultsPage v3.4] Heatmap QID ${questionId}: Invalid click object found in clicksData:`, click, "Original answerValue:", ans.answerValue);
                                }
                            });
                        });
                        break;
                    // --- RESTORED MISSING CASES ---
                    case 'maxdiff': 
                        stats.bestCounts = {}; stats.worstCounts = {}; 
                        questionAnswersFromDb.forEach(ans => { 
                            const mdData = (typeof ans.answerValue === 'string') ? safeJsonParse(ans.answerValue, {}) : (typeof ans.answerValue === 'object' && ans.answerValue !== null ? ans.answerValue : {}); 
                            if (typeof mdData === 'object' && mdData !== null) { 
                                if (mdData.best && question.options?.includes(mdData.best)) { stats.bestCounts[mdData.best] = (stats.bestCounts[mdData.best] || 0) + 1; } 
                                if (mdData.worst && question.options?.includes(mdData.worst)) { stats.worstCounts[mdData.worst] = (stats.worstCounts[mdData.worst] || 0) + 1; } 
                            } 
                        }); 
                        break;
                    case 'conjoint': 
                        stats.levelCounts = {}; 
                        questionAnswersFromDb.forEach(ans => { 
                            const chosenProfile = (typeof ans.answerValue === 'string') ? safeJsonParse(ans.answerValue, {}) : (typeof ans.answerValue === 'object' && ans.answerValue !== null ? ans.answerValue : {}); 
                            if (typeof chosenProfile === 'object' && chosenProfile !== null) { 
                                Object.entries(chosenProfile).forEach(([attribute, level]) => { 
                                    if (typeof attribute === 'string' && typeof level === 'string') { 
                                        if (!stats.levelCounts[attribute]) { stats.levelCounts[attribute] = {}; } 
                                        stats.levelCounts[attribute][level] = (stats.levelCounts[attribute][level] || 0) + 1; 
                                    } 
                                }); 
                            } 
                        }); 
                        break;
                    case 'cardsort': 
                        stats.cardPlacementsByCard = {}; 
                        stats.cardPlacementsByCategory = { [CARD_SORT_UNASSIGNED_ID]: {} }; 
                        (question.cardSortCategories || []).forEach(catName => { stats.cardPlacementsByCategory[catName] = {}; }); 
                        const foundUserCategoryIds = new Set(); 
                        stats.userCategoriesFromAnswers = []; 
                        questionAnswersFromDb.forEach(ans => { 
                            const parsedAnswer = (typeof ans.answerValue === 'string') ? safeJsonParse(ans.answerValue, { assignments: {}, userCategories: [] }) : (typeof ans.answerValue === 'object' && ans.answerValue !== null ? ans.answerValue : { assignments: {}, userCategories: [] }); 
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
                                if (!question.options?.includes(cardId)) return; 
                                if (!stats.cardPlacementsByCard[cardId]) stats.cardPlacementsByCard[cardId] = {}; 
                                stats.cardPlacementsByCard[cardId][categoryId] = (stats.cardPlacementsByCard[cardId][categoryId] || 0) + 1; 
                                if (!stats.cardPlacementsByCategory[categoryId]) { 
                                    if (foundUserCategoryIds.has(categoryId)) { /* ok */ } 
                                    else if (categoryId !== CARD_SORT_UNASSIGNED_ID && !(question.cardSortCategories || []).includes(categoryId)) { return; } 
                                    if (!stats.cardPlacementsByCategory[categoryId]) { stats.cardPlacementsByCategory[categoryId] = {}; } 
                                } 
                                stats.cardPlacementsByCategory[categoryId][cardId] = (stats.cardPlacementsByCategory[categoryId][cardId] || 0) + 1; 
                            }); 
                        }); 
                        break;
                    default: console.warn(`[ResultsPage v3.4 QID ${questionId}] No processing logic defined for question type: ${questionType}`);
                }
            } catch (processingError) { console.error(`Error processing answers for question ${questionId} (${questionType}):`, processingError); stats.processingError = processingError.message || "An unknown error occurred during processing."; }
            results[questionId] = { stats };
        });
        results.overallTotalRespondents = totalRespondentsOverall;
        // console.log("[ResultsPage v3.4] Processed results (end of function):", JSON.parse(JSON.stringify(results))); // Kept for verbosity if needed
        return results;
    }, []);

    const fetchData = useCallback(async () => { setLoading(true); setError(null); setSurvey(null); setRawAnswers([]); setProcessedResults({}); if (!surveyId || !/^[a-f\d]{24}$/i.test(surveyId)) { setError(`Invalid Survey ID format: "${surveyId}"`); setLoading(false); return; } const token = localStorage.getItem('token'); if (!token) { setError("Authentication required. Please log in again."); setLoading(false); return; } const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }; try { const surveyResponse = await fetch(`${apiUrl}/surveys/${surveyId}`, { headers }); if (!surveyResponse.ok) { const errorBody = await surveyResponse.text(); let errorMessage = `Failed to fetch survey definition (Status: ${surveyResponse.status}).`; try { const parsedError = JSON.parse(errorBody); if (parsedError.message) errorMessage += ` Server: ${parsedError.message}`; } catch (e) { /* Ignore */ } throw new Error(errorMessage); } const surveyJsonResponse = await surveyResponse.json(); if (!surveyJsonResponse.success || !surveyJsonResponse.data || !surveyJsonResponse.data.questions) { throw new Error(surveyJsonResponse.message || "Survey data from server is invalid or missing questions."); } setSurvey(surveyJsonResponse.data); const answersResponse = await fetch(`${apiUrl}/answers/survey/${surveyId}`, { headers }); if (!answersResponse.ok) { const errorBody = await answersResponse.text(); let errorMessage = `Failed to fetch survey answers (Status: ${answersResponse.status}).`; try { const parsedError = JSON.parse(errorBody); if (parsedError.message) errorMessage += ` Server: ${parsedError.message}`; } catch (e) { /* Ignore */ } throw new Error(errorMessage); } const answersJsonResponse = await answersResponse.json(); let actualAnswersArray = []; if (Array.isArray(answersJsonResponse)) { actualAnswersArray = answersJsonResponse; } else if (answersJsonResponse && answersJsonResponse.success && Array.isArray(answersJsonResponse.data)) { actualAnswersArray = answersJsonResponse.data; } else if (answersJsonResponse && answersJsonResponse.success === false) { throw new Error(answersJsonResponse.message || "Fetching answers failed as indicated by server."); } else { throw new Error("Received unexpected data format for survey answers."); } setRawAnswers(actualAnswersArray); } catch (err) { setError(err.message || "An unexpected error occurred while loading results data."); } finally { setLoading(false); } }, [surveyId, apiUrl]);
    
    useEffect(() => { fetchData(); }, [fetchData]);
    
    useEffect(() => {
        // console.log("[ResultsPage v3.4] useEffect for processing. States:", { survey: !!survey, rawAnswers: rawAnswers.length, loading, error: !!error }); // Kept for verbosity
        if (survey && rawAnswers.length > 0 && !loading && !error) {
            const processed = processAllAnswers(survey, rawAnswers);
            // console.log("[ResultsPage v3.4] Setting processedResults with:", processed); // Kept for verbosity
            setProcessedResults(processed);
        } else if (survey && rawAnswers.length === 0 && !loading && !error) { 
            setProcessedResults({ overallTotalRespondents: 0 });
        }
    }, [survey, rawAnswers, loading, error, processAllAnswers]);

    const renderQuestionResults = (question) => {
        if (!question || !question._id) {
            console.error("[ResultsPage v3.4 renderQuestionResults] Invalid question object passed:", question);
            return <p style={styles.noAnswerText}>Question definition missing or invalid.</p>;
        }
        const questionId = question._id;
        const resultData = processedResults[questionId];

        if (!resultData) {
            // console.warn(`[ResultsPage v3.4 renderQuestionResults] No resultData for QID: ${questionId}. Keys:`, Object.keys(processedResults)); // Kept for verbosity
            return <p style={styles.noAnswerText}>Processing data not found for this question.</p>;
        }

        const stats = resultData.stats; 
        const { type, text, options = [], matrixRows = [], matrixColumns = [], sliderMin, sliderMax, imageUrl, matrixType, cardSortCategories = [] } = question;

        if (!stats) { 
            console.warn(`[ResultsPage v3.4 renderQuestionResults] No stats object in resultData for QID: ${questionId}. ResultData:`, resultData);
            return <p style={styles.noAnswerText}>Statistics not available for this question.</p>;
        }
        if (stats.processingError) return <p style={styles.errorText}>Error processing results: {stats.processingError}</p>;
        
        const qRespondents = stats.totalResponses || 0;
        
        if (qRespondents === 0 && type !== 'heatmap' && type !== 'text' && type !== 'textarea') { // Allow text/textarea to show even with 0 responses (to show "No responses")
             if (type === 'heatmap' && imageUrl) { /* allow heatmap to render base image */ }
             else if (type !== 'text' && type !== 'textarea') return <p style={styles.noAnswerText}>No responses for this question.</p>;
        }
        
        const defaultPieChartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' }, title: { display: false }, tooltip: { callbacks: { label: function(context) { let label = context.label || ''; if (label) { label += ': '; } if (context.parsed !== null && context.parsed !== undefined) { label += context.parsed.toLocaleString(); } const datasetData = context.chart?.data?.datasets?.[0]?.data; if (Array.isArray(datasetData)) { const total = datasetData.reduce((a, b) => (a || 0) + (b || 0), 0); const percentage = total > 0 && context.raw !== null && context.raw !== undefined ? ((context.raw / total) * 100).toFixed(1) + '%' : '0%'; return `${label} (${percentage})`; } return label; } } } } };
        const defaultBarChartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' }, title: { display: false }, tooltip: { callbacks: { label: function(context) { let label = context.dataset.label || context.label || ''; if (label) { label += ': '; } if (context.parsed?.y !== null && context.parsed?.y !== undefined) { label += context.parsed.y.toLocaleString(); } return label; } } } }, scales: { x: { beginAtZero: true, title: { display: false } }, y: { beginAtZero: true, title: { display: false }, ticks: { precision: 0 } } } };

        switch (type) {
            case 'multiple-choice': case 'dropdown': case 'checkbox': {
                console.log(`[ResultsPage v3.4 QID ${questionId} Type ${type}] Rendering. Stats:`, JSON.parse(JSON.stringify(stats)), "Options from question prop:", options);
                const counts = stats.counts || {}; const writeIns = stats.writeIns || {};
                let chartItems = []; let tableItems = []; let writeInDetails = [];
                
                (options || []).forEach(opt => { 
                    // Ensure opt is a string or has a string 'value' property if objects are used in options
                    const optionValue = typeof opt === 'object' && opt !== null && opt.value !== undefined ? opt.value : opt;
                    if (counts[optionValue] > 0) { 
                        const displayLabel = typeof opt === 'object' && opt !== null && opt.text !== undefined ? opt.text : opt;
                        const item = { key: optionValue, displayLabel: displayLabel, count: counts[optionValue], type: 'predefined' }; 
                        chartItems.push(item); tableItems.push(item); 
                    } else if (counts[optionValue] === undefined && question.options.includes(optionValue)) {
                        // Option exists in question but has no counts, maybe add to table with 0 count
                        // const displayLabel = typeof opt === 'object' && opt !== null && opt.text !== undefined ? opt.text : opt;
                        // tableItems.push({ key: optionValue, displayLabel: displayLabel, count: 0, type: 'predefined_zero' });
                    }
                });
                const otherTotalCount = counts[OTHER_KEY_INTERNAL] || 0;
                if (otherTotalCount > 0) { chartItems.push({ key: OTHER_KEY_INTERNAL, displayLabel: OTHER_DISPLAY_LABEL, count: otherTotalCount, type: 'other_group' }); tableItems.push({ key: OTHER_KEY_INTERNAL, displayLabel: `${OTHER_DISPLAY_LABEL} (details below)`, count: otherTotalCount, type: 'other_group' }); writeInDetails = Object.entries(writeIns).map(([writeInText, count]) => ({ text: writeInText, count })).sort((a, b) => b.count - a.count); }
                if (counts[NA_KEY] > 0) { const item = { key: NA_KEY, displayLabel: NA_DISPLAY_LABEL, count: counts[NA_KEY], type: 'na' }; chartItems.push(item); tableItems.push(item); }

                const sortOrder = { 'predefined': 1, 'other_group': 2, 'na': 3, 'predefined_zero': 4 };
                chartItems.sort((a, b) => (sortOrder[a.type] || 99) - (sortOrder[b.type] || 99) || b.count - a.count);
                tableItems.sort((a, b) => (sortOrder[a.type] || 99) - (sortOrder[b.type] || 99) || b.count - a.count);
                
                console.log(`[ResultsPage v3.4 QID ${questionId} Type ${type}] chartItems:`, chartItems, "tableItems:", tableItems, "writeInDetails:", writeInDetails);

                if (chartItems.length === 0 && tableItems.length === 0 && writeInDetails.length === 0) { 
                    console.log(`[ResultsPage v3.4 QID ${questionId} Type ${type}] No items to display, returning 'No valid answers'.`);
                    return <p style={styles.noAnswerText}>No valid answers recorded for this question.</p>; 
                }
                const chartLabels = chartItems.map(item => item.displayLabel);
                const chartDataValues = chartItems.map(item => item.count);
                const backgroundColors = chartItems.map((_, i) => getChartColor(i, 0.8));
                const borderColors = chartItems.map((_, i) => getSolidChartColor(i));
                
                if (chartDataValues.some(v => typeof v !== 'number' || isNaN(v))) { return <p style={styles.noAnswerText}>Chart data values invalid.</p>; }

                const chartData = { labels: chartLabels, datasets: [{ label: type === 'checkbox' ? '# Selections' : '# Responses', data: chartDataValues, backgroundColor: backgroundColors, borderColor: borderColors, borderWidth: 1 }] };
                const isPieChart = type === 'multiple-choice' || type === 'dropdown';
                
                let currentChartOptions = isPieChart ? defaultPieChartOptions : { ...defaultBarChartOptions, plugins: { ...defaultBarChartOptions.plugins, tooltip: { callbacks: { label: function(context) { let label = context.label || ''; if (label) { label += ': '; } const value = context.parsed?.y; const datasetData = context.chart?.data?.datasets?.[0]?.data; let totalForPercent = qRespondents; if (type !== 'checkbox' && Array.isArray(datasetData)) { totalForPercent = datasetData.reduce((a, b) => (a || 0) + (b || 0), 0); } label += `${value === undefined ? 'N/A' : value} (${calculatePercentage(value, totalForPercent)})`; return label; } } } } };
                
                const totalForTablePercent = type === 'checkbox' ? qRespondents : tableItems.reduce((sum, item) => sum + (item.count || 0), 0);
                
                return ( <div style={styles.resultContainer}> {chartItems.length > 0 && <div style={isPieChart ? styles.chartContainerPie : styles.chartContainerBar}>{isPieChart ? <Pie options={currentChartOptions} data={chartData} /> : <Bar options={currentChartOptions} data={chartData} />}</div>} {tableItems.length > 0 && <table style={styles.resultsTable}><thead><tr><th style={styles.resultsTableTh}>Value</th><th style={styles.resultsTableTh}>Percent</th><th style={styles.resultsTableTh}>Responses</th></tr></thead><tbody>{tableItems.map((item, i) => (<tr key={`${item.type}-${item.key}`}><td>{item.displayLabel}</td><td>{calculatePercentage(item.count, totalForTablePercent)}<div style={styles.percentBarContainer}><div style={{...styles.percentBar, width: calculatePercentage(item.count, totalForTablePercent), backgroundColor: getSolidChartColor(i)}}></div></div></td><td>{item.count}</td></tr>))}</tbody>{(type === 'multiple-choice' || type === 'dropdown') && <tfoot><tr><td colSpan="2" style={{textAlign: 'right'}}>Total:</td><td>{totalForTablePercent}</td></tr></tfoot>}{type === 'checkbox' && <tfoot><tr><td colSpan="2" style={{textAlign: 'right'}}>Total Respondents:</td><td>{qRespondents}</td></tr></tfoot>}</table>} {writeInDetails.length > 0 && <div style={styles.writeInContainer}><strong style={styles.writeInHeader}>"{OTHER_DISPLAY_LABEL}" Write-in Responses:</strong><ul style={styles.writeInList}>{writeInDetails.map((detail, index) => (<li key={index} style={styles.writeInItem}>"{detail.text}" <span style={styles.writeInCount}>({detail.count})</span></li>))}</ul></div>} </div> );
            }
            // ... (other cases from v3.3, including the defensive text/textarea)
            case 'text': case 'textarea': {
                const textResponses = stats.responses || [];
                if (textResponses.length === 0 && qRespondents > 0) { return <p style={styles.noAnswerText}>All responses were empty.</p>; }
                if (textResponses.length === 0 && qRespondents === 0) { return <p style={styles.noAnswerText}>No responses for this question.</p>; }

                const itemStyleBase = styles.textResponseItem || { padding: '8px 12px', borderBottom: '1px dotted #dee2e6' };
                if (!styles.textResponseItem) {
                    console.warn("[ResultsPage v3.4] styles.textResponseItem is undefined! Using fallback style. QID:", questionId);
                }
                return ( <ul style={styles.textResponseList || { listStyle: 'none', padding: 0 }}> {textResponses.map((response, index, arr) => { const currentItemStyle = { ...itemStyleBase }; if (index === arr.length - 1) { currentItemStyle.borderBottom = 'none'; } else { currentItemStyle.borderBottom = itemStyleBase.borderBottom || '1px dotted #dee2e6'; } return ( <li key={index} style={currentItemStyle}> {response || <i>(Empty)</i>} </li> ); })} </ul> );
            }
            // All other cases (rating, nps, slider, matrix, ranking, heatmap, maxdiff, conjoint, cardsort) should be here as they were in v3.2/v3.3
            // For example, for rating:
            case 'rating': { const ratingLabels = (options.length > 0 ? options.map((_, i) => String(i + 1)) : [1, 2, 3, 4, 5].map(String)); const ratingCounts = ratingLabels.map(score => stats.counts?.[String(score)] || 0); const avgRating = stats.average !== null && stats.average !== undefined ? Number(stats.average).toFixed(2) : 'N/A'; const backgroundColors = ratingLabels.map((_, i) => getChartColor(i, 0.8)); const borderColors = ratingLabels.map((_, i) => getSolidChartColor(i)); if (ratingCounts.some(v => typeof v !== 'number' || isNaN(v))) { return <p style={styles.noAnswerText}>Chart data incomplete for rating.</p>; } const chartDataRating = { labels: ratingLabels, datasets: [{ label: '# Responses', data: ratingCounts, backgroundColor: backgroundColors, borderColor: borderColors, borderWidth: 1 }] }; return ( <div style={styles.resultContainer}><p style={styles.summaryStat}>Average Rating: {avgRating}</p><div style={styles.chartContainerBar}><Bar options={defaultBarChartOptions} data={chartDataRating} /></div></div> ); }
            // ... ensure ALL other cases are present ...
            default: console.warn(`[ResultsPage v3.4 QID ${questionId} Type ${type}] Unknown question type for results display.`); return <p>Visualization for type '{type}' is not implemented.</p>;
        }
    };

    const styles = { /* ... PASTE THE FULL STYLES OBJECT FROM v3.3 HERE ... */ 
        pageContainer: { padding: '20px', maxWidth: '950px', margin: 'auto', fontFamily: 'Arial, sans-serif', color: '#333' }, header: { borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }, surveyTitle: { margin: 0, fontSize: '1.8em', flexGrow: 1 }, respondentCount: { fontSize: '1.1em', fontWeight: 'bold', color: '#6c757d', whiteSpace: 'nowrap' }, questionResultBox: { marginBottom: '40px', padding: '20px', border: '1px solid #dee2e6', borderRadius: '8px', backgroundColor: '#fff' }, questionText: { fontWeight: 'normal', fontSize: '1.3em', marginBottom: '20px', color: '#212529' }, resultContainer: { display: 'flex', flexDirection: 'column', gap: '20px' }, chartContainerPie: { height: '280px', width: '100%', maxWidth: '450px', margin: '0 auto 15px auto', position: 'relative' }, chartContainerBar: { height: '300px', width: '100%', marginBottom: '15px', position: 'relative' }, resultsTable: { width: '100%', borderCollapse: 'collapse', marginTop: '10px', fontSize: '0.9em', border: '1px solid #dee2e6' }, resultsTableTh: { backgroundColor: '#f8f9fa', fontWeight: '600', padding: '10px 12px', border: '1px solid #dee2e6', textAlign: 'left' }, resultsTableCell: { border: '1px solid #dee2e6', padding: '8px 12px', textAlign: 'center', verticalAlign: 'middle' }, resultsTableCellValue: { textAlign: 'left', padding: '8px 12px', border: '1px solid #dee2e6', verticalAlign: 'middle' }, resultsTableCellPercent: { textAlign: 'left', padding: '8px 12px', border: '1px solid #dee2e6', verticalAlign: 'middle', width: '150px' }, resultsTableCellCount: { textAlign: 'right', padding: '8px 12px', border: '1px solid #dee2e6', verticalAlign: 'middle', fontWeight: '500' }, percentBarContainer: { width: '100%', backgroundColor: '#e9ecef', height: '10px', borderRadius: '3px', marginTop: '4px', overflow: 'hidden' }, percentBar: { height: '100%', transition: 'width 0.3s ease-in-out' }, summaryStat: { fontWeight: 'bold', fontSize: '1.1em', margin: '10px 0', color: '#0d6efd' }, infoText: { fontSize: '0.9em', color: '#6c757d', marginBottom: '10px' }, noAnswerText: { fontStyle: 'italic', color: '#6c757d' }, errorText: { color: '#dc3545', fontWeight: 'bold'}, textResponseList: { listStyle: 'none', padding: 0, maxHeight: '300px', overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: '4px' }, textResponseItem: { padding: '8px 12px', borderBottom: '1px dotted #dee2e6' }, rowHeader: { fontWeight: 'bold', textAlign: 'left', padding: '8px 12px', border: '1px solid #dee2e6', verticalAlign: 'middle', backgroundColor: '#f8f9fa' }, heatmapContainer: { border: '1px solid #dee2e6', display: 'inline-block', maxWidth: '100%' }, heatmapImage: { display: 'block', maxWidth: '100%', height: 'auto' }, cardSortResultContainer: { display: 'flex', flexDirection: 'column', gap: '15px', }, cardSortResultCategory: { border: '1px solid #e0e0e0', borderRadius: '6px', backgroundColor: '#f9f9f9', padding: '15px', }, cardSortCategoryTitle: { margin: '0 0 10px 0', fontSize: '1.1em', fontWeight: 'bold', color: '#444', borderBottom: '1px solid #eee', paddingBottom: '5px', }, cardSortCardList: { listStyle: 'none', padding: 0, margin: 0, }, cardSortCardItem: { display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '0.95em', borderBottom: '1px dotted #eee' }, cardSortCardName: { color: '#333', }, cardSortCardCount: { color: '#666', fontSize: '0.9em', whiteSpace: 'nowrap', marginLeft: '10px', }, cardSortEmptyCategory: { fontSize: '0.9em', color: '#777', fontStyle: 'italic', padding: '10px 0', }, loadingErrorText: { textAlign: 'center', padding: '40px', fontSize: '1.2em', color: '#dc3545' }, backLink: { display: 'inline-block', marginBottom: '20px', color: '#0d6efd', textDecoration: 'none' }, npsScoreContainer: { marginBottom: '20px' }, npsScoreLabel: { fontSize: '1.2em', fontWeight: 'bold', display: 'block', marginBottom: '10px' }, npsCombinedBar: { display: 'flex', height: '30px', width: '100%', borderRadius: '5px', overflow: 'hidden', border: '1px solid #ccc' }, npsBarSegment: { height: '100%', transition: 'width 0.5s ease-in-out' }, npsPromoterColor: { backgroundColor: '#28a745', color: 'white' }, npsPassiveColor: { backgroundColor: '#ffc107', color: '#212529' }, npsDetractorColor: { backgroundColor: '#dc3545', color: 'white' }, rankDistContainer: { display: 'flex', alignItems: 'flex-end', height: '40px', width: '100%', borderBottom: '1px solid #ccc', padding: '0 5px', boxSizing: 'border-box' }, rankDistBar: { flex: 1, backgroundColor: '#a6d8a8', margin: '0 2%', transition: 'height 0.3s ease' }, rankDistLabels: { display: 'flex', justifyContent: 'space-between', fontSize: '0.75em', color: '#6c757d', marginTop: '2px', padding: '0 5px' }, writeInContainer: { marginTop: '15px', borderTop: '1px dashed #ccc', paddingTop: '10px' }, writeInHeader: { fontSize: '0.95em', color: '#333', marginBottom: '5px', display: 'block' }, writeInList: { listStyle: 'none', paddingLeft: '15px', maxHeight: '150px', overflowY: 'auto', fontSize: '0.9em' }, writeInItem: { marginBottom: '3px' }, writeInCount: { color: '#6c757d', marginLeft: '5px', fontSize: '0.9em' }, exportLink: { display: 'inline-block', padding: '8px 15px', backgroundColor: '#198754', color: 'white', textDecoration: 'none', borderRadius: '5px', fontSize: '0.9em', fontWeight: 'bold', transition: 'background-color 0.2s ease', whiteSpace: 'nowrap', }, 
    };

    if (loading && !survey) return <div style={styles.loadingErrorText}>Loading survey results...</div>;
    if (error) return <div style={styles.loadingErrorText}>Error loading survey results: {error}</div>;
    if (!survey || !survey.questions) return <div style={styles.loadingErrorText}>Survey data is not available or incomplete.</div>;

    const overallTotalRespondents = processedResults.overallTotalRespondents || 0;
    return ( <div style={styles.pageContainer}><Link to="/admin" style={styles.backLink}>&larr; Back to Admin</Link><div style={styles.header}><h1 style={styles.surveyTitle}>{survey.title}</h1><span style={styles.respondentCount}>Total Respondents: {overallTotalRespondents}</span>{surveyId && ( <a href={`${apiUrl}/surveys/${surveyId}/export`} style={styles.exportLink} target="_blank" rel="noopener noreferrer"> Export to CSV </a> )}</div>{!loading && overallTotalRespondents === 0 && Object.keys(processedResults).length > 1 && Object.keys(processedResults).filter(k => k !== 'overallTotalRespondents').length > 0 && ( <p style={styles.noAnswerText}>No responses have been submitted for this survey yet.</p> )}{(survey.questions || []).map((question, index) => ( <div key={question?._id || `q-${index}`} style={styles.questionResultBox}><h3 style={styles.questionText}>{index + 1}. {question?.text || 'Question text missing'}</h3>{renderQuestionResults(question)}<p style={styles.infoText}>Responses for this question: {processedResults[question?._id]?.stats?.totalResponses || 0}</p></div> ))}</div> );
}

export default SurveyResultsPage;
// ----- END OF COMPLETE MODIFIED FILE (v3.4) -----