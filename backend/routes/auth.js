const express = require("express");
const router = express.Router();
const {
    register,
    login,
    linkWallet,
    getMe,
    getUsers,
} = require("../controllers/authController");
const { protect } = require("../middleware/auth");

router.post("/register", register);
router.post("/login", login);
router.get("/me", protect, getMe);
router.put("/wallet", protect, linkWallet);
router.get("/users", protect, getUsers);

module.exports = router;
