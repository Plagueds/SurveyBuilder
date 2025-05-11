// backend/routes/surveyRoutes.js
// ----- START OF COMPLETE UPDATED FILE (v1.4 - Added Survey Ownership Authorization) -----
const express = require('express');
const surveyController = require('../controllers/surveyController');
const router = express.Router();

// --- Import Auth Middleware ---
// 'authorizeSurveyAccess' is a new middleware for checking survey ownership.
const { protect, authorizeSurveyAccess } = require('../middleware/authMiddleware'); // <<<--- Import authorizeSurveyAccess

// --- Import Collector Routes ---
const collectorRoutes = require('./collectorRoutes');

// --- Public Routes (No authentication needed) ---

// Route for submitting all answers for a survey (PUBLIC)
router.route('/:surveyId/submit')
    .post(surveyController.submitSurveyAnswers);


// --- Protected Routes (Authentication required via 'protect' middleware) ---
router.use(protect); // All routes defined below this line will require authentication.

// GET all surveys (filtered by user) & POST a new survey
router.route('/')
    .get(surveyController.getAllSurveys)
    .post(surveyController.createSurvey);

// --- Routes requiring Survey Ownership or Admin role ---
// These routes operate on a specific survey and will first check authentication (protect)
// and then check survey ownership/admin role (authorizeSurveyAccess).

// GET, PATCH, DELETE specific survey by ID
router.route('/:surveyId')
    .get(authorizeSurveyAccess, surveyController.getSurveyById) // <<<--- Apply authorizeSurveyAccess
    .patch(authorizeSurveyAccess, surveyController.updateSurvey) // <<<--- Apply authorizeSurveyAccess
    .delete(authorizeSurveyAccess, surveyController.deleteSurvey); // <<<--- Apply authorizeSurveyAccess

// Route for getting survey results
router.route('/:surveyId/results')
    .get(authorizeSurveyAccess, surveyController.getSurveyResults); // <<<--- Apply authorizeSurveyAccess

// Route for exporting survey results
router.route('/:surveyId/export')
    .get(authorizeSurveyAccess, surveyController.exportSurveyResults); // <<<--- Apply authorizeSurveyAccess

// --- Mount Collector Routes for a specific survey ---
// 'authorizeSurveyAccess' is applied here so all collector routes are also protected
// by survey ownership. The 'surveyId' from the path will be used by 'authorizeSurveyAccess'.
router.use('/:surveyId/collectors', authorizeSurveyAccess, collectorRoutes); // <<<--- Apply authorizeSurveyAccess

module.exports = router;
// ----- END OF COMPLETE UPDATED FILE (v1.4 - Added Survey Ownership Authorization) -----