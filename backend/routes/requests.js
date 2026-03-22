const express = require("express");
const router = express.Router();
const {
    createRequest,
    getPatientRequests,
    getDoctorRequests,
    approveRequest,
    rejectRequest,
    revokeRequest,
} = require("../controllers/requestController");
const { protect, requireRole } = require("../middleware/auth");

// Doctor creates a request
router.post("/", protect, requireRole("doctor"), createRequest);

// Patient views their incoming requests
router.get("/patient/:id", protect, getPatientRequests);

// Doctor views their outgoing requests
router.get("/doctor/:id", protect, getDoctorRequests);

// Patient manages requests
router.put("/:id/approve", protect, requireRole("patient"), approveRequest);
router.put("/:id/reject", protect, requireRole("patient"), rejectRequest);
router.put("/:id/revoke", protect, requireRole("patient"), revokeRequest);

module.exports = router;
