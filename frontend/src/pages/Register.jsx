import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { connectWallet, registerOnChain } from "../services/blockchain";
import "./Auth.css";

export default function Register() {
    const [authMethod, setAuthMethod] = useState("email"); // "email" or "web3"
    const [form, setForm] = useState({
        name: "",
        role: "patient",
        email: "",
        password: ""
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
        if (authMethod === "email" && (!form.email || form.password.length < 6)) {
            setError("Please enter a valid email and password (min 6 chars)");
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
            if (authMethod === "email") {
                const users = JSON.parse(localStorage.getItem("medchain_users") || "[]");
                if (users.find(u => u.email === form.email)) {
                    throw new Error("Email is already registered!");
                }
                const newUser = { email: form.email, password: form.password, name: form.name, role: form.role };
                users.push(newUser);
                localStorage.setItem("medchain_users", JSON.stringify(users));
                localStorage.setItem("medchain_session", form.email);
                
                window.location.href = "/"; // Force full reload to trigger Web2 session logic
                return;
            }

            // Web3 Registration
            const addr = await connectWallet();
            await registerOnChain(form.name, form.role);
            await loadSession(addr);
            navigate("/");
        } catch (err) {
            console.error(err);
            if (err.code === "ACTION_REJECTED" || err.code === 4001) {
                setError("Transaction cancelled. You rejected the request in MetaMask.");
            } else {
                setError("Registration failed. " + (err.shortMessage || err.message || "Unknown error."));
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
                <p className="text-muted text-sm mt-1" style={{ textAlign: 'center' }}>
                    Your account is permanently linked to your Wallet Address.
                </p>

                {error && <div className="alert alert-error mt-2">{error}</div>}

                <div className="tab-bar" style={{ marginBottom: "1rem" }}>
                    <button type="button" className={`tab-btn ${authMethod === 'email' ? 'tab-btn--active' : ''}`} onClick={() => setAuthMethod("email")}>✉️ Email</button>
                    <button type="button" className={`tab-btn ${authMethod === 'web3' ? 'tab-btn--active' : ''}`} onClick={() => setAuthMethod("web3")}>🦊 MetaMask</button>
                </div>

                <form onSubmit={submit} className="auth-form">
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

                    {authMethod === "email" && (
                        <>
                            <div className="form-group">
                                <label className="form-label">Email</label>
                                <input className="form-input" type="email" name="email" placeholder="john@example.com" value={form.email} onChange={handle} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Password</label>
                                <input className="form-input" type="password" name="password" placeholder="••••••••" value={form.password} onChange={handle} required />
                            </div>
                        </>
                    )}

                    <button className="btn btn-primary btn-lg w-full" disabled={loading} style={{ marginTop: '1rem' }}>
                        {loading ? <span className="spinner" /> : (authMethod === "email" ? "✉️ Register with Email" : "🦊 Connect & Register on Blockchain")}
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
