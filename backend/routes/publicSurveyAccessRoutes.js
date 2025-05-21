// backend/routes/publicSurveyAccessRoutes.js
// ----- START OF COMPLETE MODIFIED FILE (v1.1 - Added Resume With Code Route) -----
const express = require('express');
const router = express.Router();
const publicSurveyAccessController = require('../controllers/publicSurveyAccessController');

// Route for respondents to access a survey using a collector's linkId or customSlug
// Using POST to allow sending password in the request body if needed.
router.post('/:accessIdentifier', publicSurveyAccessController.accessSurvey);

// +++ NEW: Route for respondents to resume a survey using a code +++
router.post('/:accessIdentifier/resume', publicSurveyAccessController.resumeSurveyWithCode);

module.exports = router;
// ----- END OF COMPLETE MODIFIED FILE (v1.1 - Added Resume With Code Route) -----