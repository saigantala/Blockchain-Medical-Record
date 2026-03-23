import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { connectWallet, registerOnChain } from "../services/blockchain";
import "./Auth.css";

export default function Register() {
    const [form, setForm] = useState({
        name: "",
        role: "patient"
    });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const { loadSession } = useAuth();
    const navigate = useNavigate();

    const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const validate = () => {
        if (!form.name || form.name.trim().length < 2) {
            setError("Please enter a valid name");
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
            // First connect wallet
            const addr = await connectWallet();
            // Then register them on blockchain
            await registerOnChain(form.name, form.role);
            
            // Reload context session
            await loadSession(addr);
            navigate("/");
        } catch (err) {
            setError(err.message || "Registration failed. Transaction might have been reverted.");
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
                <p className="text-muted text-sm mt-1" style={{ textAlign: 'center' }}>
                    Your account is permanently linked to your Wallet Address.
                </p>

                {error && <div className="alert alert-error mt-2">{error}</div>}

                <form onSubmit={submit} className="auth-form" style={{ marginTop: '2rem' }}>
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

                    <div className="form-group">
                        <label className="form-label">Full Name</label>
                        <input className="form-input" name="name" placeholder="John Doe" value={form.name} onChange={handle} required />
                    </div>

                    <button className="btn btn-primary btn-lg w-full" disabled={loading} style={{ marginTop: '1rem' }}>
                        {loading ? <span className="spinner" /> : "🦊 Connect & Register on Blockchain"}
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
