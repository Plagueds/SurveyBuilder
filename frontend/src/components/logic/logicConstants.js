// frontend/src/components/logic/logicConstants.js
// ----- START OF MODIFIED FILE (v1.3 - Conjoint and Other Text Operators) -----

// --- Define all base operator arrays FIRST ---
export const COMMON_OPERATORS = [
    { value: 'isEmpty', label: 'is empty / not answered', expectsValue: false, valueInputType: 'none' },
    { value: 'isNotEmpty', label: 'is not empty / answered', expectsValue: false, valueInputType: 'none' },
];
export const EQUALITY_OPERATORS_FOR_OPTIONS = [
    { value: 'eq', label: 'is equal to', expectsValue: true, valueInputType: 'select', valueSource: 'question_options' },
    { value: 'ne', label: 'is not equal to', expectsValue: true, valueInputType: 'select', valueSource: 'question_options' },
];
export const EQUALITY_OPERATORS_FOR_TEXT = [
    { value: 'eq', label: 'is equal to', expectsValue: true, valueInputType: 'text' },
    { value: 'ne', label: 'is not equal to', expectsValue: true, valueInputType: 'text' },
];
export const NUMERIC_COMPARISON_OPERATORS = [
    { value: 'eq', label: 'is equal to', expectsValue: true, valueInputType: 'number' },
    { value: 'ne', label: 'is not equal to', expectsValue: true, valueInputType: 'number' },
    { value: 'gt', label: 'is greater than', expectsValue: true, valueInputType: 'number' },
    { value: 'gte', label: 'is greater than or equal to', expectsValue: true, valueInputType: 'number' },
    { value: 'lt', label: 'is less than', expectsValue: true, valueInputType: 'number' },
    { value: 'lte', label: 'is less than or equal to', expectsValue: true, valueInputType: 'number' },
];
export const STRING_CONTAINS_OPERATORS = [
    { value: 'contains', label: 'contains', expectsValue: true, valueInputType: 'text' },
    { value: 'notContains', label: 'does not contain', expectsValue: true, valueInputType: 'text' },
];
export const ARRAY_CONTAINS_OPERATORS = [
    { value: 'contains', label: 'includes option', expectsValue: true, valueInputType: 'select', valueSource: 'question_options' },
    { value: 'notContains', label: 'does not include option', expectsValue: true, valueInputType: 'select', valueSource: 'question_options' },
];

// +++ NEW: Operators for "Other" text input +++
export const OTHER_TEXT_OPERATORS = [
    { value: 'otherTextEq', label: 'Other text is equal to', expectsValue: true, valueInputType: 'text', appliesToOtherText: true },
    { value: 'otherTextNe', label: 'Other text is not equal to', expectsValue: true, valueInputType: 'text', appliesToOtherText: true },
    { value: 'otherTextContains', label: 'Other text contains', expectsValue: true, valueInputType: 'text', appliesToOtherText: true },
    { value: 'otherTextNotContains', label: 'Other text does not contain', expectsValue: true, valueInputType: 'text', appliesToOtherText: true },
    { value: 'otherTextIsEmpty', label: 'Other text is empty', expectsValue: false, valueInputType: 'none', appliesToOtherText: true },
    { value: 'otherTextIsNotEmpty', label: 'Other text is not empty', expectsValue: false, valueInputType: 'none', appliesToOtherText: true },
];

// +++ NEW: Operators for Conjoint questions +++
export const CONJOINT_OPERATORS = [
    { value: 'choiceForTaskIsNone', label: 'choice for task... was "None"', expectsValue: true, valueInputType: 'select_conjoint_task', valueSource: 'question_conjoint_tasks' },
    { value: 'choiceForTaskAttributeIsLevel', label: 'choice for task... profile attribute... was level...', expectsValue: true, valueInputType: 'select_conjoint_task_attr_level', valueSource: 'question_conjoint_task_attributes_levels'},
    // Consider adding 'taskIsAnswered' / 'taskIsNotAnswered' if needed, similar to COMMON_OPERATORS but task-specific
];


// --- Now define OPERATORS_BY_QUESTION_TYPE using the above constants ---
export const OPERATORS_BY_QUESTION_TYPE = {
    'text': [...EQUALITY_OPERATORS_FOR_TEXT, ...STRING_CONTAINS_OPERATORS, ...COMMON_OPERATORS],
    'textarea': [...EQUALITY_OPERATORS_FOR_TEXT, ...STRING_CONTAINS_OPERATORS, ...COMMON_OPERATORS],
    'multiple-choice': [
        ...EQUALITY_OPERATORS_FOR_OPTIONS, 
        ...OTHER_TEXT_OPERATORS, // Added
        ...COMMON_OPERATORS
    ],
    'checkbox': [
        ...ARRAY_CONTAINS_OPERATORS, 
        ...OTHER_TEXT_OPERATORS, // Added
        ...COMMON_OPERATORS
    ],
    'dropdown': [ // Dropdowns typically don't have an "Other" free text, but if yours does, add OTHER_TEXT_OPERATORS
        ...EQUALITY_OPERATORS_FOR_OPTIONS, 
        ...COMMON_OPERATORS
    ],
    'slider': [...NUMERIC_COMPARISON_OPERATORS, ...COMMON_OPERATORS],
    'rating': [...NUMERIC_COMPARISON_OPERATORS, ...COMMON_OPERATORS],
    'nps': [...NUMERIC_COMPARISON_OPERATORS, ...COMMON_OPERATORS],
    'matrix': [
        { value: 'rowValueEquals', label: 'answer for row... is...', expectsValue: true, valueInputType: 'matrix_row_then_col_select', valueSource: 'question_matrix_rows_and_columns' },
        { value: 'rowIsAnswered', label: 'row... is answered', expectsValue: true, valueInputType: 'select', valueSource: 'question_matrix_rows' },
        { value: 'rowIsNotAnswered', label: 'row... is not answered', expectsValue: true, valueInputType: 'select', valueSource: 'question_matrix_rows' },
        ...COMMON_OPERATORS
    ],
    'ranking': [
        { value: 'itemAtRankIs', label: 'item at rank #... is...', expectsValue: true, valueInputType: 'ranking_rank_then_item_select', valueSource: 'question_options_and_rank_count' },
        { value: 'itemIsRanked', label: 'item... is ranked (any position)', expectsValue: true, valueInputType: 'select', valueSource: 'question_options' },
        ...COMMON_OPERATORS
    ],
    'heatmap': [
        { value: 'clickCountEq', label: 'click count is', expectsValue: true, valueInputType: 'number' },
        { value: 'clickCountGt', label: 'click count >', expectsValue: true, valueInputType: 'number' },
        { value: 'clickCountLt', label: 'click count <', expectsValue: true, valueInputType: 'number' },
        { value: 'clickCountGte', label: 'click count >=', expectsValue: true, valueInputType: 'number' },
        { value: 'clickCountLte', label: 'click count <=', expectsValue: true, valueInputType: 'number' },
        { value: 'clickInArea', label: 'click is in defined area', expectsValue: true, valueInputType: 'heatmapDefinedAreaSelect', valueSource: 'question_defined_heatmap_areas' },
        ...COMMON_OPERATORS
    ],
    'maxdiff': [
        { value: 'bestIs', label: 'Best item is', expectsValue: true, valueInputType: 'select', valueSource: 'question_options' },
        { value: 'worstIs', label: 'Worst item is', expectsValue: true, valueInputType: 'select', valueSource: 'question_options' },
        ...COMMON_OPERATORS
    ],
    'conjoint': [ // Updated
        ...CONJOINT_OPERATORS,
        ...COMMON_OPERATORS // e.g., "is answered" (meaning any task has a choice) / "is not answered"
    ],
    'cardsort': [ 
        { value: 'cardInCategory', label: 'card... is in category...', expectsValue: true, valueInputType: 'cardsort_card_then_category_select', valueSource: 'question_cards_and_categories'},
        { value: 'categoryHasCards', label: 'category... has cards', expectsValue: true, valueInputType: 'select', valueSource: 'question_cardsort_categories_all' },
        { value: 'categoryIsEmpty', label: 'category... has no cards', expectsValue: true, valueInputType: 'select', valueSource: 'question_cardsort_categories_all'},
        ...COMMON_OPERATORS
    ],
    'default': [ ...EQUALITY_OPERATORS_FOR_TEXT, ...STRING_CONTAINS_OPERATORS, ...COMMON_OPERATORS ]
};

export const LOGICAL_OPERATORS = [ { value: 'AND', label: 'AND' }, { value: 'OR', label: 'OR' } ];
export const ACTION_TYPES = [ { value: 'skipToQuestion', label: 'Skip to question' }, { value: 'hideQuestion', label: 'Hide question' }, { value: 'jumpToEndOfSurvey', label: 'Jump to end of survey' }, { value: 'disqualifyRespondent', label: 'Disqualify respondent' }, ];

export function getOperatorsForQuestionType(questionType, questionSettings = {}) {
    let specificOperators = OPERATORS_BY_QUESTION_TYPE[questionType] || OPERATORS_BY_QUESTION_TYPE['default'];
    
    // Filter out OTHER_TEXT_OPERATORS if the question doesn't have an "other" option
    if (!questionSettings.addOtherOption) {
        specificOperators = specificOperators.filter(op => !op.appliesToOtherText);
    }
    // Potentially filter conjoint operators if not applicable based on settings (though usually all apply if it's conjoint)

    return specificOperators;
}

export function getConditionValueInputDetails(question, operatorValue) {
    if (!question || !operatorValue) return { type: 'none' };

    const questionType = question.type;
    // Pass question settings to getOperatorsForQuestionType for filtering
    const operators = getOperatorsForQuestionType(questionType, { addOtherOption: question.addOtherOption });
    const operator = operators.find(op => op.value === operatorValue);

    if (!operator || !operator.expectsValue) {
        return { type: 'none' };
    }

    let details = {
        type: operator.valueInputType || 'text',
        valueSource: operator.valueSource,
        question: question, // Pass the full question object for context
        operator: operator // Pass the operator object for context
    };

    switch (details.type) {
        case 'number':
            if (questionType === 'slider') { details.min = question.sliderMin ?? 0; details.max = question.sliderMax ?? 100; details.step = question.sliderStep ?? 1; }
            else if (questionType === 'rating') { details.min = 1; details.max = question.ratingMax || 5; details.step = 1; }
            else if (questionType === 'nps') { details.min = 0; details.max = 10; details.step = 1; }
            else if (questionType === 'heatmap' && operatorValue.startsWith('clickCount')) { details.min = 0; details.step = 1; }
            break;
        case 'select':
            if (details.valueSource === 'question_options') {
                details.options = question.options ? question.options.map(opt => typeof opt === 'string' ? { label: opt, value: opt } : ({ label: opt.label || opt.text || opt.value, value: opt.value || opt.text || opt })) : [];
                // Only add __OTHER__ if the question actually has an "other" option enabled
                if (question.addOtherOption) { details.options.push({ label: '(Other Option)', value: '__OTHER__' }); }
                if (question.addNAOption) { details.options.push({ label: '(N/A Option)', value: '__NA__' }); } // Assuming __NA__ is your internal NA value
            } else if (details.valueSource === 'question_matrix_rows') {
                details.options = question.matrixRows ? question.matrixRows.map(row => ({ label: row, value: row })) : [];
            } else if (details.valueSource === 'question_matrix_columns') {
                 details.options = question.matrixColumns ? question.matrixColumns.map(col => ({ label: col, value: col })) : [];
            } else if (details.valueSource === 'question_cardsort_categories_all') {
                // For CardSort, categories can be predefined or user-created.
                // LogicConditionEditor will need to get all available categories at the time of rendering.
                // For now, this focuses on predefined ones.
                const predefined = question.cardSortCategories ? question.cardSortCategories.map(c => ({label: `Predefined: ${c}`, value: c})) : [];
                // If you store user-defined categories on the question object after they are created, they could be added here too.
                // For now, we'll assume LogicConditionEditor handles merging/displaying all relevant categories.
                details.options = predefined;
            }
            break;
        
        case 'heatmapDefinedAreaSelect':
            if (details.valueSource === 'question_defined_heatmap_areas') {
                details.options = Array.isArray(question.definedHeatmapAreas)
                    ? question.definedHeatmapAreas.map(area => ({ label: area.name, value: area.id }))
                    : [];
            } else {
                details.options = [];
            }
            break;
        
        // --- Cases for new Conjoint input types ---
        case 'select_conjoint_task': // For 'choiceForTaskIsNone'
            if (details.valueSource === 'question_conjoint_tasks' && question.conjointNumTasks > 0) {
                details.options = Array.from({ length: question.conjointNumTasks }, (_, i) => ({
                    label: `Task ${i + 1}`,
                    value: `task_${i}` // Matches task IDs from ConjointQuestion.js
                }));
            } else {
                details.options = [];
            }
            break;
        
        case 'select_conjoint_task_attr_level': // For 'choiceForTaskAttributeIsLevel'
            // This is more complex as it depends on prior selections (task, then attribute)
            // LogicConditionEditor will handle the cascading dropdowns.
            // Here, we just signify the type.
            // The actual options for attributes and levels will be derived dynamically in LogicConditionEditor.
            // We can provide the tasks list here as a starting point.
            if (question.conjointNumTasks > 0) {
                 details.tasks = Array.from({ length: question.conjointNumTasks }, (_, i) => ({
                    label: `Task ${i + 1}`,
                    value: `task_${i}`
                }));
            } else {
                details.tasks = [];
            }
            details.attributes = question.conjointAttributes || []; // Pass all attributes
            // Levels will depend on the selected attribute in the UI.
            break;

        case 'matrix_row_then_col_select': break;
        case 'ranking_rank_then_item_select': break;
        case 'cardsort_card_then_category_select': break;
        default: break;
    }
    return details;
}
// ----- END OF MODIFIED FILE (v1.3 - Conjoint and Other Text Operators) -----