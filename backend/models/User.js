const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Name is required"],
            trim: true,
        },
        email: {
            type: String,
            required: [true, "Email is required"],
            unique: true,
            lowercase: true,
            trim: true,
        },
        passwordHash: {
            type: String,
            required: [true, "Password is required"],
        },
        role: {
            type: String,
            enum: ["patient", "doctor", "admin"],
            required: [true, "Role is required"],
        },
        walletAddress: {
            type: String,
            unique: true,
            sparse: true, // allow null for users without wallets yet
            lowercase: true,
        },
        // Doctor-specific
        specialization: { type: String },
        licenseNumber: { type: String },
        // Patient-specific
        dateOfBirth: { type: Date },
        bloodGroup: { type: String },
    },
    { timestamps: true }
);

// Hash password before saving
userSchema.pre("save", async function (next) {
    if (!this.isModified("passwordHash")) return next();
    this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
    next();
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Never return passwordHash
userSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.passwordHash;
    return obj;
};

module.exports = mongoose.model("User", userSchema);
