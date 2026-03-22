import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import {
    getUsers,
    createRequest,
    getDoctorRequests,
    getPatientRecords,
} from "../services/api";
import {
    requestAccess,
    registerOnChain,
    shortenAddress,
} from "../services/blockchain";
import AccessLog from "../components/AccessLog";
import "./Dashboard.css";

export default function DoctorDashboard() {
    const { user, walletAddress } = useAuth();

    const [activeTab, setActiveTab] = useState("search");
    const [searchQuery, setSearchQuery] = useState("");
    const [patients, setPatients] = useState([]);
    const [myRequests, setMyRequests] = useState([]);
    const [viewingRecords, setViewingRecords] = useState(null); // { patientId, records }
    const [actionLoading, setActionLoading] = useState({});
    const [msg, setMsg] = useState({ type: "", text: "" });
    const [registering, setRegistering] = useState(false);

    useEffect(() => {
        fetchMyRequests();
        loadPatients();
    }, []);

    const showMsg = (type, text) => {
        setMsg({ type, text });
        setTimeout(() => setMsg({ type: "", text: "" }), 5000);
    };

    const loadPatients = async () => {
        try {
            const { data } = await getUsers("patient");
            setPatients(data.users);
        } catch { }
    };

    const fetchMyRequests = async () => {
        try {
            const { data } = await getDoctorRequests(user._id);
            setMyRequests(data.requests);
        } catch { }
    };

    const filteredPatients = patients.filter(
        (p) =>
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.walletAddress || "").toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleRequestAccess = async (patient) => {
        setActionLoading((p) => ({ ...p, [patient._id]: true }));
        try {
            let txHash = null;
            if (walletAddress && patient.walletAddress) {
                const receipt = await requestAccess(patient.walletAddress);
                txHash = receipt.hash;
            }
            await createRequest({ patientId: patient._id, requestTxHash: txHash });
            showMsg("success", `Access requested from ${patient.name}. They will be notified.`);
            fetchMyRequests();
        } catch (err) {
            showMsg("error", err.response?.data?.message || err.message || "Request failed");
        } finally {
            setActionLoading((p) => ({ ...p, [patient._id]: false }));
        }
    };

    const handleViewRecords = async (req) => {
        try {
            const { data } = await getPatientRecords(req.patientId._id);
            setViewingRecords({ patient: req.patientId, records: data.records });
            setActiveTab("records");
        } catch (err) {
            showMsg("error", "Could not load records. Make sure access is approved.");
        }
    };

    const handleRegisterOnChain = async () => {
        setRegistering(true);
        try {
            await registerOnChain("doctor");
            showMsg("success", "Registered as doctor on blockchain! ✅");
        } catch (err) {
            showMsg("error", err.message || "Blockchain registration failed");
        } finally {
            setRegistering(false);
        }
    };

    const approvedRequests = myRequests.filter((r) => r.status === "approved");
    const pendingRequests = myRequests.filter((r) => r.status === "pending");

    return (
        <div className="dashboard-page">
            <div className="container">
                {/* Header */}
                <div className="dashboard-header animate-in">
                    <div>
                        <h1>Doctor Dashboard</h1>
                        <p className="text-muted">Welcome, <strong>Dr. {user.name}</strong></p>
                    </div>
                    <div className="header-actions">
                        {walletAddress && (
                            <button
                                className="btn btn-outline btn-sm"
                                onClick={handleRegisterOnChain}
                                disabled={registering}
                            >
                                {registering ? <span className="spinner" /> : "⛓ Register on Chain"}
                            </button>
                        )}
                    </div>
                </div>

                {/* Stats */}
                <div className="stats-row animate-in">
                    <div className="stat-card card">
                        <div className="stat-value gradient-text">{patients.length}</div>
                        <div className="stat-label">Total Patients</div>
                    </div>
                    <div className="stat-card card">
                        <div className="stat-value" style={{ color: "var(--accent-amber)" }}>{pendingRequests.length}</div>
                        <div className="stat-label">Pending Requests</div>
                    </div>
                    <div className="stat-card card">
                        <div className="stat-value" style={{ color: "var(--accent-green)" }}>{approvedRequests.length}</div>
                        <div className="stat-label">Approved Access</div>
                    </div>
                </div>

                {/* Alert */}
                {msg.text && (
                    <div className={`alert alert-${msg.type === "success" ? "success" : msg.type === "info" ? "info" : "error"} animate-in`}>
                        {msg.text}
                    </div>
                )}

                {/* Tabs */}
                <div className="tab-bar">
                    {["search", "requests", "records", "log"].map((t) => (
                        <button
                            key={t}
                            className={`tab-btn ${activeTab === t ? "tab-btn--active" : ""}`}
                            onClick={() => setActiveTab(t)}
                        >
                            {t === "search" && "🔍 Find Patients"}
                            {t === "requests" && `📋 My Requests ${myRequests.length > 0 ? `(${myRequests.length})` : ""}`}
                            {t === "records" && "📁 View Records"}
                            {t === "log" && "⛓ Blockchain Log"}
                        </button>
                    ))}
                </div>

                {/* ── Tab: Search Patients ── */}
                {activeTab === "search" && (
                    <div className="animate-in">
                        <div className="card search-card">
                            <h3>🔍 Search Patients</h3>
                            <input
                                className="form-input"
                                placeholder="Search by name, email, or wallet address..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{ marginTop: "1rem" }}
                            />
                        </div>
                        <div className="requests-list">
                            {filteredPatients.length === 0 ? (
                                <div className="empty-state">
                                    <span>👥</span>
                                    <p>No patients found.</p>
                                </div>
                            ) : (
                                filteredPatients.map((p) => {
                                    const alreadyRequested = myRequests.some(
                                        (r) => r.patientId?._id === p._id || r.patientId === p._id
                                    );
                                    return (
                                        <div key={p._id} className="request-card card">
                                            <div className="request-info">
                                                <div className="doctor-avatar">🏥</div>
                                                <div>
                                                    <h4>{p.name}</h4>
                                                    <p className="text-sm text-muted">{p.email}</p>
                                                    {p.walletAddress && (
                                                        <p className="text-sm text-muted wallet-text">
                                                            🦊 {shortenAddress(p.walletAddress)}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="request-controls">
                                                <button
                                                    className="btn btn-primary btn-sm"
                                                    onClick={() => handleRequestAccess(p)}
                                                    disabled={actionLoading[p._id] || alreadyRequested}
                                                >
                                                    {actionLoading[p._id] ? (
                                                        <span className="spinner" />
                                                    ) : alreadyRequested ? (
                                                        "✅ Requested"
                                                    ) : (
                                                        "Request Access"
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}

                {/* ── Tab: My Requests ── */}
                {activeTab === "requests" && (
                    <div className="animate-in">
                        {myRequests.length === 0 ? (
                            <div className="empty-state">
                                <span>📭</span>
                                <p>You haven't requested access to any patients yet.</p>
                            </div>
                        ) : (
                            <div className="requests-list">
                                {myRequests.map((req) => (
                                    <div key={req._id} className="request-card card">
                                        <div className="request-info">
                                            <div className="doctor-avatar">🏥</div>
                                            <div>
                                                <h4>{req.patientId?.name || "Unknown"}</h4>
                                                <p className="text-sm text-muted">{req.patientId?.email}</p>
                                                {req.patientId?.walletAddress && (
                                                    <p className="text-sm text-muted">{shortenAddress(req.patientId.walletAddress)}</p>
                                                )}
                                                <p className="text-sm text-muted">{new Date(req.createdAt).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <div className="request-controls">
                                            <span className={`badge ${req.status === "pending" ? "badge-amber" : req.status === "approved" ? "badge-green" : "badge-red"}`}>
                                                {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                                            </span>
                                            {req.status === "approved" && (
                                                <button
                                                    className="btn btn-outline btn-sm"
                                                    onClick={() => handleViewRecords(req)}
                                                >
                                                    📁 View Records
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ── Tab: View Records ── */}
                {activeTab === "records" && (
                    <div className="animate-in">
                        {!viewingRecords ? (
                            <div className="empty-state">
                                <span>📂</span>
                                <p>Go to "My Requests" and click "View Records" next to an approved request.</p>
                            </div>
                        ) : (
                            <>
                                <div className="card" style={{ marginBottom: "1.5rem" }}>
                                    <h3>Records for {viewingRecords.patient?.name}</h3>
                                    <p className="text-sm text-muted">{viewingRecords.patient?.email}</p>
                                    <button 
                                        className="btn btn-outline btn-sm" 
                                        onClick={() => setActiveTab("log")}
                                        style={{ marginTop: "1rem" }}
                                    >
                                        ⛓ Generate Live Blockchain Log
                                    </button>
                                </div>
                                <div className="records-grid">
                                    {viewingRecords.records.length === 0 ? (
                                        <div className="empty-state">
                                            <span>📭</span>
                                            <p>This patient has no records yet.</p>
                                        </div>
                                    ) : (
                                        viewingRecords.records.map((r) => (
                                            <div key={r._id} className="record-card card">
                                                <div className="record-icon">
                                                    {r.mimeType?.includes("pdf") ? "📄" : r.mimeType?.includes("image") ? "🖼" : "📋"}
                                                </div>
                                                <div className="record-info">
                                                    <h4 className="truncate">{r.originalName}</h4>
                                                    <button 
                                                        style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', color: 'var(--accent-blue)', textDecoration: 'underline' }} 
                                                        className="text-sm"
                                                        onClick={() => alert(`Medicine Description:\n\n${r.description || "No description provided."}`)}
                                                    >
                                                        Medicine Description 
                                                    </button>
                                                    <p className="text-sm text-muted hash-text" style={{ marginTop: '0.5rem' }}>
                                                        SHA-256: {r.fileHash?.slice(0, 16) || "N/A"}...
                                                    </p>
                                                    <div className="record-meta">
                                                        <span className="text-sm text-muted">
                                                            {new Date(r.createdAt).toLocaleDateString()}
                                                        </span>
                                                        {r.onChain ? (
                                                            <span className="badge badge-green">⛓ On-Chain</span>
                                                        ) : (
                                                            <span className="badge badge-amber">Off-Chain</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <a href={r.fileUrl} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">
                                                    View
                                                </a>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* ── Tab: Blockchain Log ── */}
                {activeTab === "log" && <AccessLog />}
            </div>
        </div>
    );
}
