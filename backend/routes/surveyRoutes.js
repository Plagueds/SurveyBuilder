// backend/routes/surveyRoutes.js
// ----- START OF COMPLETE UPDATED FILE (v1.5 - Added Save Partial Route) -----
const express = require('express');
const surveyController = require('../controllers/surveyController');
const router = express.Router();

const { protect, authorizeSurveyAccess } = require('../middleware/authMiddleware');
const collectorRoutes = require('./collectorRoutes');

// --- Public Routes (No user authentication needed, but survey/collector must be valid) ---

// Route for submitting all answers for a survey
router.route('/:surveyId/submit')
    .post(surveyController.submitSurveyAnswers);

// +++ NEW: Route for saving a partial response (Save and Continue Later) +++
// This route is public in the sense that a respondent (not necessarily a logged-in user) can hit it.
// Validation of surveyId, collectorId, and survey settings (if saveAndContinue is enabled) happens in the controller.
router.route('/:surveyId/save-partial')
    .post(surveyController.savePartialResponse);


// --- Protected Routes (Authentication required via 'protect' middleware) ---
router.use(protect); 

router.route('/')
    .get(surveyController.getAllSurveys)
    .post(surveyController.createSurvey);

router.route('/:surveyId')
    .get(authorizeSurveyAccess, surveyController.getSurveyById) 
    .patch(authorizeSurveyAccess, surveyController.updateSurvey) 
    .delete(authorizeSurveyAccess, surveyController.deleteSurvey); 

router.route('/:surveyId/results')
    .get(authorizeSurveyAccess, surveyController.getSurveyResults); 

router.route('/:surveyId/export')
    .get(authorizeSurveyAccess, surveyController.exportSurveyResults); 

router.use('/:surveyId/collectors', authorizeSurveyAccess, collectorRoutes); 

module.exports = router;
// ----- END OF COMPLETE UPDATED FILE (v1.5 - Added Save Partial Route) -----