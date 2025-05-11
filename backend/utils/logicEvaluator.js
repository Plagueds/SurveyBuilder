// backend/utils/logicEvaluator.js
// ----- START OF MODIFIED FILE (v1.1 - Evaluate clickInArea with defined areas) -----
const mongoose = require('mongoose');

function evaluateCondition(condition, answersMap, allQuestions) {
    const sourceQuestionIdStr = String(condition.sourceQuestionId);
    const answerValue = answersMap.get(sourceQuestionIdStr);
    const question = allQuestions.find(q => String(q._id) === sourceQuestionIdStr);

    if (!question) {
        console.warn(`evaluateCondition: Source question ${sourceQuestionIdStr} not found for condition:`, condition);
        return false;
    }

    const conditionValue = condition.conditionValue; // Can be area ID, number, string etc.

    if (condition.conditionOperator === 'isEmpty') { /* ... (no change) ... */ return answerValue === undefined || answerValue === null || (typeof answerValue === 'string' && answerValue.trim() === '') || (Array.isArray(answerValue) && answerValue.length === 0) || (typeof answerValue === 'object' && answerValue !== null && Object.keys(answerValue).length === 0); }
    if (condition.conditionOperator === 'isNotEmpty') { /* ... (no change) ... */ return !(answerValue === undefined || answerValue === null || (typeof answerValue === 'string' && answerValue.trim() === '') || (Array.isArray(answerValue) && answerValue.length === 0) || (typeof answerValue === 'object' && answerValue !== null && Object.keys(answerValue).length === 0)); }
    
    if (answerValue === undefined || answerValue === null) {
        if (condition.conditionOperator.startsWith('clickCount') || condition.conditionOperator === 'clickInArea') { /* Allow */ }
        else { return false; }
    }

    switch (condition.conditionOperator) {
        case 'eq': /* ... (no change) ... */ if (Array.isArray(answerValue)) { return answerValue.map(String).includes(String(conditionValue)); } return String(answerValue) === String(conditionValue);
        case 'ne': /* ... (no change) ... */ if (Array.isArray(answerValue)) { return !answerValue.map(String).includes(String(conditionValue)); } return String(answerValue) !== String(conditionValue);
        case 'gt': { /* ... (no change) ... */ const numAnswer = parseFloat(answerValue); const numCondition = parseFloat(conditionValue); return !isNaN(numAnswer) && !isNaN(numCondition) && numAnswer > numCondition; }
        case 'gte': { /* ... (no change) ... */ const numAnswer = parseFloat(answerValue); const numCondition = parseFloat(conditionValue); return !isNaN(numAnswer) && !isNaN(numCondition) && numAnswer >= numCondition; }
        case 'lt': { /* ... (no change) ... */ const numAnswer = parseFloat(answerValue); const numCondition = parseFloat(conditionValue); return !isNaN(numAnswer) && !isNaN(numCondition) && numAnswer < numCondition; }
        case 'lte': { /* ... (no change) ... */ const numAnswer = parseFloat(answerValue); const numCondition = parseFloat(conditionValue); return !isNaN(numAnswer) && !isNaN(numCondition) && numAnswer <= numCondition; }
        case 'contains': /* ... (no change) ... */ if (Array.isArray(answerValue)) { return answerValue.map(String).includes(String(conditionValue)); } if (typeof answerValue === 'string') { return answerValue.toLowerCase().includes(String(conditionValue).toLowerCase()); } return false;
        case 'notContains': /* ... (no change) ... */ if (Array.isArray(answerValue)) { return !answerValue.map(String).includes(String(conditionValue)); } if (typeof answerValue === 'string') { return !answerValue.toLowerCase().includes(String(conditionValue).toLowerCase()); } return true;
        
        case 'clickCountEq': case 'clickCountGt': case 'clickCountGte': case 'clickCountLt': case 'clickCountLte': {
            // console.log("\n[DEBUG] evaluateCondition: --- Evaluating CLICK COUNT Operator ---"); // Keep if needed
            if (question.type !== 'heatmap') { /* ... */ return false; }
            const clicksArray = Array.isArray(answerValue) ? answerValue : [];
            const clickCount = clicksArray.length;
            const numConditionVal = parseInt(conditionValue, 10);
            if (isNaN(numConditionVal)) { /* ... */ return false; }
            let result = false;
            const operator = condition.conditionOperator;
            if (operator === 'clickCountEq') result = (clickCount === numConditionVal);
            else if (operator === 'clickCountGt') result = (clickCount > numConditionVal);
            else if (operator === 'clickCountGte') result = (clickCount >= numConditionVal);
            else if (operator === 'clickCountLt') result = (clickCount < numConditionVal);
            else if (operator === 'clickCountLte') result = (clickCount <= numConditionVal);
            // console.log(`[DEBUG] clickCount Eval: Result: ${result}`);
            return result;
        }

        case 'clickInArea': {
            // console.log("\n[DEBUG] evaluateCondition: --- Evaluating CLICK IN DEFINED AREA Operator ---");
            // console.log("[DEBUG] Full Condition Object:", JSON.stringify(condition, null, 2));
            // console.log("[DEBUG] Raw Answer Value from answersMap:", JSON.stringify(answersMap.get(sourceQuestionIdStr), null, 2));

            if (question.type !== 'heatmap') {
                console.warn(`[DEBUG] clickInArea operator used on non-heatmap question type: ${question.type}. Condition fails.`);
                return false;
            }

            const definedAreaId = conditionValue; // This is now the ID of the defined area
            if (!definedAreaId) {
                console.warn('[DEBUG] clickInArea: No defined area ID provided in conditionValue. Condition fails.');
                return false;
            }

            // Find the area definition from the question object
            if (!Array.isArray(question.definedHeatmapAreas) || question.definedHeatmapAreas.length === 0) {
                console.warn(`[DEBUG] clickInArea: Question ${question._id} has no definedHeatmapAreas. Condition fails.`);
                return false;
            }
            const areaDef = question.definedHeatmapAreas.find(area => area.id === definedAreaId);

            if (!areaDef) {
                console.warn(`[DEBUG] clickInArea: Defined area with ID "${definedAreaId}" not found in question ${question._id}. Condition fails.`);
                return false;
            }

            if (typeof areaDef.x !== 'number' || typeof areaDef.y !== 'number' ||
                typeof areaDef.width !== 'number' || typeof areaDef.height !== 'number') {
                console.error('[DEBUG] clickInArea: Invalid area definition found for ID', definedAreaId, ':', areaDef);
                return false;
            }
            // console.log("[DEBUG] Found Area Definition:", areaDef);

            if (!Array.isArray(answerValue) || answerValue.length === 0) {
                // console.log("[DEBUG] clickInArea: answerValue is not an array or is empty. No clicks to check. Condition fails.");
                return false;
            }

            for (const click of answerValue) {
                if (typeof click.x === 'number' && typeof click.y === 'number') {
                    const clickX = click.x; const clickY = click.y;
                    const areaX1 = areaDef.x; const areaY1 = areaDef.y;
                    const areaX2 = areaDef.x + areaDef.width; const areaY2 = areaDef.y + areaDef.height;
                    // console.log(`[DEBUG] clickInArea: Checking click (${clickX.toFixed(3)}, ${clickY.toFixed(3)}) against area [(${areaX1.toFixed(3)},${areaY1.toFixed(3)}) to (${areaX2.toFixed(3)},${areaY2.toFixed(3)})]`);
                    if (clickX >= areaX1 && clickX <= areaX2 && clickY >= areaY1 && clickY <= areaY2) {
                        // console.log("[DEBUG] clickInArea: Click FOUND within the defined area. Condition met.");
                        return true;
                    }
                } else { /* console.warn("[DEBUG] clickInArea: Invalid click object in answerValue:", click); */ }
            }
            // console.log("[DEBUG] clickInArea: No clicks found within the defined area. Condition fails.");
            return false;
        }

        case 'rowValueEquals': { /* ... (no change) ... */ if (typeof answerValue !== 'object' || answerValue === null) return false; const [rowId, expectedColId] = String(conditionValue).split(';'); if (!rowId || !expectedColId) return false; return answerValue[rowId] === expectedColId; }
        case 'rowIsAnswered': { /* ... (no change) ... */ if (typeof answerValue !== 'object' || answerValue === null) return false; const rowId = String(conditionValue); return answerValue.hasOwnProperty(rowId) && answerValue[rowId] !== null && answerValue[rowId] !== undefined && String(answerValue[rowId]).trim() !== ''; }
        case 'rowIsNotAnswered': { /* ... (no change) ... */ if (typeof answerValue !== 'object' || answerValue === null) return false; const rowId = String(conditionValue); return !answerValue.hasOwnProperty(rowId) || answerValue[rowId] === null || answerValue[rowId] === undefined || String(answerValue[rowId]).trim() === ''; }
        case 'itemAtRankIs': { /* ... (no change) ... */ if (!Array.isArray(answerValue)) return false; const [rankStr, itemId] = String(conditionValue).split(';'); const rank = parseInt(rankStr, 10); if (isNaN(rank) || rank <= 0 || !itemId) return false; return answerValue[rank - 1] === itemId; }
        case 'itemIsRanked': { /* ... (no change) ... */ if (!Array.isArray(answerValue)) return false; const itemId = String(conditionValue); return answerValue.includes(itemId); }
        case 'bestIs': /* ... (no change) ... */ return typeof answerValue === 'object' && answerValue !== null && answerValue.best === String(conditionValue);
        case 'worstIs': /* ... (no change) ... */ return typeof answerValue === 'object' && answerValue !== null && answerValue.worst === String(conditionValue);
        case 'cardInCategory': { /* ... (no change) ... */ if (typeof answerValue !== 'object' || answerValue === null) return false; const assignments = answerValue.assignments; if (typeof assignments !== 'object' || assignments === null) return false; const [cardId, categoryId] = String(conditionValue).split(';'); if (!cardId || !categoryId) return false; return assignments[cardId] === categoryId; }
        case 'categoryHasCards': { /* ... (no change) ... */ if (typeof answerValue !== 'object' || answerValue === null) return false; const assignments = answerValue.assignments; if (typeof assignments !== 'object' || assignments === null) return false; const categoryId = String(conditionValue); return Object.values(assignments).includes(categoryId); }
        case 'categoryIsEmpty': { /* ... (no change) ... */ if (typeof answerValue !== 'object' || answerValue === null) return false; const assignments = answerValue.assignments; if (typeof assignments !== 'object' || assignments === null) return false; const categoryId = String(conditionValue); return !Object.values(assignments).includes(categoryId); }
        default: console.warn(`evaluateCondition: Unknown condition operator "${condition.conditionOperator}"`); return false;
    }
}
function evaluateLogicGroup(group, answersMap, allQuestions) { /* ... (no change) ... */ if (!group.conditions || group.conditions.length === 0) { return true; } if (group.groupOperator === 'AND') { for (const condition of group.conditions) { if (!evaluateCondition(condition, answersMap, allQuestions)) { return false; } } return true; } else if (group.groupOperator === 'OR') { for (const condition of group.conditions) { if (evaluateCondition(condition, answersMap, allQuestions)) { return true; } } return false; } console.warn(`evaluateLogicGroup: Unknown group operator "${group.groupOperator}"`); return false; }
function evaluateAllLogic(globalSkipLogicRules, currentAnswers, allQuestions) { /* ... (no change) ... */ if (!globalSkipLogicRules || globalSkipLogicRules.length === 0) { return null; } if (!allQuestions || allQuestions.length === 0) { console.warn("evaluateAllLogic: allQuestions array is empty or undefined."); return null; } const answersMap = new Map(); for (const ans of currentAnswers) { answersMap.set(String(ans.questionId), ans.answerValue); } for (const rule of globalSkipLogicRules) { if (!rule.groups || rule.groups.length === 0) { continue; } let ruleMet = false; if (rule.overallOperator === 'AND') { ruleMet = true; for (const group of rule.groups) { if (!evaluateLogicGroup(group, answersMap, allQuestions)) { ruleMet = false; break; } } } else if (rule.overallOperator === 'OR') { ruleMet = false; for (const group of rule.groups) { if (evaluateLogicGroup(group, answersMap, allQuestions)) { ruleMet = true; break; } } } else { console.warn(`evaluateAllLogic: Unknown overall rule operator "${rule.overallOperator}"`); continue; } if (ruleMet) { return rule.action; } } return null; }

module.exports = { evaluateCondition, evaluateLogicGroup, evaluateAllLogic };
// ----- END OF MODIFIED FILE (v1.1) -----