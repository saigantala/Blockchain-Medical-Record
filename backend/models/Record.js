const mongoose = require("mongoose");
const crypto = require("crypto");

const recordSchema = new mongoose.Schema(
    {
        patientId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        fileName: {
            type: String,
            required: true,
        },
        originalName: {
            type: String,
            required: true,
        },
        fileHash: {
            type: String,
            required: true,
            comment: "SHA-256 hash of file contents for integrity verification",
        },
        // Stored as hex bytes32 for blockchain anchoring
        fileHashBytes32: {
            type: String,
        },
        fileSize: {
            type: Number,
        },
        mimeType: {
            type: String,
        },
        // Where the file lives: local disk path or IPFS CID
        fileUrl: {
            type: String,
            required: true,
        },
        storageType: {
            type: String,
            enum: ["local", "ipfs", "gridfs"],
            default: "local",
        },
        description: {
            type: String,
            default: "",
        },
        // Whether hash was anchored on the blockchain
        onChain: {
            type: Boolean,
            default: false,
        },
        blockchainTxHash: {
            type: String,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Record", recordSchema);
