const crypto = require("crypto");
const { GridFSBucket, ObjectId } = require("mongodb");
const mongoose = require("mongoose");
const Record = require("../models/Record");
const Request = require("../models/Request");

// POST /api/records/upload  (multipart/form-data, field: "file")
const uploadRecord = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
    }

    const { description, blockchainTxHash } = req.body;

    // Compute SHA-256 hash from file buffer
    const fileHash = crypto.createHash("sha256").update(req.file.buffer).digest("hex");
    const fileHashBytes32 = "0x" + fileHash;

    // Save strictly to GridFS
    const bucket = new GridFSBucket(mongoose.connection.db, { bucketName: "medical_records" });
    const uploadStream = bucket.openUploadStream(req.file.originalname, {
        contentType: req.file.mimetype,
    });
    uploadStream.end(req.file.buffer);

    // Wait for the upload stream to finish to get the file ID
    await new Promise((resolve, reject) => {
        uploadStream.on("finish", resolve);
        uploadStream.on("error", reject);
    });

    const gridFsFileId = uploadStream.id;

    const record = await Record.create({
        patientId: req.user._id,
        fileName: gridFsFileId.toString(), // Store GridFS ID here
        originalName: req.file.originalname,
        fileHash,
        fileHashBytes32,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        fileUrl: `/api/records/download/${gridFsFileId.toString()}`,
        storageType: "gridfs",
        description: description || "",
        onChain: !!blockchainTxHash,
        blockchainTxHash: blockchainTxHash || null,
    });

    res.status(201).json({
        message: "Record uploaded successfully to GridFS",
        record,
    });
};

// GET /api/records/download/:fileId  — Stream file from GridFS
const downloadRecord = async (req, res) => {
    try {
        const fileId = req.params.fileId;
        
        // Find the record to verify access control
        const record = await Record.findOne({ fileName: fileId });
        if (!record) {
            return res.status(404).json({ message: "Record not found" });
        }

        // Access Control
        let hasAccess = false;
        if (req.user._id.toString() === record.patientId.toString()) {
            hasAccess = true;
        } else if (req.user.role === "doctor") {
            const approved = await Request.findOne({
                doctorId: req.user._id,
                patientId: record.patientId,
                status: "approved",
            });
            if (approved) hasAccess = true;
        }

        if (!hasAccess) {
            return res.status(403).json({ message: "Not authorized to download this record" });
        }

        const bucket = new GridFSBucket(mongoose.connection.db, { bucketName: "medical_records" });
        const downloadStream = bucket.openDownloadStream(new ObjectId(fileId));

        res.set("Content-Type", record.mimeType);
        res.set("Content-Disposition", `inline; filename="${record.originalName}"`);
        
        downloadStream.on("error", () => {
             res.status(404).send("File not found in GridFS");
        });

        downloadStream.pipe(res);
    } catch (error) {
        console.error("Download Error:", error);
        res.status(500).json({ message: "Error downloading file" });
    }
};

// GET /api/records/:patientId  — returns list of records
const getRecords = async (req, res) => {
    const { patientId } = req.params;

    if (req.user._id.toString() === patientId) {
        const records = await Record.find({ patientId }).sort({ createdAt: -1 });
        return res.json({ records });
    }

    if (req.user.role === "doctor") {
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

// GET /api/records/my
const getMyRecords = async (req, res) => {
    const records = await Record.find({ patientId: req.user._id }).sort({ createdAt: -1 });
    res.json({ records });
};

// PATCH /api/records/:id/anchor
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

    // Delete from GridFS
    try {
        const bucket = new GridFSBucket(mongoose.connection.db, { bucketName: "medical_records" });
        await bucket.delete(new ObjectId(record.fileName));
    } catch (err) {
        console.log("File might have been already deleted from GridFS", err.message);
    }

    await record.deleteOne();
    res.json({ message: "Record deleted" });
};

module.exports = { uploadRecord, downloadRecord, getRecords, getMyRecords, anchorRecord, deleteRecord };
