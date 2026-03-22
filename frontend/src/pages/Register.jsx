import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register as registerApi } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { connectWallet } from "../services/blockchain";
import "./Auth.css";

export default function Register() {
    const [form, setForm] = useState({
        name: "",
        email: "",
        password: "",
        role: "patient",
        specialization: "",
        licenseNumber: "",
        walletAddress: "",
    });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [connectingWallet, setConnectingWallet] = useState(false);
    const { loginUser } = useAuth();
    const navigate = useNavigate();

    const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleConnectWallet = async () => {
        setConnectingWallet(true);
        try {
            const addr = await connectWallet();
            setForm((f) => ({ ...f, walletAddress: addr }));
        } catch (err) {
            alert(err.message);
        } finally {
            setConnectingWallet(false);
        }
    };

    const validate = () => {
        if (form.password.length < 6) {
            setError("Password must be at least 6 characters");
            return false;
        }
        // Basic email regex
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
            setError("Invalid email address");
            return false;
        }
        return true;
    };

    const submit = async (e) => {
        e.preventDefault();
        if (!validate()) return;
        setError("");
        setLoading(true);
        try {
            const { data } = await registerApi(form);
            loginUser(data.token, data.user);
            navigate(data.user.role === "patient" ? "/patient" : "/doctor");
        } catch (err) {
            if (err.response?.status === 500) {
                setError("Server Error (500): Database connection failed. Please check backend logs.");
            } else {
                setError(err.response?.data?.message || "Registration failed. Try with different email.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-orb auth-orb-1" />
            <div className="auth-orb auth-orb-2" />

            <div className="auth-card auth-card--wide card animate-in">
                <div className="auth-logo">
                    <span className="logo-icon">⛓</span>
                    <h1 className="gradient-text">MedChain</h1>
                    <p className="auth-subtitle">Blockchain Medical Records</p>
                </div>

                <h2 className="auth-title">Create Account</h2>

                {error && <div className="alert alert-error mt-2">{error}</div>}

                <form onSubmit={submit} className="auth-form">
                    {/* Role selector */}
                    <div className="role-selector">
                        {["patient", "doctor"].map((r) => (
                            <button
                                key={r}
                                type="button"
                                className={`role-btn ${form.role === r ? "role-btn--active" : ""}`}
                                onClick={() => setForm({ ...form, role: r })}
                            >
                                {r === "patient" ? "🏥 Patient" : "👨‍⚕️ Doctor"}
                            </button>
                        ))}
                    </div>

                    <div className="form-grid">
                        <div className="form-group">
                            <label className="form-label">Full Name</label>
                            <input className="form-input" name="name" placeholder="John Doe" value={form.name} onChange={handle} required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Email</label>
                            <input className="form-input" type="email" name="email" placeholder="email@example.com" value={form.email} onChange={handle} required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Password</label>
                            <input className="form-input" type="password" name="password" placeholder="Min 6 characters" value={form.password} onChange={handle} required minLength={6} />
                        </div>

                        {form.role === "doctor" && (
                            <>
                                <div className="form-group">
                                    <label className="form-label">Specialization</label>
                                    <input className="form-input" name="specialization" placeholder="Cardiology, Neurology..." value={form.specialization} onChange={handle} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">License Number</label>
                                    <input className="form-input" name="licenseNumber" placeholder="MED-12345" value={form.licenseNumber} onChange={handle} />
                                </div>
                            </>
                        )}

                        {/* Wallet */}
                        <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                            <label className="form-label">MetaMask Wallet (optional)</label>
                            <div className="wallet-input-row">
                                <input
                                    className="form-input"
                                    name="walletAddress"
                                    placeholder="0x..."
                                    value={form.walletAddress}
                                    onChange={handle}
                                    style={{ flex: 1 }}
                                />
                                <button type="button" className="btn btn-outline btn-sm" onClick={handleConnectWallet} disabled={connectingWallet}>
                                    {connectingWallet ? <span className="spinner" /> : "🦊 Connect"}
                                </button>
                            </div>
                        </div>
                    </div>

                    <button className="btn btn-primary btn-lg w-full" disabled={loading}>
                        {loading ? <span className="spinner" /> : "Create Account"}
                    </button>
                </form>

                <p className="auth-footer">
                    Already have an account?{" "}
                    <Link to="/login" className="auth-link">Sign in</Link>
                </p>
            </div>
        </div>
    );
}
