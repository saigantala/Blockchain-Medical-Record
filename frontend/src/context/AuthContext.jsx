import React, { createContext, useContext, useState, useEffect } from "react";
import { getConnectedAddress, getUserProfile } from "../services/blockchain";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [walletAddress, setWalletAddress] = useState(null);
    const [loading, setLoading] = useState(true);

    const loadSession = async (address) => {
        if (!address) {
            setUser(null);
            setLoading(false);
            return;
        }

        try {
            const profile = await getUserProfile(address);
            if (profile.isRegistered) {
                setUser({
                    name: profile.name,
                    role: profile.role,
                    walletAddress: address
                });
            } else {
                setUser(null);
            }
        } catch (error) {
            console.error("Error loading profile from blockchain:", error);
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    // Restore session on mount
    useEffect(() => {
        const checkConnection = async () => {
            try {
                const addr = await getConnectedAddress();
                setWalletAddress(addr);
                await loadSession(addr);
            } catch (err) {
                setLoading(false);
            }
        };
        checkConnection();

        // Listen for MetaMask account changes
        if (window.ethereum) {
            window.ethereum.on("accountsChanged", (accounts) => {
                const newAddr = accounts[0] || null;
                setWalletAddress(newAddr);
                setLoading(true);
                loadSession(newAddr);
            });
        }
    }, []);

    const loginUser = (userData) => {
        setUser(userData);
    };

    const logoutUser = () => {
        setUser(null);
        // Dapps can't explicitly disconnect metamask, but app side we just clear state
    };

    return (
        <AuthContext.Provider
            value={{ user, walletAddress, setWalletAddress, loading, loginUser, logoutUser, loadSession }}
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
