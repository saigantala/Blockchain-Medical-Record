const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const {
    uploadRecord,
    getRecords,
    getMyRecords,
    anchorRecord,
    deleteRecord,
} = require("../controllers/recordController");
const { protect, requireRole } = require("../middleware/auth");

// ── Multer storage config ────────────────────────────────────────────────────
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, "../uploads"));
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
});

const fileFilter = (req, file, cb) => {
    const allowed = [
        "image/jpeg",
        "image/png",
        "image/gif",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
    ];
    if (allowed.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`File type ${file.mimetype} not allowed`), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// ── Routes ───────────────────────────────────────────────────────────────────
router.post(
    "/upload",
    protect,
    requireRole("patient"),
    upload.single("file"),
    uploadRecord
);

router.get("/my", protect, requireRole("patient"), getMyRecords);
router.get("/:patientId", protect, getRecords);
router.patch("/:id/anchor", protect, requireRole("patient"), anchorRecord);
router.delete("/:id", protect, requireRole("patient"), deleteRecord);

module.exports = router;
