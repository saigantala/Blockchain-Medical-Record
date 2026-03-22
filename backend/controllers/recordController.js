const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const Record = require("../models/Record");
const User = require("../models/User");

// POST /api/records/upload  (multipart/form-data, field: "file")
const uploadRecord = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
    }

    const { description, blockchainTxHash } = req.body;

    // Compute SHA-256 hash from file buffer
    const fileBuffer = fs.readFileSync(req.file.path);
    const fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
    // Pad to bytes32 format for on-chain use
    const fileHashBytes32 = "0x" + fileHash;

    const record = await Record.create({
        patientId: req.user._id,
        fileName: req.file.filename,
        originalName: req.file.originalname,
        fileHash,
        fileHashBytes32,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        fileUrl: `/uploads/${req.file.filename}`,
        storageType: "local",
        description: description || "",
        onChain: !!blockchainTxHash,
        blockchainTxHash: blockchainTxHash || null,
    });

    res.status(201).json({
        message: "Record uploaded successfully",
        record,
    });
};

// GET /api/records/:patientId  — returns list of records (requester must be the patient or an approved doctor)
const getRecords = async (req, res) => {
    const { patientId } = req.params;

    // If requester is the patient themselves
    if (req.user._id.toString() === patientId) {
        const records = await Record.find({ patientId }).sort({ createdAt: -1 });
        return res.json({ records });
    }

    // If requester is a doctor, verify they have an approved request
    if (req.user.role === "doctor") {
        const Request = require("../models/Request");
        const approved = await Request.findOne({
            doctorId: req.user._id,
            patientId,
            status: "approved",
        });
        if (!approved) {
            return res.status(403).json({ message: "Access not approved by patient" });
        }
        const records = await Record.find({ patientId }).sort({ createdAt: -1 });
        return res.json({ records });
    }

    return res.status(403).json({ message: "Not authorized to view these records" });
};

// GET /api/records/my  — shortcut for logged-in patient's own records
const getMyRecords = async (req, res) => {
    const records = await Record.find({ patientId: req.user._id }).sort({ createdAt: -1 });
    res.json({ records });
};

// PATCH /api/records/:id/anchor  — update record with blockchain tx hash after on-chain anchoring
const anchorRecord = async (req, res) => {
    const { blockchainTxHash } = req.body;
    const record = await Record.findOne({ _id: req.params.id, patientId: req.user._id });

    if (!record) {
        return res.status(404).json({ message: "Record not found" });
    }

    record.onChain = true;
    record.blockchainTxHash = blockchainTxHash;
    await record.save();

    res.json({ message: "Record anchored on blockchain", record });
};

// DELETE /api/records/:id
const deleteRecord = async (req, res) => {
    const record = await Record.findOne({ _id: req.params.id, patientId: req.user._id });
    if (!record) {
        return res.status(404).json({ message: "Record not found or not owned by you" });
    }

    // Remove physical file
    const filePath = path.join(__dirname, "../uploads", record.fileName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await record.deleteOne();
    res.json({ message: "Record deleted" });
};

module.exports = { uploadRecord, getRecords, getMyRecords, anchorRecord, deleteRecord };
