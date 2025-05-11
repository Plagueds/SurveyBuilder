// frontend/src/components/QuestionEditPanel.js
// ----- START OF COMPLETE UPDATED FILE (v11.2 - Refined Piping Sources & ALL FUNCTIONS INCLUDED) -----
import React, { useState, useEffect, useCallback } from 'react';
import styles from './QuestionEditPanel.module.css';

// Helper functions
const getQuestionTypeLabel = (typeValue) => { const typeMap = { 'text': 'Single-Line Text', 'textarea': 'Multi-Line Text', 'multiple-choice': 'Multiple Choice', 'checkbox': 'Checkbox', 'dropdown': 'Dropdown', 'rating': 'Rating (1-5)', 'nps': 'NPS (0-10)', 'matrix': 'Matrix / Grid', 'slider': 'Slider', 'ranking': 'Ranking Order', 'heatmap': 'Image Heatmap', 'maxdiff': 'MaxDiff (Best/Worst)', 'conjoint': 'Conjoint Task', 'cardsort': 'Card Sorting Task', }; return typeMap[typeValue] || typeValue; };
const ensureArray = (value) => (Array.isArray(value) ? value : (value === undefined || value === null ? [] : [value]));
const truncateText = (text, maxLength = 30) => { if (!text) return ''; if (text.length <= maxLength) return text; return text.substring(0, maxLength) + '...'; };
const findQuestionTextById = (id, questions) => { const question = questions.find(q => q._id === id); return question ? truncateText(question.text, 40) : `(ID: ${id})`; };

// Question Type Constants
const SPECIAL_OPTION_TYPES_WITH_NA_OTHER = ['multiple-choice', 'checkbox'];
const HIDE_AFTER_ANSWERING_TYPES = ['multiple-choice'];
const PIPING_REPEAT_SOURCE_TYPES = ['multiple-choice', 'checkbox', 'dropdown'];
const PIPING_TARGET_TYPES = ['multiple-choice', 'checkbox', 'dropdown', 'ranking'];
const CARD_SORT_TYPE = 'cardsort';
const OPTION_BASED_TYPES = ['multiple-choice', 'checkbox', 'dropdown', 'ranking', 'maxdiff', 'cardsort'];
const RANDOMIZATION_SUPPORTING_TYPES = ['multiple-choice', 'checkbox'];
const TEXT_INPUT_TYPES = ['text', 'textarea'];


function QuestionEditPanel({
    questionData, mode, onSave, onCancel, isSaving,
    allQuestions = [],
    questionIndex = -1
}) {
    console.log("[QEP v11.2] Rendering. Mode:", mode, "Q Index:", questionIndex);
    const [activeTab, setActiveTab] = useState('content');

    const getInitialState = useCallback(() => {
        const currentType = questionData?.type || 'text';
        let initialOptions = ensureArray(questionData?.options);
        if (initialOptions.length === 0 && ['multiple-choice', 'checkbox', 'dropdown', 'ranking', 'maxdiff'].includes(currentType)) { initialOptions = ['', '']; }
        else if (initialOptions.length === 0 && currentType === CARD_SORT_TYPE) { initialOptions = ['']; }
        const allowNAOther = SPECIAL_OPTION_TYPES_WITH_NA_OTHER.includes(currentType);
        const allowRandomize = RANDOMIZATION_SUPPORTING_TYPES.includes(currentType);
        const allowHideAfter = HIDE_AFTER_ANSWERING_TYPES.includes(currentType);
        const allowTextOptions = TEXT_INPUT_TYPES.includes(currentType);
        const initialMinRequired = (questionData?.minAnswersRequired === null || questionData?.minAnswersRequired === undefined) ? '' : String(questionData.minAnswersRequired);
        const initialMaxLimit = (questionData?.limitAnswersMax === null || questionData?.limitAnswersMax === undefined) ? '' : String(questionData.limitAnswersMax);
        const initialEnforceMax = !!(questionData?.limitAnswers === true && initialMaxLimit !== '' && !isNaN(Number(initialMaxLimit)) && Number(initialMaxLimit) > 0 );

        return {
            _id: questionData?._id || null,
            survey: questionData?.survey || '',
            text: questionData?.text || '',
            type: currentType,
            options: initialOptions,
            rows: currentType === 'textarea' ? (questionData?.rows || 4) : 4,
            addOtherOption: allowNAOther ? (questionData?.addOtherOption || false) : false,
            requireOtherIfSelected: allowNAOther ? (questionData?.requireOtherIfSelected || false) : false,
            addNAOption: allowNAOther ? (questionData?.addNAOption || false) : false,
            matrixRows: ensureArray(questionData?.matrixRows).length > 0 ? ensureArray(questionData.matrixRows) : [''],
            matrixColumns: ensureArray(questionData?.matrixColumns).length > 0 ? ensureArray(questionData.matrixColumns) : [''],
            matrixType: questionData?.matrixType || 'radio',
            sliderMin: questionData?.sliderMin ?? 0,
            sliderMax: questionData?.sliderMax ?? 100,
            sliderStep: questionData?.sliderStep ?? 1,
            sliderMinLabel: questionData?.sliderMinLabel || '',
            sliderMaxLabel: questionData?.sliderMaxLabel || '',
            imageUrl: questionData?.imageUrl || '',
            heatmapMaxClicks: questionData?.heatmapMaxClicks ?? '',
            maxDiffItemsPerSet: questionData?.maxDiffItemsPerSet || 4,
            conjointAttributes: ensureArray(questionData?.conjointAttributes).map(attr => ({ name: attr?.name || '', levels: ensureArray(attr?.levels) })),
            conjointProfilesPerTask: questionData?.conjointProfilesPerTask || 3,
            cardSortCategories: ensureArray(questionData?.cardSortCategories),
            cardSortAllowUserCategories: questionData?.cardSortAllowUserCategories ?? true,
            hideByDefault: questionData?.hideByDefault || false,
            showOnlyToAdmin: questionData?.showOnlyToAdmin || false,
            isDisabled: typeof questionData?.isDisabled === 'boolean' ? questionData.isDisabled : false,
            randomizationAlwaysInclude: questionData?.randomizationAlwaysInclude || false,
            randomizationPinPosition: questionData?.randomizationPinPosition || false,
            hideAfterAnswering: allowHideAfter ? (questionData?.hideAfterAnswering || false) : false,
            randomizeOptions: allowRandomize ? (questionData?.randomizeOptions || false) : false,
            pipeOptionsFromQuestionId: questionData?.pipeOptionsFromQuestionId || '',
            repeatForEachOptionFromQuestionId: questionData?.repeatForEachOptionFromQuestionId || '',
            requiredSetting: questionData?.requiredSetting || 'not_required',
            answerFormatCapitalization: allowTextOptions ? (questionData?.answerFormatCapitalization || false) : false,
            limitAnswers: initialEnforceMax,
            limitAnswersMax: initialMaxLimit,
            minAnswersRequired: initialMinRequired,
            textValidation: allowTextOptions ? (questionData?.textValidation || 'none') : 'none',
        };
    }, [questionData]);

    const [questionState, setQuestionState] = useState(getInitialState);
    const [errors, setErrors] = useState({});
    const [editingAttributeIndex, setEditingAttributeIndex] = useState(null);
    const [currentAttributeName, setCurrentAttributeName] = useState('');
    const [currentAttributeLevels, setCurrentAttributeLevels] = useState('');

     useEffect(() => {
        setQuestionState(getInitialState());
        setErrors({});
        setEditingAttributeIndex(null);
        setCurrentAttributeName('');
        setCurrentAttributeLevels('');
        setActiveTab('content');
    }, [questionData, mode, getInitialState]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        const isCheckbox = type === 'checkbox';
        let val;

        if (name === 'isDisabled') { // Handle radio button for boolean
            val = value === 'true';
        } else {
            val = isCheckbox ? checked : value;
        }

        if (name === 'type') {
            const newType = value;
            setQuestionState(prevState => {
                let newState = { ...prevState, type: newType };

                // Reset checkbox specific limits if type changes from checkbox
                if (newType !== 'checkbox') {
                    newState.limitAnswers = false;
                    newState.limitAnswersMax = '';
                    newState.minAnswersRequired = '';
                }

                const wasOptionBased = OPTION_BASED_TYPES.includes(prevState.type);
                const isOptionBased = OPTION_BASED_TYPES.includes(newType);
                const wasCardSort = prevState.type === CARD_SORT_TYPE;
                const isCardSort = newType === CARD_SORT_TYPE;

                if (isOptionBased && !wasOptionBased) {
                    newState.options = ['', '']; // Default two options
                } else if (isCardSort && !wasCardSort) {
                    newState.options = ['']; // Default one card for card sort
                    newState.cardSortCategories = [];
                    newState.cardSortAllowUserCategories = true;
                } else if (!isOptionBased && !isCardSort && (wasOptionBased || wasCardSort)) {
                    newState.options = []; // Clear options if no longer option-based
                }

                if (!isCardSort && wasCardSort) { // Clear card sort specific fields
                    newState.cardSortCategories = [];
                    newState.cardSortAllowUserCategories = true;
                }

                if (newType !== 'matrix' && prevState.type === 'matrix') {
                    newState.matrixRows = ['']; newState.matrixColumns = [''];
                } else if (newType === 'matrix' && prevState.type !== 'matrix') {
                    newState.matrixRows = ['']; newState.matrixColumns = [''];
                }
                if (newType !== 'conjoint' && prevState.type === 'conjoint') {
                    newState.conjointAttributes = [];
                }
                if (!SPECIAL_OPTION_TYPES_WITH_NA_OTHER.includes(newType)) {
                    newState.addOtherOption = false;
                    newState.requireOtherIfSelected = false;
                    newState.addNAOption = false;
                }
                if (!HIDE_AFTER_ANSWERING_TYPES.includes(newType)) {
                    newState.hideAfterAnswering = false;
                }
                if (!TEXT_INPUT_TYPES.includes(newType)) {
                    newState.answerFormatCapitalization = false;
                    newState.textValidation = 'none';
                }
                if (!PIPING_TARGET_TYPES.includes(newType)) {
                    newState.pipeOptionsFromQuestionId = ''; // Clear if type doesn't support it
                }
                if (newType !== 'heatmap') {
                    newState.heatmapMaxClicks = '';
                }
                if (!RANDOMIZATION_SUPPORTING_TYPES.includes(newType)) {
                    newState.randomizeOptions = false;
                }
                if (newType !== 'textarea') {
                    newState.rows = 4; // Reset rows if not textarea
                }
                return newState;
            });
            setErrors(prev => ({ ...prev, answerRequirements: null })); // Clear specific errors on type change
        } else {
            setQuestionState(prevState => {
                let newState = { ...prevState, [name]: val };
                if (name === 'addOtherOption' && !val) {
                    newState.requireOtherIfSelected = false;
                }
                if (name === 'requireOtherIfSelected' && val) {
                    newState.addOtherOption = true; // Auto-check "Add Other" if "Require Text" is checked
                }
                if (name === 'limitAnswers') { // This is the checkbox for "Enforce Max Limit"
                    newState.limitAnswers = val;
                    if (!val) { // If unchecked, clear the max limit value
                        // newState.limitAnswersMax = ''; // Optionally clear, or let user manage
                    }
                }
                return newState;
            });
        }

        // Clear specific errors when related fields change
        if (errors[name]) {
            setErrors(prevErrors => ({ ...prevErrors, [name]: null }));
        }
        if (['limitAnswersMax', 'minAnswersRequired', 'limitAnswers'].includes(name)) {
            setErrors(prev => ({...prev, answerRequirements: null}));
        }
        if (['pipeOptionsFromQuestionId', 'repeatForEachOptionFromQuestionId'].includes(name)) {
            setErrors(prev => ({ ...prev, [name]: null }));
        }
        if (name === 'heatmapMaxClicks') {
            setErrors(prev => ({ ...prev, heatmapMaxClicks: null }));
        }
        if (name === 'matrixRows' || name === 'matrixColumns') setErrors(prev => ({ ...prev, matrixRows: null, matrixColumns: null }));
        if (name === 'options' && questionState.type === CARD_SORT_TYPE) setErrors(prev => ({ ...prev, cardsToSort: null }));
        if (name === 'cardSortCategories') setErrors(prev => ({ ...prev, cardSortCategories: null }));
        if (name === 'options') { // General options error
            setErrors(prev => ({ ...prev, options: null, cardsToSort: null })); // Clear for both
        }
        if (name === 'randomizeOptions') {
            setErrors(prev => ({ ...prev, randomizeOptions: null }));
        }
        if (name === 'textValidation') {
            setErrors(prev => ({ ...prev, textValidation: null }));
        }
        if (['sliderMin', 'sliderMax', 'sliderStep'].includes(name)) setErrors(prev => ({ ...prev, slider: null }));
        if (name === 'imageUrl') setErrors(prev => ({ ...prev, imageUrl: null }));
        if (name === 'conjointAttributes') setErrors(prev => ({ ...prev, conjointAttributes: null }));
        if (name === 'rows') setErrors(prev => ({ ...prev, rows: null }));
    };

    const handleNumberChange = (e) => {
        const { name, value } = e.target;
        setQuestionState(prevState => {
            let updatedState = { ...prevState, [name]: value };
            // If limitAnswersMax is cleared or invalid, uncheck "Enforce Max Limit"
            if (name === 'limitAnswersMax') {
                const maxNum = Number(value);
                if (value === '' || isNaN(maxNum) || maxNum < 1) {
                    updatedState.limitAnswers = false;
                } else {
                    // Only auto-check if it was already checked or if user explicitly checks it
                    // updatedState.limitAnswers = true; // Avoid auto-checking here, let handleChange for 'limitAnswers' handle it
                }
            }
            return updatedState;
        });
        if (errors[name] || errors.slider || errors.rows || errors.answerRequirements) { // Clear related errors
            setErrors(prevErrors => ({ ...prevErrors, [name]: null, slider: null, rows: null, answerRequirements: null }));
        }
    };

    const handleListItemChange = (fieldName, index, value) => {
        setQuestionState(prevState => {
            const newList = [...ensureArray(prevState[fieldName])];
            newList[index] = value;
            return { ...prevState, [fieldName]: newList };
        });
        if (fieldName === 'options') setErrors(prev => ({ ...prev, options: null, cardsToSort: null }));
        if (fieldName === 'matrixRows') setErrors(prev => ({ ...prev, matrixRows: null }));
        if (fieldName === 'matrixColumns') setErrors(prev => ({ ...prev, matrixColumns: null }));
        if (fieldName === 'cardSortCategories') setErrors(prev => ({ ...prev, cardSortCategories: null }));
    };

    const addListItem = (fieldName) => {
        setQuestionState(prevState => ({
            ...prevState,
            [fieldName]: [...ensureArray(prevState[fieldName]), '']
        }));
    };

    const removeListItem = (fieldName, index) => {
        setQuestionState(prevState => {
            const newList = ensureArray(prevState[fieldName]).filter((_, i) => i !== index);
            // Ensure minimum number of options for certain types
            if (fieldName === 'options' && OPTION_BASED_TYPES.includes(prevState.type)) {
                const minOptions = ['multiple-choice', 'dropdown', 'ranking', 'maxdiff'].includes(prevState.type) ? 2 : 1;
                while (newList.length < minOptions) {
                    newList.push(''); // Add empty strings to meet minimum
                }
            } else if (fieldName === 'matrixRows' || fieldName === 'matrixColumns') {
                if (newList.length === 0) newList.push(''); // Ensure at least one row/column input
            }
            return { ...prevState, [fieldName]: newList };
        });
        if (fieldName === 'options') setErrors(prev => ({ ...prev, options: null, cardsToSort: null }));
        if (fieldName === 'matrixRows') setErrors(prev => ({ ...prev, matrixRows: null }));
        if (fieldName === 'matrixColumns') setErrors(prev => ({ ...prev, matrixColumns: null }));
        if (fieldName === 'cardSortCategories') setErrors(prev => ({ ...prev, cardSortCategories: null }));
    };

    const handleAddNewAttribute = () => {
        setEditingAttributeIndex(-1); // -1 indicates new attribute
        setCurrentAttributeName('');
        setCurrentAttributeLevels('');
    };

    const handleEditAttribute = (index) => {
        const attr = questionState.conjointAttributes[index];
        setEditingAttributeIndex(index);
        setCurrentAttributeName(attr.name);
        setCurrentAttributeLevels(ensureArray(attr.levels).join('\n'));
    };

    const handleSaveAttribute = () => {
        if (!currentAttributeName.trim()) { alert('Attribute name cannot be empty.'); return; }
        const levels = currentAttributeLevels.split('\n').map(l => l.trim()).filter(l => l);
        if (levels.length < 2) { alert('Attribute must have at least two non-empty levels (one per line).'); return; }

        const newAttribute = { name: currentAttributeName.trim(), levels };
        setQuestionState(prevState => {
            const updatedAttributes = [...ensureArray(prevState.conjointAttributes)];
            if (editingAttributeIndex === -1) { // Adding new
                updatedAttributes.push(newAttribute);
            } else { // Editing existing
                updatedAttributes[editingAttributeIndex] = newAttribute;
            }
            return { ...prevState, conjointAttributes: updatedAttributes };
        });
        handleCancelEditAttribute(); // Close modal
        setErrors(prev => ({ ...prev, conjointAttributes: null }));
    };

    const handleRemoveAttribute = (index) => {
        if (!window.confirm("Are you sure you want to remove this attribute?")) return;
        setQuestionState(prevState => ({
            ...prevState,
            conjointAttributes: ensureArray(prevState.conjointAttributes).filter((_, i) => i !== index)
        }));
        setErrors(prev => ({ ...prev, conjointAttributes: null }));
    };

    const handleCancelEditAttribute = () => {
        setEditingAttributeIndex(null);
        setCurrentAttributeName('');
        setCurrentAttributeLevels('');
    };

    const validate = useCallback((stateToValidate = questionState) => {
        const newErrors = {};
        const safeAllQuestions = Array.isArray(allQuestions) ? allQuestions : [];
        // Determine the actual index of the question being edited, or effective index for a new question
        const currentQActualIndex = mode === 'edit' && stateToValidate._id
            ? safeAllQuestions.findIndex(q => q._id === stateToValidate._id)
            : (mode === 'add' ? safeAllQuestions.length : -1); // New question is effectively at the end

        const currentType = stateToValidate.type;

        if (!stateToValidate.text?.trim()) {
            newErrors.text = 'Question text is required.';
        }

        const validOptions = ensureArray(stateToValidate.options).filter(opt => opt?.trim() !== '');
        const validMatrixRows = ensureArray(stateToValidate.matrixRows).filter(r => r?.trim() !== '');
        const validMatrixColumns = ensureArray(stateToValidate.matrixColumns).filter(c => c?.trim() !== '');
        const validCards = ensureArray(stateToValidate.options).filter(card => card?.trim() !== ''); // For card sort
        const validCategories = ensureArray(stateToValidate.cardSortCategories).filter(cat => cat?.trim() !== '');

        if (OPTION_BASED_TYPES.includes(currentType)) {
            const minOptions = ['multiple-choice', 'dropdown', 'ranking', 'maxdiff'].includes(currentType) ? 2 : 1;
            if (validOptions.length < minOptions) {
                newErrors.options = `At least ${minOptions} non-empty option(s) are required for ${getQuestionTypeLabel(currentType)}.`;
            } else { // Check for duplicates only if min options are met
                const uniqueOptions = new Set(validOptions);
                if (uniqueOptions.size !== validOptions.length) {
                    newErrors.options = `Options must be unique.`;
                }
            }
        } else if (currentType === CARD_SORT_TYPE) {
            if (validCards.length < 1) {
                newErrors.cardsToSort = 'At least one card item is required.';
            } else {
                const uniqueCards = new Set(validCards);
                if (uniqueCards.size !== validCards.length) {
                    newErrors.cardsToSort = 'Card items must be unique.';
                }
            }
            if (!stateToValidate.cardSortAllowUserCategories && validCategories.length < 1) {
                newErrors.cardSortCategories = 'At least one predefined category is required if users cannot create their own.';
            } else if (validCategories.length > 0) {
                const uniqueCategories = new Set(validCategories);
                if (uniqueCategories.size !== validCategories.length) {
                    newErrors.cardSortCategories = 'Predefined categories must be unique.';
                }
            }
        } else if (currentType === 'matrix') {
            if (validMatrixRows.length < 1) newErrors.matrixRows = 'At least one non-empty matrix row is required.';
            else { const uniqueRows = new Set(validMatrixRows); if (uniqueRows.size !== validMatrixRows.length) newErrors.matrixRows = 'Matrix rows must be unique.'; }
            if (validMatrixColumns.length < 1) newErrors.matrixColumns = 'At least one non-empty matrix column is required.';
            else { const uniqueCols = new Set(validMatrixColumns); if (uniqueCols.size !== validMatrixColumns.length) newErrors.matrixColumns = 'Matrix columns must be unique.'; }
        } else if (currentType === 'heatmap') {
            if (!stateToValidate.imageUrl?.trim()) newErrors.imageUrl = 'Image URL is required.';
            else { try { new URL(stateToValidate.imageUrl); } catch (_) { newErrors.imageUrl = 'Invalid Image URL format.'; } }
            if (stateToValidate.heatmapMaxClicks !== '' && (isNaN(Number(stateToValidate.heatmapMaxClicks)) || Number(stateToValidate.heatmapMaxClicks) < 0)) {
                newErrors.heatmapMaxClicks = 'Max clicks must be a non-negative number (or blank).';
            }
        } else if (currentType === 'slider') {
            const min = parseFloat(stateToValidate.sliderMin);
            const max = parseFloat(stateToValidate.sliderMax);
            const step = parseFloat(stateToValidate.sliderStep);
            if (isNaN(min) || isNaN(max) || isNaN(step)) newErrors.slider = 'Min, Max, and Step must be valid numbers.';
            else if (min >= max) newErrors.slider = 'Min must be less than Max.';
            else if (step <= 0) newErrors.slider = 'Step must be positive.';
            else if ((max - min) / step > 500) newErrors.slider = 'Combination creates too many steps (>500). Consider increasing step or reducing range.';
        } else if (currentType === 'maxdiff') {
            if (validOptions.length < (stateToValidate.maxDiffItemsPerSet || 4)) {
                newErrors.options = `Number of options (${validOptions.length}) must be >= items per set (${stateToValidate.maxDiffItemsPerSet || 4}).`;
            }
        } else if (currentType === 'conjoint') {
            const validAttributes = ensureArray(stateToValidate.conjointAttributes).filter(attr => attr.name?.trim() && ensureArray(attr.levels).filter(l => l?.trim()).length >= 2);
            if (validAttributes.length < 1) {
                newErrors.conjointAttributes = 'At least one valid attribute (name + >= 2 levels) is required.';
            }
        } else if (currentType === 'textarea') {
            const rowsNum = Number(stateToValidate.rows);
            if (isNaN(rowsNum) || !Number.isInteger(rowsNum) || rowsNum < 1) {
                newErrors.rows = 'Number of rows must be a positive whole number.';
            }
        }

        if (currentType === 'checkbox') {
            const minAnswersInput = stateToValidate.minAnswersRequired;
            const maxAnswersInput = stateToValidate.limitAnswersMax;
            const enforceMaxChecked = stateToValidate.limitAnswers === true; // This is the "Enforce Max Limit" checkbox state

            const minAnswers = (minAnswersInput !== '' && !isNaN(Number(minAnswersInput))) ? Number(minAnswersInput) : null;
            const maxAnswers = (maxAnswersInput !== '' && !isNaN(Number(maxAnswersInput))) ? Number(maxAnswersInput) : null;

            if (minAnswers !== null && (minAnswers < 0 || !Number.isInteger(minAnswers))) {
                newErrors.answerRequirements = 'Min answers must be a non-negative whole number.';
            }
            if (enforceMaxChecked) { // Only validate maxAnswers if the "Enforce Max Limit" checkbox is checked
                if (maxAnswers === null || maxAnswers < 1 || !Number.isInteger(maxAnswers)) {
                    newErrors.answerRequirements = 'Max answers must be a whole number > 0 when "Enforce Max Limit" is checked.';
                } else if (minAnswers !== null && minAnswers > 0 && maxAnswers < minAnswers) {
                    newErrors.answerRequirements = 'Max answers cannot be less than Min answers (if Min > 0 and Max is enforced).';
                } else if (maxAnswers > validOptions.length) {
                    newErrors.answerRequirements = `Max answers (${maxAnswers}) cannot exceed the number of options (${validOptions.length}).`;
                }
            }
            if (minAnswers !== null && minAnswers > 0 && minAnswers > validOptions.length) {
                newErrors.answerRequirements = `Min answers (${minAnswers}) cannot exceed the number of options (${validOptions.length}).`;
            }
            // This condition might be redundant if the above are correct, but good to double check
            if (enforceMaxChecked && minAnswers !== null && minAnswers > 0 && maxAnswers !== null && maxAnswers >=1 && minAnswers > maxAnswers) {
                 newErrors.answerRequirements = 'Min answers cannot be greater than Max answers.';
            }
        }

        // Piping/Repeating validation
        const previousQuestions = currentQActualIndex > 0 ? safeAllQuestions.slice(0, currentQActualIndex) : [];
        const previousQuestionIdsSet = new Set(previousQuestions.map(q => q._id));
        const validSourceIdsSet = new Set(previousQuestions.filter(q => PIPING_REPEAT_SOURCE_TYPES.includes(q.type)).map(q => q._id));

        if (stateToValidate.pipeOptionsFromQuestionId || stateToValidate.repeatForEachOptionFromQuestionId) {
            if (stateToValidate.pipeOptionsFromQuestionId && !previousQuestionIdsSet.has(stateToValidate.pipeOptionsFromQuestionId)) {
                newErrors.pipeOptionsFromQuestionId = 'Piping source question invalid or after current.';
            } else if (stateToValidate.pipeOptionsFromQuestionId && !validSourceIdsSet.has(stateToValidate.pipeOptionsFromQuestionId)) {
                newErrors.pipeOptionsFromQuestionId = 'Piping source question type incompatible.';
            }
            if (stateToValidate.repeatForEachOptionFromQuestionId && !previousQuestionIdsSet.has(stateToValidate.repeatForEachOptionFromQuestionId)) {
                newErrors.repeatForEachOptionFromQuestionId = 'Repeating source question invalid or after current.';
            } else if (stateToValidate.repeatForEachOptionFromQuestionId && !validSourceIdsSet.has(stateToValidate.repeatForEachOptionFromQuestionId)) {
                newErrors.repeatForEachOptionFromQuestionId = 'Repeating source question type incompatible.';
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [allQuestions, questionState, mode]); // Added mode to validate dependencies

    const handleSave = (e) => {
        e.preventDefault();
        if (editingAttributeIndex !== null) { // Ensure conjoint attribute editing is finished
            alert("Please save or cancel the current Conjoint attribute before saving the question.");
            return;
        }

        // Create a mutable copy for cleanup before validation and saving
        let stateToSave = { ...questionState };

        // Filter out empty strings from lists
        const fieldsToFilter = ['options', 'matrixRows', 'matrixColumns', 'cardSortCategories'];
        fieldsToFilter.forEach(field => {
            if (stateToSave[field]) {
                stateToSave[field] = ensureArray(stateToSave[field]).filter(item => item?.trim() !== '');
            }
        });

        // Clean conjoint attributes
        if (stateToSave.conjointAttributes) {
            stateToSave.conjointAttributes = ensureArray(stateToSave.conjointAttributes)
                .map(attr => ({
                    name: attr.name,
                    levels: ensureArray(attr.levels).filter(l => l?.trim() !== '')
                }))
                .filter(attr => attr.name?.trim() && attr.levels.length >= 2);
        }

        // Reset fields not applicable to the current type
        if (!HIDE_AFTER_ANSWERING_TYPES.includes(stateToSave.type)) stateToSave.hideAfterAnswering = false;
        if (!TEXT_INPUT_TYPES.includes(stateToSave.type)) {
            stateToSave.answerFormatCapitalization = false;
            stateToSave.textValidation = 'none';
        }
        if (!PIPING_TARGET_TYPES.includes(stateToSave.type)) stateToSave.pipeOptionsFromQuestionId = null;
        else stateToSave.pipeOptionsFromQuestionId = stateToSave.pipeOptionsFromQuestionId || null; // Ensure null if empty

        stateToSave.repeatForEachOptionFromQuestionId = stateToSave.repeatForEachOptionFromQuestionId || null; // Ensure null if empty

        if (stateToSave.type !== 'heatmap') stateToSave.heatmapMaxClicks = null;
        else {
            const maxClicksNum = stateToSave.heatmapMaxClicks !== '' ? Number(stateToSave.heatmapMaxClicks) : null;
            stateToSave.heatmapMaxClicks = (maxClicksNum !== null && maxClicksNum >= 0) ? maxClicksNum : null;
        }

        if (stateToSave.type !== CARD_SORT_TYPE) {
            delete stateToSave.cardSortCategories;
            delete stateToSave.cardSortAllowUserCategories;
        }
        if (!RANDOMIZATION_SUPPORTING_TYPES.includes(stateToSave.type)) stateToSave.randomizeOptions = false;
        if (stateToSave.type !== 'textarea') delete stateToSave.rows;


        // Handle checkbox answer limits specifically for saving
        if (stateToSave.type === 'checkbox') {
            const minInputString = String(stateToSave.minAnswersRequired).trim();
            const maxInputString = String(stateToSave.limitAnswersMax).trim();
            const enforceMaxIsCheckedInUI = stateToSave.limitAnswers === true; // This is the checkbox state

            let minToSave = null;
            if (minInputString !== '' && !isNaN(Number(minInputString))) {
                const minNum = Number(minInputString);
                if (minNum >= 0 && Number.isInteger(minNum)) { // Must be non-negative whole number
                    minToSave = minNum;
                }
            }
            stateToSave.minAnswersRequired = minToSave; // Save as number or null

            let maxToSave = null;
            let limitAnswersBooleanToSave = false; // This is the boolean for the backend
            if (maxInputString !== '' && !isNaN(Number(maxInputString))) {
                const maxNum = Number(maxInputString);
                if (maxNum >= 1 && Number.isInteger(maxNum)) { // Must be whole number > 0
                    if (enforceMaxIsCheckedInUI) { // Only save max if "Enforce" is checked
                        maxToSave = maxNum;
                        limitAnswersBooleanToSave = true;
                    }
                }
            }
            stateToSave.limitAnswersMax = maxToSave; // Save as number or null
            stateToSave.limitAnswers = limitAnswersBooleanToSave; // Save the boolean
        } else { // For non-checkbox types, these fields should be null/false
            stateToSave.limitAnswers = false;
            stateToSave.limitAnswersMax = null;
            stateToSave.minAnswersRequired = null;
        }


        console.log("[QEP v11.2 handleSave] State prepared for validation (after cleanup):", JSON.stringify(stateToSave, null, 2));

        if (validate(stateToSave)) {
            console.log("[QEP v11.2 handleSave] Validation passed. Preparing payload.");
            let payload = { ...stateToSave };

            // Don't send survey ID if editing (backend might not expect/want it on update)
            if (mode === 'edit') delete payload.survey;

            // Ensure numeric types are numbers
            if (payload.type === 'slider') {
                payload.sliderMin = Number(payload.sliderMin);
                payload.sliderMax = Number(payload.sliderMax);
                payload.sliderStep = Number(payload.sliderStep);
            }
            if (payload.type === 'maxdiff') payload.maxDiffItemsPerSet = Number(payload.maxDiffItemsPerSet);
            if (payload.type === 'conjoint') payload.conjointProfilesPerTask = Number(payload.conjointProfilesPerTask);
            if (payload.type === 'textarea') payload.rows = Number(payload.rows);

            // Remove fields if they are null to avoid sending them if backend expects absence
            if (payload.minAnswersRequired === null) delete payload.minAnswersRequired;
            if (payload.limitAnswersMax === null) delete payload.limitAnswersMax;
            if (payload.limitAnswers === false) delete payload.limitAnswers; // Only send if true
            if (payload.heatmapMaxClicks === null) delete payload.heatmapMaxClicks;
            if (payload.pipeOptionsFromQuestionId === null || payload.pipeOptionsFromQuestionId === '') delete payload.pipeOptionsFromQuestionId;
            if (payload.repeatForEachOptionFromQuestionId === null || payload.repeatForEachOptionFromQuestionId === '') delete payload.repeatForEachOptionFromQuestionId;


            console.log("[QEP v11.2 handleSave] Final payload for onSave:", JSON.stringify(payload, null, 2));
            onSave(payload);
        } else {
            console.log("[QEP v11.2 handleSave] Validation failed. Current errors:", errors);
            // Focus on the first invalid field and switch tab if necessary
            const currentErrors = errors; // Use the errors state which should have been updated by validate()
            const firstErrorKey = Object.keys(currentErrors)[0];

            // Determine which input to focus based on error key, prioritizing more specific ones
            const errorKeyToFocus = currentErrors.answerRequirements ? 'minAnswersRequired' : firstErrorKey;

            if (errorKeyToFocus) {
                let firstInvalidElement = document.querySelector(`[name="${errorKeyToFocus}"], #${errorKeyToFocus}, .${styles.isInvalid}`);
                // Special case for options/matrix lists if the error is on the list itself
                if (errorKeyToFocus === 'options' || errorKeyToFocus === 'cardsToSort') firstInvalidElement = document.querySelector(`.${styles.dynamicListContainer} input[name^="options"], .${styles.dynamicListContainer} input[name^="cardsToSort"]`);
                if (errorKeyToFocus === 'matrixRows') firstInvalidElement = document.querySelector(`.${styles.dynamicListContainer} input[name^="matrixRows"]`);
                if (errorKeyToFocus === 'matrixColumns') firstInvalidElement = document.querySelector(`.${styles.dynamicListContainer} input[name^="matrixColumns"]`);


                if (firstInvalidElement && typeof firstInvalidElement.focus === 'function') {
                    firstInvalidElement.focus({ preventScroll: true }); // Focus first
                    if (typeof firstInvalidElement.scrollIntoView === 'function') { // Then scroll
                        firstInvalidElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }
            }
            // Switch to the tab containing the first error
            const contentErrors = ['text', 'options', 'matrixRows', 'matrixColumns', 'slider', 'imageUrl', 'maxDiffItemsPerSet', 'conjointAttributes', 'cardsToSort', 'cardSortCategories', 'rows'];
            const logicErrors = ['hideByDefault', 'showOnlyToAdmin', 'isDisabled', 'randomizationAlwaysInclude', 'randomizationPinPosition', 'hideAfterAnswering', 'randomizeOptions'];
            const pipingErrors = ['pipeOptionsFromQuestionId', 'repeatForEachOptionFromQuestionId'];
            const validationErrors = ['requiredSetting', 'answerRequirements', 'textValidation', 'answerFormatCapitalization', 'limitAnswers', 'limitAnswersMax', 'minAnswersRequired'];

            if (logicErrors.some(key => currentErrors[key])) setActiveTab('logic');
            else if (pipingErrors.some(key => currentErrors[key])) setActiveTab('piping');
            else if (validationErrors.some(key => currentErrors[key])) setActiveTab('validation');
            else if (contentErrors.some(key => currentErrors[key])) setActiveTab('content');
            else setActiveTab('content'); // Default to content tab
        }
    };

    const renderDynamicList = (fieldName, label, placeholderPrefix, errorKey, minItems = 1, addButtonText = '+ Add Item') => {
        const list = ensureArray(questionState[fieldName]);
        return (
            <div className={styles.dynamicListContainer}>
                <label className={styles.formLabel}>{label}:</label>
                {errors[errorKey] && <div className={`${styles.invalidFeedback} d-block mb-2`}>{errors[errorKey]}</div>}
                {list.map((item, index) => (
                    <div key={index} className={styles.dynamicListItem}>
                        <input
                            type="text"
                            value={item}
                            onChange={(e) => handleListItemChange(fieldName, index, e.target.value)}
                            className={`${styles.formControl} ${styles.dynamicListInput} ${errors[errorKey] ? styles.isInvalid : ''}`}
                            placeholder={`${placeholderPrefix} ${index + 1}`}
                        />
                        {list.length > minItems && (
                            <button
                                type="button"
                                onClick={() => removeListItem(fieldName, index)}
                                className={`button button-danger button-small ${styles.dynamicListRemoveButton}`}
                                title={`Remove ${placeholderPrefix}`}
                            >
                                &times;
                            </button>
                        )}
                    </div>
                ))}
                <button
                    type="button"
                    onClick={() => addListItem(fieldName)}
                    className={`button button-secondary button-small ${styles.dynamicListAddButton}`}
                >
                    {addButtonText}
                </button>
            </div>
        );
    };

    const pipingSourceCandidates = useCallback(() => {
        const safeAllQuestions = Array.isArray(allQuestions) ? allQuestions : [];
        if (mode === 'add') {
            return safeAllQuestions.filter(q => PIPING_REPEAT_SOURCE_TYPES.includes(q.type));
        } else {
            if (questionIndex >= 0 && questionIndex < safeAllQuestions.length) {
                return safeAllQuestions.slice(0, questionIndex).filter(q => PIPING_REPEAT_SOURCE_TYPES.includes(q.type));
            }
            if (questionData?._id) { // Fallback if index is weird but we have an ID (e.g., -1 but it's an edit)
                const actualIdx = safeAllQuestions.findIndex(q => q._id === questionData._id);
                return actualIdx > 0 ? safeAllQuestions.slice(0, actualIdx).filter(q => PIPING_REPEAT_SOURCE_TYPES.includes(q.type)) : [];
            }
            return [];
        }
    }, [allQuestions, mode, questionIndex, questionData?._id]);


    if (mode === 'edit' && !questionData) {
        return (
            <div className={styles.questionEditPanel} style={{ padding: '20px', border: '1px solid red' }}>
                <p style={{ color: 'red', fontWeight: 'bold' }}>Error: No question data provided for editing.</p>
                <button type="button" onClick={onCancel} className="button button-secondary">Close</button>
            </div>
        );
    }
    const isLimitAnswersMaxValidPositive = questionState.limitAnswersMax !== '' && !isNaN(Number(questionState.limitAnswersMax)) && Number(questionState.limitAnswersMax) > 0;

    return (
        <div className={styles.questionEditPanel}>
            <div className={styles.panelHeader}>
                <h3>{mode === 'add' ? 'Add New Question' : `Edit Question ${questionIndex >= 0 ? `(#${questionIndex + 1})` : ''}`}</h3>
                <button onClick={onCancel} className={styles.closeButton} title="Close Panel">&times;</button>
            </div>
            <div className={styles.panelTabs}>
                <button onClick={() => setActiveTab('content')} className={`${styles.panelTabButton} ${activeTab === 'content' ? styles.active : ''}`}>Content</button>
                <button onClick={() => setActiveTab('logic')} className={`${styles.panelTabButton} ${activeTab === 'logic' ? styles.active : ''}`}>Logic</button>
                <button onClick={() => setActiveTab('piping')} className={`${styles.panelTabButton} ${activeTab === 'piping' ? styles.active : ''}`}>Piping/Repeat</button>
                <button onClick={() => setActiveTab('validation')} className={`${styles.panelTabButton} ${activeTab === 'validation' ? styles.active : ''}`}>Validation</button>
            </div>
            {questionState ? (
                <div className={styles.panelContent}>
                     <div className={`${styles.panelTabContent} ${activeTab === 'content' ? styles.active : ''}`}>
                        <div className={styles.formGroup}>
                            <label htmlFor="questionText" className={styles.formLabel}>Question Text:</label>
                            <textarea id="questionText" name="text" value={questionState.text || ''} onChange={handleChange} className={`${styles.formControl} ${errors.text ? styles.isInvalid : ''}`} rows="3" required />
                            {errors.text && <div className={styles.invalidFeedback}>{errors.text}</div>}
                        </div>
                        <div className={styles.formGroup}>
                            <label htmlFor="questionType" className={styles.formLabel}>Question Type:</label>
                            <select id="questionType" name="type" value={questionState.type || 'text'} onChange={handleChange} className={styles.formControl}>
                                <option value="text">Single-Line Text</option>
                                <option value="textarea">Multi-Line Text</option>
                                <option value="multiple-choice">Multiple Choice</option>
                                <option value="checkbox">Checkbox</option>
                                <option value="dropdown">Dropdown</option>
                                <option value="rating">Rating (1-5)</option>
                                <option value="nps">NPS (0-10)</option>
                                <option value="matrix">Matrix / Grid</option>
                                <option value="slider">Slider</option>
                                <option value="ranking">Ranking Order</option>
                                <option value="heatmap">Image Heatmap</option>
                                <option value="maxdiff">MaxDiff (Best/Worst)</option>
                                <option value="conjoint">Conjoint Task</option>
                                <option value="cardsort">Card Sorting Task</option>
                                {/* Add other types if any */}
                            </select>
                        </div>
                        {questionState.type === 'textarea' && (
                            <div className={styles.formGroup}>
                                <label htmlFor="questionRows" className={styles.formLabel}>Number of Rows:</label>
                                <input type="number" id="questionRows" name="rows" value={questionState.rows} onChange={handleNumberChange} className={`${styles.formControl} ${errors.rows ? styles.isInvalid : ''}`} min="1" step="1" placeholder="e.g., 4" />
                                {errors.rows && <div className={styles.invalidFeedback}>{errors.rows}</div>}
                            </div>
                        )}
                        {OPTION_BASED_TYPES.includes(questionState.type) && questionState.type !== CARD_SORT_TYPE &&
                            renderDynamicList('options', 'Options', 'Option', 'options', ['multiple-choice', 'dropdown', 'ranking', 'maxdiff'].includes(questionState.type) ? 2 : 1, '+ Add Option')
                        }
                        {questionState.type === 'matrix' && (
                            <>
                                {renderDynamicList('matrixRows', 'Matrix Rows', 'Row', 'matrixRows', 1, '+ Add Row')}
                                {renderDynamicList('matrixColumns', 'Matrix Columns', 'Column', 'matrixColumns', 1, '+ Add Column')}
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Matrix Input Type:</label>
                                    <div>
                                        <div className={`${styles.formCheck} ${styles.formCheckInline}`}>
                                            <input className={styles.formCheckInput} type="radio" name="matrixType" id="matrixTypeRadio" value="radio" checked={questionState.matrixType === 'radio'} onChange={handleChange} />
                                            <label className={styles.formCheckLabel} htmlFor="matrixTypeRadio">Radio Buttons</label>
                                        </div>
                                        <div className={`${styles.formCheck} ${styles.formCheckInline}`}>
                                            <input className={styles.formCheckInput} type="radio" name="matrixType" id="matrixTypeCheckbox" value="checkbox" checked={questionState.matrixType === 'checkbox'} onChange={handleChange} />
                                            <label className={styles.formCheckLabel} htmlFor="matrixTypeCheckbox">Checkboxes</label>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                        {questionState.type === 'slider' && (
                            <>
                                {errors.slider && <div className={`${styles.invalidFeedback} d-block mb-2`}>{errors.slider}</div>}
                                <div className={styles.sliderControls}>
                                    <div className={styles.formGroup}>
                                        <label htmlFor="sliderMin" className={styles.formLabel}>Min:</label>
                                        <input type="number" id="sliderMin" name="sliderMin" value={questionState.sliderMin} onChange={handleNumberChange} className={`${styles.formControl} ${errors.slider ? styles.isInvalid : ''}`} />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label htmlFor="sliderMax" className={styles.formLabel}>Max:</label>
                                        <input type="number" id="sliderMax" name="sliderMax" value={questionState.sliderMax} onChange={handleNumberChange} className={`${styles.formControl} ${errors.slider ? styles.isInvalid : ''}`} />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label htmlFor="sliderStep" className={styles.formLabel}>Step:</label>
                                        <input type="number" id="sliderStep" name="sliderStep" value={questionState.sliderStep} onChange={handleNumberChange} className={`${styles.formControl} ${errors.slider ? styles.isInvalid : ''}`} step="any" min="0.01"/>
                                    </div>
                                </div>
                                <div className={styles.sliderLabels}>
                                    <div className={styles.formGroup}>
                                        <label htmlFor="sliderMinLabel" className={styles.formLabel}>Min Label:</label>
                                        <input type="text" id="sliderMinLabel" name="sliderMinLabel" value={questionState.sliderMinLabel} onChange={handleChange} className={styles.formControl} />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label htmlFor="sliderMaxLabel" className={styles.formLabel}>Max Label:</label>
                                        <input type="text" id="sliderMaxLabel" name="sliderMaxLabel" value={questionState.sliderMaxLabel} onChange={handleChange} className={styles.formControl} />
                                    </div>
                                </div>
                            </>
                        )}
                        {questionState.type === 'heatmap' && (
                            <>
                                <div className={styles.formGroup}>
                                    <label htmlFor="imageUrl" className={styles.formLabel}>Image URL:</label>
                                    <input type="url" id="imageUrl" name="imageUrl" value={questionState.imageUrl || ''} onChange={handleChange} className={`${styles.formControl} ${errors.imageUrl ? styles.isInvalid : ''}`} placeholder="https://..." required />
                                    {errors.imageUrl && <div className={styles.invalidFeedback}>{errors.imageUrl}</div>}
                                </div>
                                <div className={styles.formGroup}>
                                    <label htmlFor="heatmapMaxClicks" className={styles.formLabel}>Max Clicks:</label>
                                    <input type="number" id="heatmapMaxClicks" name="heatmapMaxClicks" value={questionState.heatmapMaxClicks} onChange={handleNumberChange} className={`${styles.formControl} ${errors.heatmapMaxClicks ? styles.isInvalid : ''}`} min="0" step="1" placeholder="Blank=unlimited"/>
                                    {errors.heatmapMaxClicks && <div className={styles.invalidFeedback}>{errors.heatmapMaxClicks}</div>}
                                </div>
                            </>
                        )}
                        {questionState.type === 'maxdiff' && (
                            <div className={styles.formGroup}>
                                <label htmlFor="maxDiffItemsPerSet" className={styles.formLabel}>Items per Task:</label>
                                <input type="number" id="maxDiffItemsPerSet" name="maxDiffItemsPerSet" value={questionState.maxDiffItemsPerSet} onChange={handleNumberChange} className={styles.formControl} min="2" step="1"/>
                                <small className="text-muted">Options shown per task.</small>
                            </div>
                        )}
                        {questionState.type === 'conjoint' && (
                            <>
                                {errors.conjointAttributes && <div className={`${styles.invalidFeedback} d-block mb-2`}>{errors.conjointAttributes}</div>}
                                <div className={styles.conjointAttributesSection}>
                                    <h4>Attributes & Levels</h4>
                                    {ensureArray(questionState.conjointAttributes).map((attr, index) => (
                                        <div key={index} className={styles.conjointAttributeItem}>
                                            <span><strong>{attr.name || `Attr ${index + 1}`}</strong>: {ensureArray(attr.levels).join(', ')}</span>
                                            <div className={styles.conjointAttributeControls}>
                                                <button type="button" onClick={() => handleEditAttribute(index)} className="button button-secondary button-small">Edit</button>
                                                <button type="button" onClick={() => handleRemoveAttribute(index)} className="button button-danger button-small">Remove</button>
                                            </div>
                                        </div>
                                    ))}
                                    <button type="button" onClick={handleAddNewAttribute} className="button button-secondary button-small mt-2">+ Add Attribute</button>
                                </div>
                                {editingAttributeIndex !== null && (
                                    <div className={styles.conjointAttributeModal}>
                                        <h5>{editingAttributeIndex === -1 ? 'Add' : 'Edit'} Attribute</h5>
                                        <div className={styles.formGroup}>
                                            <label>Name:</label>
                                            <input type="text" value={currentAttributeName} onChange={(e) => setCurrentAttributeName(e.target.value)} className={styles.formControl} />
                                        </div>
                                        <div className={styles.formGroup}>
                                            <label>Levels (one per line):</label>
                                            <textarea value={currentAttributeLevels} onChange={(e) => setCurrentAttributeLevels(e.target.value)} className={styles.formControl} rows="4" />
                                        </div>
                                        <div className={styles.conjointAttributeModalFooter}>
                                            <button type="button" onClick={handleCancelEditAttribute} className="button button-secondary">Cancel</button>
                                            <button type="button" onClick={handleSaveAttribute} className="button button-primary">Save</button>
                                        </div>
                                    </div>
                                )}
                                <div className={styles.formGroup}>
                                    <label htmlFor="conjointProfilesPerTask" className={styles.formLabel}>Profiles per Task:</label>
                                    <input type="number" id="conjointProfilesPerTask" name="conjointProfilesPerTask" value={questionState.conjointProfilesPerTask} onChange={handleNumberChange} className={styles.formControl} min="2" step="1"/>
                                    <small className="text-muted">Profiles shown per task.</small>
                                </div>
                            </>
                        )}
                        {questionState.type === CARD_SORT_TYPE && (
                            <>
                                {renderDynamicList('options', 'Card Items', 'Card', 'cardsToSort', 1, '+ Add Card Item')}
                                {renderDynamicList('cardSortCategories', 'Predefined Categories (Optional)', 'Category', 'cardSortCategories', 0, '+ Add Category')}
                                <div className={styles.formCheck}>
                                    <input className={styles.formCheckInput} type="checkbox" id="cardSortAllowUserCategories" name="cardSortAllowUserCategories" checked={!!questionState.cardSortAllowUserCategories} onChange={handleChange} />
                                    <label className={styles.formCheckLabel} htmlFor="cardSortAllowUserCategories"> Allow user categories </label>
                                </div>
                            </>
                        )}
                        {SPECIAL_OPTION_TYPES_WITH_NA_OTHER.includes(questionState.type) && (
                            <div className={styles.specialOptions}>
                                <div className={styles.formCheck}>
                                    <input className={styles.formCheckInput} type="checkbox" id="addOtherOption" name="addOtherOption" checked={!!questionState.addOtherOption} onChange={handleChange} />
                                    <label className={styles.formCheckLabel} htmlFor="addOtherOption"> Add "Other"</label>
                                </div>
                                {questionState.addOtherOption && (
                                    <div className={`${styles.formCheck} ${styles.subOption}`}>
                                        <input className={styles.formCheckInput} type="checkbox" id="requireOtherIfSelected" name="requireOtherIfSelected" checked={!!questionState.requireOtherIfSelected} onChange={handleChange} />
                                        <label className={styles.formCheckLabel} htmlFor="requireOtherIfSelected"> Require text if "Other" selected</label>
                                    </div>
                                )}
                                <div className={styles.formCheck}>
                                    <input className={styles.formCheckInput} type="checkbox" id="addNAOption" name="addNAOption" checked={!!questionState.addNAOption} onChange={handleChange} />
                                    <label className={styles.formCheckLabel} htmlFor="addNAOption"> Add "N/A"</label>
                                </div>
                            </div>
                        )}
                    </div>
                     <div className={`${styles.panelTabContent} ${activeTab === 'logic' ? styles.active : ''}`}>
                        <div className={styles.logicSection}><h4>Visibility & Behavior</h4>{HIDE_AFTER_ANSWERING_TYPES.includes(questionState.type) && ( <div className={styles.formCheck}> <input className={styles.formCheckInput} type="checkbox" id="hideAfterAnswering" name="hideAfterAnswering" checked={!!questionState.hideAfterAnswering} onChange={handleChange} /> <label className={styles.formCheckLabel} htmlFor="hideAfterAnswering"> Hide after answering </label> </div> )}<div className={styles.formCheck}> <input className={styles.formCheckInput} type="checkbox" id="hideByDefault" name="hideByDefault" checked={!!questionState.hideByDefault} onChange={handleChange} /> <label className={styles.formCheckLabel} htmlFor="hideByDefault"> Hide by default </label> </div><div className={styles.formCheck}> <input className={styles.formCheckInput} type="checkbox" id="showOnlyToAdmin" name="showOnlyToAdmin" checked={!!questionState.showOnlyToAdmin} onChange={handleChange} /> <label className={styles.formCheckLabel} htmlFor="showOnlyToAdmin"> Show only to admin </label> </div></div>
                         <div className={styles.logicSection}><h4>Disable Question</h4><div className={`${styles.formCheck} ${styles.formCheckInline}`}> <input className={styles.formCheckInput} type="radio" name="isDisabled" id="isDisabledYes" value="true" checked={questionState.isDisabled === true} onChange={handleChange} /> <label className={styles.formCheckLabel} htmlFor="isDisabledYes">Yes</label> </div><div className={`${styles.formCheck} ${styles.formCheckInline}`}> <input className={styles.formCheckInput} type="radio" name="isDisabled" id="isDisabledNo" value="false" checked={questionState.isDisabled === false} onChange={handleChange} /> <label className={styles.formCheckLabel} htmlFor="isDisabledNo">No</label> </div><div><small className="text-muted">Visible but cannot be answered.</small></div></div>
                         <div className={styles.logicSection}><h4>Question Randomization</h4><div className={styles.formCheck}> <input className={styles.formCheckInput} type="checkbox" id="randomizationAlwaysInclude" name="randomizationAlwaysInclude" checked={!!questionState.randomizationAlwaysInclude} onChange={handleChange} /> <label className={styles.formCheckLabel} htmlFor="randomizationAlwaysInclude"> Always include in random sets </label> </div><div className={styles.formCheck}> <input className={styles.formCheckInput} type="checkbox" id="randomizationPinPosition" name="randomizationPinPosition" checked={!!questionState.randomizationPinPosition} onChange={handleChange} /> <label className={styles.formCheckLabel} htmlFor="randomizationPinPosition"> Pin position during shuffling </label> </div></div>
                         {RANDOMIZATION_SUPPORTING_TYPES.includes(questionState.type) && ( <div className={styles.logicSection}> <h4>Option Randomization</h4> <div className={styles.formCheck}> <input className={styles.formCheckInput} type="checkbox" id="randomizeOptions" name="randomizeOptions" checked={!!questionState.randomizeOptions} onChange={handleChange} /> <label className={styles.formCheckLabel} htmlFor="randomizeOptions"> Randomize option order </label> {errors.randomizeOptions && <div className={styles.invalidFeedback}>{errors.randomizeOptions}</div>} </div> </div> )}
                    </div>
                    <div className={`${styles.panelTabContent} ${activeTab === 'piping' ? styles.active : ''}`} id="piping-repeat-section">
                        <div className={styles.logicSummary}>
                            <h4>Current Piping/Repeating:</h4>
                            {questionState.pipeOptionsFromQuestionId ? ( <p>Options piped from: "{findQuestionTextById(questionState.pipeOptionsFromQuestionId, allQuestions)}".</p> ) : ( <p>Option Piping: None</p> )}
                            {questionState.repeatForEachOptionFromQuestionId ? ( <p>Repeats for each from: "{findQuestionTextById(questionState.repeatForEachOptionFromQuestionId, allQuestions)}".</p> ) : ( <p>Question Repeating: None</p> )}
                        </div>
                        <div className={styles.pipingSection}>
                            <h4>Option Piping</h4>
                            <p><small>Populate options from a previous question.</small></p>
                            {!PIPING_TARGET_TYPES.includes(questionState.type) && <p className="text-muted"><small>Not available for this question type.</small></p>}
                            {PIPING_TARGET_TYPES.includes(questionState.type) && (
                                <div className={styles.formGroup}>
                                    <label htmlFor="pipeOptionsFromQuestionId" className={styles.formLabel}>Pipe Options From:</label>
                                    <select
                                        id="pipeOptionsFromQuestionId"
                                        name="pipeOptionsFromQuestionId"
                                        value={questionState.pipeOptionsFromQuestionId || ''}
                                        onChange={handleChange}
                                        className={`${styles.formControl} ${errors.pipeOptionsFromQuestionId ? styles.isInvalid : ''}`}
                                        disabled={pipingSourceCandidates().length === 0}
                                    >
                                        <option value="">-- None --</option>
                                        {pipingSourceCandidates().map((q) => (
                                            <option key={q._id} value={q._id}>
                                                {allQuestions.findIndex(aq => aq._id === q._id) + 1}. {truncateText(q.text)} ({getQuestionTypeLabel(q.type)})
                                            </option>
                                        ))}
                                        {pipingSourceCandidates().length === 0 && <option value="" disabled>No compatible previous questions</option>}
                                    </select>
                                    {errors.pipeOptionsFromQuestionId && <div className={styles.invalidFeedback}>{errors.pipeOptionsFromQuestionId}</div>}
                                    <small className="text-muted">Source: MC, Checkbox, Dropdown.</small>
                                </div>
                            )}
                        </div>
                        <hr className={styles.pipingDivider} />
                        <div className={styles.pipingSection}>
                            <h4>Question Repeating</h4>
                            <p><small>Repeat this question for each selected option.</small></p>
                            <div className={styles.formGroup}>
                                <label htmlFor="repeatForEachOptionFromQuestionId" className={styles.formLabel}>Repeat For Each Option From:</label>
                                <select
                                    id="repeatForEachOptionFromQuestionId"
                                    name="repeatForEachOptionFromQuestionId"
                                    value={questionState.repeatForEachOptionFromQuestionId || ''}
                                    onChange={handleChange}
                                    className={`${styles.formControl} ${errors.repeatForEachOptionFromQuestionId ? styles.isInvalid : ''}`}
                                    disabled={pipingSourceCandidates().length === 0}
                                >
                                    <option value="">-- None --</option>
                                    {pipingSourceCandidates().map((q) => (
                                        <option key={q._id} value={q._id}>
                                            {allQuestions.findIndex(aq => aq._id === q._id) + 1}. {truncateText(q.text)} ({getQuestionTypeLabel(q.type)})
                                        </option>
                                    ))}
                                    {pipingSourceCandidates().length === 0 && <option value="" disabled>No compatible previous questions</option>}
                                </select>
                                {errors.repeatForEachOptionFromQuestionId && <div className={styles.invalidFeedback}>{errors.repeatForEachOptionFromQuestionId}</div>}
                                <small className="text-muted">Source: MC, Checkbox, Dropdown.</small>
                            </div>
                        </div>
                    </div>
                    <div className={`${styles.panelTabContent} ${activeTab === 'validation' ? styles.active : ''}`}>
                        <div className={styles.validationSection}> <h4>Required Setting</h4> <select name="requiredSetting" value={questionState.requiredSetting} onChange={handleChange} className={`${styles.formControl} ${errors.requiredSetting ? styles.isInvalid : ''}`}> <option value="not_required">Not Required</option> <option value="required">Required</option> <option value="soft_required">Soft Required</option> </select> {errors.requiredSetting && <div className={styles.invalidFeedback}>{errors.requiredSetting}</div>} </div>
                        {TEXT_INPUT_TYPES.includes(questionState.type) && ( <div className={styles.validationSection}> <h4>Text Input Validation</h4> <select name="textValidation" value={questionState.textValidation} onChange={handleChange} className={`${styles.formControl} ${errors.textValidation ? styles.isInvalid : ''}`}> <option value="none">None</option> <option value="email">Email Address</option> <option value="numeric">Numeric</option> </select> {errors.textValidation && <div className={styles.invalidFeedback}>{errors.textValidation}</div>} </div> )}
                        {questionState.type === 'checkbox' && (
                            <div className={styles.validationSection}>
                                <h4>Checkbox Answer Limits</h4>
                                {errors.answerRequirements && <div className={`${styles.invalidFeedback} d-block mb-2`}>{errors.answerRequirements}</div>}
                                <div className={styles.answerRequirementsGroup}>
                                     <div className={styles.answerRequirementRow}>
                                        <label htmlFor="minAnswersRequired" className={styles.formLabel}>Min Answers:</label>
                                        <input type="number" id="minAnswersRequired" name="minAnswersRequired" value={questionState.minAnswersRequired} onChange={handleNumberChange} className={`${styles.formControl} ${errors.answerRequirements ? styles.isInvalid : ''}`} min="0" step="1" placeholder="e.g., 1 (0=none)" />
                                    </div>
                                    <div className={styles.answerRequirementRow}>
                                        <label htmlFor="limitAnswersMax" className={styles.formLabel}>Max Answers:</label>
                                        <input type="number" id="limitAnswersMax" name="limitAnswersMax" value={questionState.limitAnswersMax} onChange={handleNumberChange} className={`${styles.formControl} ${errors.answerRequirements ? styles.isInvalid : ''}`} min="1" step="1" placeholder="e.g., 3" />
                                        <div className={styles.formCheck}>
                                            <input className={styles.formCheckInput} type="checkbox" id="limitAnswers" name="limitAnswers" checked={!!questionState.limitAnswers} onChange={handleChange} disabled={!isLimitAnswersMaxValidPositive} />
                                            <label className={styles.formCheckLabel} htmlFor="limitAnswers"> Enforce Max Limit </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        {TEXT_INPUT_TYPES.includes(questionState.type) && ( <div className={styles.validationSection}> <h4>Answer Formatting</h4> <div className={styles.formCheck}> <input className={styles.formCheckInput} type="checkbox" id="answerFormatCapitalization" name="answerFormatCapitalization" checked={!!questionState.answerFormatCapitalization} onChange={handleChange} /> <label className={styles.formCheckLabel} htmlFor="answerFormatCapitalization"> Force Uppercase </label> </div> </div> )}
                    </div>
                </div>
            ) : (
                 <div className={styles.panelContent}><p>Initializing panel...</p></div>
            )}
            <div className={styles.panelFooter}>
                <button type="button" onClick={onCancel} className="button button-secondary" disabled={isSaving}>Cancel</button>
                <button type="button" onClick={handleSave} className="button button-primary" disabled={isSaving}>
                    {isSaving ? 'Saving...' : (mode === 'add' ? 'Add Question' : 'Save Changes')}
                </button>
            </div>
        </div>
    );
}

export default QuestionEditPanel;
// ----- END OF COMPLETE UPDATED FILE (v11.2 - Refined Piping Sources & ALL FUNCTIONS INCLUDED) -----