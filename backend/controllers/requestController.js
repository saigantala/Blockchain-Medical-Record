const Request = require("../models/Request");
const User = require("../models/User");

// POST /api/requests  — doctor creates access request
const createRequest = async (req, res) => {
    const { patientId, message, requestTxHash } = req.body;

    if (!patientId) {
        return res.status(400).json({ message: "patientId is required" });
    }

    const patient = await User.findById(patientId);
    if (!patient || patient.role !== "patient") {
        return res.status(404).json({ message: "Patient not found" });
    }

    // Check if there's already a pending request
    const existing = await Request.findOne({
        doctorId: req.user._id,
        patientId,
        status: "pending",
    });
    if (existing) {
        return res.status(409).json({ message: "Access request already pending" });
    }

    const request = await Request.create({
        doctorId: req.user._id,
        patientId,
        message: message || "",
        requestTxHash,
    });

    await request.populate("doctorId", "name email specialization walletAddress");
    await request.populate("patientId", "name email walletAddress");

    res.status(201).json({ message: "Access request sent", request });
};

// GET /api/requests/patient/:id  — patient views incoming requests
const getPatientRequests = async (req, res) => {
    // Patient can only view their own
    if (req.user._id.toString() !== req.params.id && req.user.role !== "admin") {
        return res.status(403).json({ message: "Not authorized" });
    }

    const requests = await Request.find({ patientId: req.params.id })
        .populate("doctorId", "name email specialization walletAddress")
        .sort({ createdAt: -1 });

    res.json({ requests });
};

// GET /api/requests/doctor/:id  — doctor views their own requests
const getDoctorRequests = async (req, res) => {
    if (req.user._id.toString() !== req.params.id && req.user.role !== "admin") {
        return res.status(403).json({ message: "Not authorized" });
    }

    const requests = await Request.find({ doctorId: req.params.id })
        .populate("patientId", "name email walletAddress")
        .sort({ createdAt: -1 });

    res.json({ requests });
};

// PUT /api/requests/:id/approve
const approveRequest = async (req, res) => {
    const { approveTxHash } = req.body;
    const request = await Request.findById(req.params.id);

    if (!request) return res.status(404).json({ message: "Request not found" });
    if (request.patientId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: "Only the patient can approve this request" });
    }
    if (request.status !== "pending") {
        return res.status(400).json({ message: "Request is no longer pending" });
    }

    request.status = "approved";
    request.approveTxHash = approveTxHash;
    request.respondedAt = new Date();
    await request.save();

    await request.populate("doctorId", "name email specialization walletAddress");
    res.json({ message: "Request approved", request });
};

// PUT /api/requests/:id/reject
const rejectRequest = async (req, res) => {
    const request = await Request.findById(req.params.id);

    if (!request) return res.status(404).json({ message: "Request not found" });
    if (request.patientId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: "Only the patient can reject this request" });
    }
    if (request.status !== "pending") {
        return res.status(400).json({ message: "Request is no longer pending" });
    }

    request.status = "rejected";
    request.respondedAt = new Date();
    await request.save();

    res.json({ message: "Request rejected", request });
};

// PUT /api/requests/:id/revoke  — patient revokes a previously approved request
const revokeRequest = async (req, res) => {
    const { revokeTxHash } = req.body;
    const request = await Request.findById(req.params.id);

    if (!request) return res.status(404).json({ message: "Request not found" });
    if (request.patientId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: "Only the patient can revoke this request" });
    }
    if (request.status !== "approved") {
        return res.status(400).json({ message: "Can only revoke approved requests" });
    }

    request.status = "rejected";
    request.revokeTxHash = revokeTxHash;
    request.respondedAt = new Date();
    await request.save();

    res.json({ message: "Access revoked", request });
};

module.exports = {
    createRequest,
    getPatientRequests,
    getDoctorRequests,
    approveRequest,
    rejectRequest,
    revokeRequest,
};
