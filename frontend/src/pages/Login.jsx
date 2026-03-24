import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { connectWallet } from "../services/blockchain";
import "./Auth.css";

export default function Login() {
    const [authMethod, setAuthMethod] = useState("email"); // "email" or "web3"
    const [form, setForm] = useState({ email: "", password: "" });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const { loadSession } = useAuth();
    const navigate = useNavigate();

    const submit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            if (authMethod === "email") {
                const users = JSON.parse(localStorage.getItem("medchain_users") || "[]");
                const user = users.find(u => u.email === form.email && u.password === form.password);
                if (!user) throw new Error("Invalid email or password");
                
                localStorage.setItem("medchain_session", form.email);
                window.location.href = "/";
                return;
            }

            // Web3 login
            const addr = await connectWallet();
            // AuthContext's loadSession checks if the user is registered on-chain
            await loadSession(addr);
            // After loading, the user state will be updated and App.jsx will route them
            // We just navigate to root and RootRedirect takes over
            navigate("/");
        } catch (err) {
            setError(err.message || "Failed to connect to MetaMask");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-orb auth-orb-1" />
            <div className="auth-orb auth-orb-2" />

            <div className="auth-card card animate-in">
                <div className="auth-logo">
                    <span className="logo-icon">⛓</span>
                    <h1 className="gradient-text">MedChain</h1>
                    <p className="auth-subtitle">Blockchain Medical Records</p>
                </div>

                <h2 className="auth-title">Welcome Back</h2>
                <p className="text-muted text-sm mt-1">Connect your wallet to sign in</p>

                {error && <div className="alert alert-error mt-2">{error}</div>}

                <div className="tab-bar" style={{ marginBottom: "1rem" }}>
                    <button type="button" className={`tab-btn ${authMethod === 'email' ? 'tab-btn--active' : ''}`} onClick={() => setAuthMethod("email")}>✉️ Email</button>
                    <button type="button" className={`tab-btn ${authMethod === 'web3' ? 'tab-btn--active' : ''}`} onClick={() => setAuthMethod("web3")}>🦊 MetaMask</button>
                </div>

                <form onSubmit={submit} className="auth-form" style={{ marginTop: '1rem' }}>
                    {authMethod === "email" && (
                        <>
                            <div className="form-group">
                                <label className="form-label">Email</label>
                                <input className="form-input" type="email" placeholder="john@example.com" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Password</label>
                                <input className="form-input" type="password" placeholder="••••••••" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required />
                            </div>
                        </>
                    )}

                    <button className="btn btn-primary btn-lg w-full" disabled={loading} style={{ marginTop: '1rem' }}>
                        {loading ? <span className="spinner" /> : (authMethod === "email" ? "✉️ Log in with Email" : "🦊 Connect MetaMask")}
                    </button>
                </form>

                <p className="auth-footer text-muted" style={{ marginTop: '2rem' }}>
                    Note: There is no password. Your identity is your wallet address. <br />If you haven't registered yet, please do so below.
                </p>

                <p className="auth-footer">
                    Don't have an account?{" "}
                    <Link to="/register" className="auth-link">Register here</Link>
                </p>
            </div>
        </div>
    );
}
