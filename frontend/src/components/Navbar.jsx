import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { connectWallet, shortenAddress } from "../services/blockchain";
import { linkWallet } from "../services/api";
import "./Navbar.css";

export default function Navbar() {
    const { user, walletAddress, setWalletAddress, logoutUser } = useAuth();
    const navigate = useNavigate();
    const [connecting, setConnecting] = useState(false);

    const handleConnect = async () => {
        setConnecting(true);
        try {
            const addr = await connectWallet();
            setWalletAddress(addr);
            if (user) {
                await linkWallet(addr);
            }
        } catch (err) {
            alert(err.message);
        } finally {
            setConnecting(false);
        }
    };

    const handleLogout = () => {
        logoutUser();
        navigate("/login");
    };

    if (!user) return null;

    return (
        <nav className="navbar">
            <div className="container navbar-inner">
                {/* Logo */}
                <Link to="/" className="navbar-logo">
                    <span className="logo-icon">⛓</span>
                    <span className="logo-text gradient-text">MedChain</span>
                </Link>

                {/* Nav links */}
                <div className="navbar-links">
                    {user.role === "patient" && (
                        <>
                            <Link to="/patient" className="nav-link">Dashboard</Link>
                        </>
                    )}
                    {user.role === "doctor" && (
                        <>
                            <Link to="/doctor" className="nav-link">Dashboard</Link>
                        </>
                    )}
                </div>

                {/* Right side */}
                <div className="navbar-right">
                    {/* Role badge */}
                    <span className={`badge ${user.role === "doctor" ? "badge-purple" : "badge-cyan"}`}>
                        {user.role === "patient" ? "🏥 Patient" : "👨‍⚕️ Doctor"}
                    </span>

                    {/* Wallet button */}
                    {walletAddress ? (
                        <div className="wallet-badge">
                            <span className="wallet-dot"></span>
                            <span className="wallet-addr">{shortenAddress(walletAddress)}</span>
                        </div>
                    ) : (
                        <button className="btn btn-outline btn-sm" onClick={handleConnect} disabled={connecting}>
                            {connecting ? <span className="spinner" /> : "🦊 Connect Wallet"}
                        </button>
                    )}

                    {/* User & logout */}
                    <div className="user-menu">
                        <span className="user-name">{user.name}</span>
                        <button className="btn btn-sm btn-danger" onClick={handleLogout}>
                            Logout
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    );
}
