// frontend/src/utils/questionTypes.js
// ----- START OF EXPANDED FILE -----
export const QUESTION_TYPES = {
    'text': {
        label: 'Single-Line Text',
        defaultProps: {
            // textValidation: 'none', // Handled by QuestionEditPanel's initial state
            // placeholder: 'Enter your answer', // More of a display concern for QuestionViewer/EditPanel
            // maxLength: 255, // Handled by QuestionEditPanel
        }
    },
    'textarea': {
        label: 'Multi-Line Text',
        defaultProps: {
            // rows: 4, // Handled by QuestionEditPanel's initial state
        }
    },
    'multiple-choice': {
        label: 'Multiple Choice',
        defaultProps: {
            // options are handled by QuestionEditPanel's initialization logic
            // addOtherOption: false, // Handled by QuestionEditPanel
        }
    },
    'checkbox': {
        label: 'Checkbox',
        defaultProps: {
            // options handled by QuestionEditPanel
        }
    },
    'dropdown': {
        label: 'Dropdown',
        defaultProps: {
            // options handled by QuestionEditPanel
        }
    },
    'rating': {
        label: 'Rating (1-5)', // You can adjust label if scale is dynamic in panel
        defaultProps: {
            // scale: 5, // Handled by QuestionEditPanel
            // minLabel: 'Poor',
            // maxLabel: 'Excellent',
        }
    },
    'nps': {
        label: 'NPS (0-10)',
        defaultProps: {
            // minLabel: 'Not at all likely', // Handled by QuestionEditPanel
            // maxLabel: 'Extremely likely',
        }
    },
    'matrix': {
        label: 'Matrix / Grid',
        defaultProps: {
            // matrixRows/Columns handled by QuestionEditPanel
            // matrixType: 'radio',
        }
    },
    'slider': {
        label: 'Slider',
        defaultProps: {
            // sliderMin: 0, // Handled by QuestionEditPanel
            // sliderMax: 100,
            // sliderStep: 1,
        }
    },
    'ranking': {
        label: 'Ranking Order',
        defaultProps: {
            // options handled by QuestionEditPanel
        }
    },
    'heatmap': {
        label: 'Image Heatmap',
        defaultProps: {
            // imageUrl: '', // Handled by QuestionEditPanel
            // heatmapMaxClicks: null,
        }
    },
    'maxdiff': {
        label: 'MaxDiff (Best/Worst)',
        defaultProps: {
            // options handled by QuestionEditPanel
            // maxDiffItemsPerSet: 4,
        }
    },
    'conjoint': {
        label: 'Conjoint Task',
        defaultProps: {
            // conjointAttributes: [], // Handled by QuestionEditPanel
            // conjointProfilesPerTask: 3,
        }
    },
    'cardsort': {
        label: 'Card Sorting Task',
        defaultProps: {
            // options (cards) handled by QuestionEditPanel
            // cardSortCategories: [],
            // cardSortAllowUserCategories: true,
        }
    },
    // Add any other types you have, like 'file-upload', 'date-picker' if they were in your original set
    // 'file-upload': {
    //     label: 'File Upload',
    //     defaultProps: {}
    // },
    // 'date-picker': {
    //     label: 'Date Picker',
    //     defaultProps: {}
    // }
};

// Helper function (already in your QuestionEditPanel, but good to have here if used elsewhere)
export const getQuestionTypeLabel = (typeValue) => {
    return QUESTION_TYPES[typeValue]?.label || typeValue;
};
// ----- END OF EXPANDED FILE -----