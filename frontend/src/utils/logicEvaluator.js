// frontend/src/utils/logicEvaluator.js (New File - Adapted from backend)

// Removed: const mongoose = require('mongoose');

function evaluateCondition(condition, answersMap, allQuestions) {
    const sourceQuestionIdStr = String(condition.sourceQuestionId);
    // Frontend currentAnswers is likely { questionId: value }, not an array of objects.
    // So, answersMap will be built from that.
    const answerValue = answersMap.get(sourceQuestionIdStr); 
    const question = allQuestions.find(q => String(q._id) === sourceQuestionIdStr);

    if (!question) {
        console.warn(`[FE Logic] evaluateCondition: Source question ${sourceQuestionIdStr} not found.`);
        return false;
    }

    const conditionValue = condition.conditionValue;

    if (condition.conditionOperator === 'isEmpty') { return answerValue === undefined || answerValue === null || (typeof answerValue === 'string' && answerValue.trim() === '') || (Array.isArray(answerValue) && answerValue.length === 0) || (typeof answerValue === 'object' && answerValue !== null && Object.keys(answerValue).length === 0 && !(answerValue instanceof Date)); }
    if (condition.conditionOperator === 'isNotEmpty') { return !(answerValue === undefined || answerValue === null || (typeof answerValue === 'string' && answerValue.trim() === '') || (Array.isArray(answerValue) && answerValue.length === 0) || (typeof answerValue === 'object' && answerValue !== null && Object.keys(answerValue).length === 0 && !(answerValue instanceof Date))); }
    
    if (answerValue === undefined || answerValue === null) {
        // Allow click-based operators to proceed even if answerValue is initially null/undefined
        // as clicks might populate it. For other operators, if no answer, condition usually fails.
        if (condition.conditionOperator.startsWith('clickCount') || condition.conditionOperator === 'clickInArea') {
            // For these, if answerValue is null/undefined, it means no clicks yet,
            // so 'clickCountEq: 0' would be true, 'clickCountGt: 0' false, etc.
            // The specific logic below handles the count correctly if answerValue is an empty array.
        } else {
             return false; // No answer to evaluate for most conditions
        }
    }

    switch (condition.conditionOperator) {
        case 'eq': 
            if (Array.isArray(answerValue)) { return answerValue.map(String).includes(String(conditionValue)); }
            return String(answerValue) === String(conditionValue);
        case 'ne':
            if (Array.isArray(answerValue)) { return !answerValue.map(String).includes(String(conditionValue)); }
            return String(answerValue) !== String(conditionValue);
        case 'gt': { const numAnswer = parseFloat(answerValue); const numCondition = parseFloat(conditionValue); return !isNaN(numAnswer) && !isNaN(numCondition) && numAnswer > numCondition; }
        case 'gte': { const numAnswer = parseFloat(answerValue); const numCondition = parseFloat(conditionValue); return !isNaN(numAnswer) && !isNaN(numCondition) && numAnswer >= numCondition; }
        case 'lt': { const numAnswer = parseFloat(answerValue); const numCondition = parseFloat(conditionValue); return !isNaN(numAnswer) && !isNaN(numCondition) && numAnswer < numCondition; }
        case 'lte': { const numAnswer = parseFloat(answerValue); const numCondition = parseFloat(conditionValue); return !isNaN(numAnswer) && !isNaN(numCondition) && numAnswer <= numCondition; }
        case 'contains':
            if (Array.isArray(answerValue)) { return answerValue.map(String).includes(String(conditionValue)); }
            if (typeof answerValue === 'string') { return answerValue.toLowerCase().includes(String(conditionValue).toLowerCase()); }
            return false;
        case 'notContains':
            if (Array.isArray(answerValue)) { return !answerValue.map(String).includes(String(conditionValue)); }
            if (typeof answerValue === 'string') { return !answerValue.toLowerCase().includes(String(conditionValue).toLowerCase()); }
            return true; // If not array or string, it "does not contain"
        
        case 'clickCountEq': case 'clickCountGt': case 'clickCountGte': case 'clickCountLt': case 'clickCountLte': {
            if (question.type !== 'heatmap') { console.warn(`[FE Logic] Click count operator used on non-heatmap: ${question.type}`); return false; }
            const clicksArray = Array.isArray(answerValue) ? answerValue : []; // Ensure it's an array, even if null/undefined
            const clickCount = clicksArray.length;
            const numConditionVal = parseInt(conditionValue, 10);
            if (isNaN(numConditionVal)) { console.warn(`[FE Logic] Invalid number for click count condition: ${conditionValue}`); return false; }
            const operator = condition.conditionOperator;
            if (operator === 'clickCountEq') return clickCount === numConditionVal;
            if (operator === 'clickCountGt') return clickCount > numConditionVal;
            if (operator === 'clickCountGte') return clickCount >= numConditionVal;
            if (operator === 'clickCountLt') return clickCount < numConditionVal;
            if (operator === 'clickCountLte') return clickCount <= numConditionVal;
            return false;
        }

        case 'clickInArea': {
            if (question.type !== 'heatmap') { console.warn(`[FE Logic] clickInArea on non-heatmap: ${question.type}`); return false; }
            const definedAreaId = conditionValue;
            if (!definedAreaId) { console.warn('[FE Logic] clickInArea: No defined area ID.'); return false; }
            if (!Array.isArray(question.definedHeatmapAreas) || question.definedHeatmapAreas.length === 0) { console.warn(`[FE Logic] clickInArea: Question ${question._id} has no definedHeatmapAreas.`); return false; }
            const areaDef = question.definedHeatmapAreas.find(area => area.id === definedAreaId);
            if (!areaDef) { console.warn(`[FE Logic] clickInArea: Area ID "${definedAreaId}" not found in question ${question._id}.`); return false; }
            if (typeof areaDef.x !== 'number' || typeof areaDef.y !== 'number' || typeof areaDef.width !== 'number' || typeof areaDef.height !== 'number') { console.error('[FE Logic] clickInArea: Invalid area definition:', areaDef); return false; }
            if (!Array.isArray(answerValue) || answerValue.length === 0) return false; // No clicks to check

            for (const click of answerValue) {
                if (typeof click.x === 'number' && typeof click.y === 'number') {
                    const clickX = click.x; const clickY = click.y;
                    const areaX1 = areaDef.x; const areaY1 = areaDef.y;
                    const areaX2 = areaDef.x + areaDef.width; const areaY2 = areaDef.y + areaDef.height;
                    if (clickX >= areaX1 && clickX <= areaX2 && clickY >= areaY1 && clickY <= areaY2) return true;
                }
            }
            return false;
        }
        // Add other cases from your backend evaluator: rowValueEquals, itemAtRankIs, etc.
        // Ensure they correctly interpret `answerValue` from the frontend's `currentAnswers` structure.
        // For example:
        case 'rowValueEquals': 
            if (typeof answerValue !== 'object' || answerValue === null) return false;
            const [rowId, expectedColId] = String(conditionValue).split(';');
            if (!rowId || !expectedColId) return false;
            return String(answerValue[rowId]) === expectedColId; // Ensure string comparison if needed

        case 'rowIsAnswered':
            if (typeof answerValue !== 'object' || answerValue === null) return false;
            const rowIdAns = String(conditionValue);
            return answerValue.hasOwnProperty(rowIdAns) && answerValue[rowIdAns] !== null && answerValue[rowIdAns] !== undefined && String(answerValue[rowIdAns]).trim() !== '';

        case 'rowIsNotAnswered':
            if (typeof answerValue !== 'object' || answerValue === null) return false;
            const rowIdNotAns = String(conditionValue);
            return !answerValue.hasOwnProperty(rowIdNotAns) || answerValue[rowIdNotAns] === null || answerValue[rowIdNotAns] === undefined || String(answerValue[rowIdNotAns]).trim() === '';
        
        case 'itemAtRankIs':
            if (!Array.isArray(answerValue)) return false;
            const [rankStr, itemId] = String(conditionValue).split(';');
            const rank = parseInt(rankStr, 10);
            if (isNaN(rank) || rank <= 0 || !itemId) return false;
            return String(answerValue[rank - 1]) === itemId;

        case 'itemIsRanked':
            if (!Array.isArray(answerValue)) return false;
            return answerValue.map(String).includes(String(conditionValue));

        case 'bestIs':
            return typeof answerValue === 'object' && answerValue !== null && String(answerValue.best) === String(conditionValue);
        case 'worstIs':
            return typeof answerValue === 'object' && answerValue !== null && String(answerValue.worst) === String(conditionValue);

        case 'cardInCategory':
            if (typeof answerValue !== 'object' || answerValue === null || typeof answerValue.assignments !== 'object' || answerValue.assignments === null) return false;
            const [cardId, categoryId] = String(conditionValue).split(';');
            if (!cardId || !categoryId) return false;
            return String(answerValue.assignments[cardId]) === categoryId;

        case 'categoryHasCards':
            if (typeof answerValue !== 'object' || answerValue === null || typeof answerValue.assignments !== 'object' || answerValue.assignments === null) return false;
            const catIdHas = String(conditionValue);
            return Object.values(answerValue.assignments).map(String).includes(catIdHas);

        case 'categoryIsEmpty':
             if (typeof answerValue !== 'object' || answerValue === null || typeof answerValue.assignments !== 'object' || answerValue.assignments === null) return false;
            const catIdEmpty = String(conditionValue);
            return !Object.values(answerValue.assignments).map(String).includes(catIdEmpty);

        default:
            console.warn(`[FE Logic] evaluateCondition: Unknown operator "${condition.conditionOperator}"`);
            return false;
    }
}

function evaluateLogicGroup(group, answersMap, allQuestions) {
    if (!group.conditions || group.conditions.length === 0) {
        // An empty group is often considered true in "AND" context, false in "OR" if it's the only one.
        // Or, more simply, if there are no conditions, the group itself doesn't impose a constraint.
        // Depending on overallOperator, this might mean the rule is met or not.
        // For now, let's say an empty group is true (doesn't make the rule fail).
        return true; 
    }
    if (group.groupOperator === 'AND') {
        for (const condition of group.conditions) {
            if (!evaluateCondition(condition, answersMap, allQuestions)) {
                return false; // If any condition in AND group is false, group is false
            }
        }
        return true; // All conditions in AND group were true
    } else if (group.groupOperator === 'OR') {
        for (const condition of group.conditions) {
            if (evaluateCondition(condition, answersMap, allQuestions)) {
                return true; // If any condition in OR group is true, group is true
            }
        }
        return false; // No conditions in OR group were true
    }
    console.warn(`[FE Logic] evaluateLogicGroup: Unknown group operator "${group.groupOperator}"`);
    return false;
}

// Renamed to match typical frontend export style, and to avoid conflict if you ever import backend directly (unlikely)
export function evaluateSurveyLogic(logicRules, currentAnswersObject, allQuestions) {
    if (!logicRules || logicRules.length === 0) {
        return null; // No rules to evaluate
    }
    if (!allQuestions || allQuestions.length === 0) {
        console.warn("[FE Logic] evaluateSurveyLogic: allQuestions array is empty or undefined.");
        return null;
    }

    // Convert frontend currentAnswers { qId: value } to the Map structure expected by evaluateCondition/Group
    const answersMap = new Map();
    for (const questionId in currentAnswersObject) {
        if (Object.hasOwnProperty.call(currentAnswersObject, questionId)) {
            answersMap.set(String(questionId), currentAnswersObject[questionId]);
        }
    }

    for (const rule of logicRules) { // rule is a full rule object with groups, overallOperator, action
        if (!rule.groups || rule.groups.length === 0) {
             // If a rule has no groups, what does it mean? Usually, it shouldn't happen.
             // If it means "always apply action", then return rule.action.
             // For now, skip rules with no groups.
            console.warn("[FE Logic] Rule has no groups:", rule);
            continue;
        }

        let ruleMet = false;
        if (rule.overallOperator === 'AND') {
            ruleMet = true; // Assume true, try to falsify
            for (const group of rule.groups) {
                if (!evaluateLogicGroup(group, answersMap, allQuestions)) {
                    ruleMet = false;
                    break; 
                }
            }
        } else if (rule.overallOperator === 'OR') {
            ruleMet = false; // Assume false, try to verify
            for (const group of rule.groups) {
                if (evaluateLogicGroup(group, answersMap, allQuestions)) {
                    ruleMet = true;
                    break;
                }
            }
        } else {
            console.warn(`[FE Logic] evaluateSurveyLogic: Unknown overall rule operator "${rule.overallOperator}" for rule:`, rule.ruleName);
            continue; 
        }

        if (ruleMet) {
            return rule.action; // First rule that is met triggers its action
        }
    }
    return null; // No rule was met
}