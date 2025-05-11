// backend/routes/collectorRoutes.js
// ----- START OF COMPLETE UPDATED FILE (v1.1 - Auth Handled by Parent Router) -----
const express = require('express');
const router = express.Router({ mergeParams: true }); // mergeParams allows access to :surveyId from parent router

const collectorController = require('../controllers/collectorController');
// Auth (protect and authorizeSurveyAccess) is handled by the surveyRoutes.js
// when mounting these collector routes. So, individual protection here is not
// strictly needed again for survey-level access.

// --- Routes for Collectors related to a specific Survey ---
// Base path: /api/surveys/:surveyId/collectors

router.route('/')
    .post(collectorController.createCollector) // Create a new collector for :surveyId
    .get(collectorController.getCollectorsForSurvey); // Get all collectors for :surveyId

// --- Routes for a specific Collector by its own ID ---
// Base path: /api/surveys/:surveyId/collectors/:collectorId

router.route('/:collectorId')
    .get(collectorController.getCollectorById) // Get a single collector
    .put(collectorController.updateCollector) // Update a collector (Consider PATCH for partial updates)
    .delete(collectorController.deleteCollector); // Delete a collector

// Placeholder for a route to get a public-facing collector link (for respondents)
// This would likely be a top-level route, not under /api, e.g., /r/:linkId or /s/:customSlug
// Example: router.get('/r/:linkIdOrSlug', publicCollectorController.accessSurveyViaLink);
// This would need a separate controller and logic to find the collector by linkId/slug
// and then serve the survey.

module.exports = router;
// ----- END OF COMPLETE UPDATED FILE (v1.1 - Auth Handled by Parent Router) -----