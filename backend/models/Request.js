const mongoose = require("mongoose");

const requestSchema = new mongoose.Schema(
    {
        doctorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        patientId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        status: {
            type: String,
            enum: ["pending", "approved", "rejected"],
            default: "pending",
        },
        message: {
            type: String,
            default: "",
            comment: "Optional message from doctor to patient",
        },
        // Blockchain tx hashes for on-chain events
        requestTxHash: {
            type: String,
            comment: "Tx hash of AccessRequested event",
        },
        approveTxHash: {
            type: String,
            comment: "Tx hash of AccessGranted event",
        },
        revokeTxHash: {
            type: String,
            comment: "Tx hash of AccessRevoked event",
        },
        respondedAt: {
            type: Date,
        },
    },
    { timestamps: true }
);

// Prevent duplicate pending requests from same doctor to same patient
requestSchema.index({ doctorId: 1, patientId: 1, status: 1 });

module.exports = mongoose.model("Request", requestSchema);
