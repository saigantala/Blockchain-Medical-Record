import React, { createContext, useContext, useState, useEffect } from "react";
import { getMe } from "../services/api";
import { getConnectedAddress } from "../services/blockchain";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [walletAddress, setWalletAddress] = useState(null);
    const [loading, setLoading] = useState(true);

    // Restore session on mount
    useEffect(() => {
        const restore = async () => {
            const token = localStorage.getItem("token");
            if (token) {
                try {
                    const { data } = await getMe();
                    setUser(data.user);
                } catch {
                    localStorage.removeItem("token");
                    localStorage.removeItem("user");
                }
            }

            // Check MetaMask
            const addr = await getConnectedAddress();
            if (addr) setWalletAddress(addr);

            setLoading(false);
        };
        restore();

        // Listen for MetaMask account changes
        if (window.ethereum) {
            window.ethereum.on("accountsChanged", (accounts) => {
                setWalletAddress(accounts[0] || null);
            });
        }
    }, []);

    const loginUser = (token, userData) => {
        localStorage.setItem("token", token);
        setUser(userData);
    };

    const logoutUser = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setUser(null);
    };

    return (
        <AuthContext.Provider
            value={{ user, walletAddress, setWalletAddress, loading, loginUser, logoutUser }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}
