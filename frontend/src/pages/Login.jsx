import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login as loginApi } from "../services/api";
import { useAuth } from "../context/AuthContext";
import "./Auth.css";

export default function Login() {
    const [form, setForm] = useState({ email: "", password: "" });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const { loginUser } = useAuth();
    const navigate = useNavigate();

    const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const validate = () => {
        if (!form.email || !form.password) {
            setError("Please fill in all fields");
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
            const { data } = await loginApi(form);
            loginUser(data.token, data.user);
            navigate(data.user.role === "patient" ? "/patient" : "/doctor");
        } catch (err) {
            if (err.response?.status === 500) {
                setError("Server Error (500): Database connection failed. Please check backend logs.");
            } else {
                setError(err.response?.data?.message || "Login failed. Check your credentials.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            {/* Background orbs */}
            <div className="auth-orb auth-orb-1" />
            <div className="auth-orb auth-orb-2" />

            <div className="auth-card card animate-in">
                <div className="auth-logo">
                    <span className="logo-icon">⛓</span>
                    <h1 className="gradient-text">MedChain</h1>
                    <p className="auth-subtitle">Blockchain Medical Records</p>
                </div>

                <h2 className="auth-title">Welcome Back</h2>
                <p className="text-muted text-sm mt-1">Sign in to your account to continue</p>

                {error && <div className="alert alert-error mt-2">{error}</div>}

                <form onSubmit={submit} className="auth-form">
                    <div className="form-group">
                        <label className="form-label">Email</label>
                        <input
                            className="form-input"
                            type="email"
                            name="email"
                            placeholder="doctor@hospital.com"
                            value={form.email}
                            onChange={handle}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <input
                            className="form-input"
                            type="password"
                            name="password"
                            placeholder="••••••••"
                            value={form.password}
                            onChange={handle}
                            required
                        />
                    </div>

                    <button className="btn btn-primary btn-lg w-full" disabled={loading}>
                        {loading ? <span className="spinner" /> : "Sign In"}
                    </button>
                </form>

                <p className="auth-footer">
                    Don't have an account?{" "}
                    <Link to="/register" className="auth-link">Register here</Link>
                </p>
            </div>
        </div>
    );
}
