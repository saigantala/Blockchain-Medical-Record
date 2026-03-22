const jwt = require("jsonwebtoken");
const User = require("../models/User");

const signToken = (id) =>
    jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    });

// POST /api/auth/register
const register = async (req, res) => {
    const { name, email, password, role, walletAddress, specialization, licenseNumber } = req.body;

    if (!name || !email || !password || !role) {
        return res.status(400).json({ message: "Name, email, password, and role are required" });
    }

    const existing = await User.findOne({ email });
    if (existing) {
        return res.status(409).json({ message: "Email already registered" });
    }

    const user = await User.create({
        name,
        email,
        passwordHash: password, // will be hashed by pre-save hook
        role,
        walletAddress: walletAddress ? walletAddress.toLowerCase() : undefined,
        specialization,
        licenseNumber,
    });

    const token = signToken(user._id);

    res.status(201).json({
        message: "Registration successful",
        token,
        user,
    });
};

// POST /api/auth/login
const login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email }).select("+passwordHash");
    if (!user || !(await user.comparePassword(password))) {
        return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = signToken(user._id);

    res.json({
        message: "Login successful",
        token,
        user: user.toJSON(),
    });
};

// PUT /api/auth/wallet  — link a MetaMask wallet to user account
const linkWallet = async (req, res) => {
    const { walletAddress } = req.body;

    if (!walletAddress) {
        return res.status(400).json({ message: "Wallet address is required" });
    }

    // Check wallet not already used
    const existing = await User.findOne({
        walletAddress: walletAddress.toLowerCase(),
        _id: { $ne: req.user._id },
    });
    if (existing) {
        return res.status(409).json({ message: "Wallet already linked to another account" });
    }

    req.user.walletAddress = walletAddress.toLowerCase();
    await req.user.save({ validateBeforeSave: false });

    res.json({ message: "Wallet linked successfully", user: req.user });
};

// GET /api/auth/me
const getMe = async (req, res) => {
    res.json({ user: req.user });
};

// GET /api/auth/users?role=doctor  — search users by role (for patient to find doctors, etc.)
const getUsers = async (req, res) => {
    const { role } = req.query;
    const filter = {};
    if (role) filter.role = role;
    const users = await User.find(filter).select("name email role walletAddress specialization");
    res.json({ users });
};

module.exports = { register, login, linkWallet, getMe, getUsers };
