// backend/routes/answerRoutes.js
// ----- START OF SUGGESTED COMPLETE UPDATED FILE -----
const express = require('express');
const router = express.Router();
const answerController = require('../controllers/answerController');
const { protect, authorizeSurveyAccess } = require('../middleware/authMiddleware'); // Import your middlewares

// POST /api/answers - Submit a single answer (This might also need protection depending on use case)
// If this is part of the public survey submission flow, it should NOT be protected here.
// If it's an admin/internal tool, it should be. For now, assuming it's part of a different flow.
router.post('/', answerController.addAnswer);

// GET /api/answers - Get answers, potentially filtered
// This route is very broad. Consider if it's needed or how it should be secured.
// For now, applying general protection.
router.get('/', protect, answerController.getAllAnswers);


// GET /api/answers/survey/:surveyId - Get all answers for a specific survey
// This route is used by SurveyResultsPage and MUST be protected.
// 'authorizeSurveyAccess' will use the :surveyId from the URL.
router.get('/survey/:surveyId', protect, authorizeSurveyAccess, answerController.getAnswersBySurveyId);
//                                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^ Apply protection and survey-specific authorization

module.exports = router;
// ----- END OF SUGGESTED COMPLETE UPDATED FILE -----