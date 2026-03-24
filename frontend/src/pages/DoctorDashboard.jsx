import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import {
    getAllPatients,
    requestAccess,
    getDoctorRequestHistory,
    getRecordsOnChain,
    getUserProfile,
    shortenAddress
} from "../services/blockchain";
import { getIPFSGatewayUrl } from "../services/ipfs";
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

    useEffect(() => {
        if (walletAddress) {
            fetchMyRequests();
            loadPatients();
        }
    }, [walletAddress]);

    const showMsg = (type, text) => {
        setMsg({ type, text });
        setTimeout(() => setMsg({ type: "", text: "" }), 5000);
    };

    const loadPatients = async () => {
        try {
            const allPatients = await getAllPatients();
            setPatients(allPatients);
        } catch { }
    };

    const fetchMyRequests = async () => {
        try {
            const { reqLogs, grantLogs, revokeLogs } = await getDoctorRequestHistory(walletAddress);
            
            // Build current state per patient
            const patientStatus = {}; // address -> "pending" | "approved"
            const patientTimestamps = {};
            
            reqLogs.forEach(log => {
                const patAddr = log.args[1]; 
                patientStatus[patAddr] = "pending";
                patientTimestamps[patAddr] = Number(log.args[2]) * 1000;
            });
            
            grantLogs.forEach(log => {
                const patAddr = log.args[1];
                patientStatus[patAddr] = "approved";
                patientTimestamps[patAddr] = Number(log.args[2]) * 1000;
            });
            
            revokeLogs.forEach(log => {
                const patAddr = log.args[1];
                delete patientStatus[patAddr];
            });

            // Fetch patient profiles
            const requestObjects = [];
            for (const [patAddr, status] of Object.entries(patientStatus)) {
                let name = "Unknown Patient";
                try {
                    const profile = await getUserProfile(patAddr);
                    if (profile && profile.name) name = profile.name;
                } catch(e) {}
                
                requestObjects.push({
                    _id: patAddr,
                    patientId: { walletAddress: patAddr, name, _id: patAddr },
                    status,
                    createdAt: patientTimestamps[patAddr]
                });
            }
            setMyRequests(requestObjects.sort((a,b) => b.createdAt - a.createdAt));
        } catch(err) {
            console.error("Failed to fetch requests", err);
        }
    };

    const filteredPatients = patients.filter(
        (p) =>
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.address || "").toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleRequestAccess = async (patient) => {
        setActionLoading((p) => ({ ...p, [patient.address]: true }));
        try {
            await requestAccess(patient.address);
            showMsg("success", `Access requested from ${patient.name}. They will be notified.`);
            fetchMyRequests();
        } catch (err) {
            showMsg("error", err.message || "Request failed");
        } finally {
            setActionLoading((p) => ({ ...p, [patient.address]: false }));
        }
    };

    const handleViewRecords = async (req) => {
        try {
            const hashes = await getRecordsOnChain(req.patientId.walletAddress);
            const formattedRecords = hashes.map(hash => ({
                _id: hash,
                fileHash: hash,
                fileUrl: getIPFSGatewayUrl(hash),
                originalName: `IPFS Record: ${hash.slice(0, 8)}...`,
                onChain: true
            }));
            
            setViewingRecords({ patient: req.patientId, records: formattedRecords });
            setActiveTab("records");
        } catch (err) {
            showMsg("error", "Could not load records. Make sure access is still approved.");
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
                        <p className="text-muted">Welcome, <strong>Dr. {user?.name}</strong> {user?.isWeb2 && <span className="badge badge-green" style={{marginLeft: '10px'}}>Email User</span>}</p>
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
                                placeholder="Search by name or wallet address..."
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
                                        (r) => r.patientId?._id === p.address || r.patientId?.walletAddress === p.address
                                    );
                                    return (
                                        <div key={p.address} className="request-card card">
                                            <div className="request-info">
                                                <div className="doctor-avatar">🏥</div>
                                                <div>
                                                    <h4>{p.name}</h4>
                                                    <p className="text-sm text-muted wallet-text">
                                                        🦊 {shortenAddress(p.address)}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="request-controls">
                                                <button
                                                    className="btn btn-primary btn-sm"
                                                    onClick={() => handleRequestAccess(p)}
                                                    disabled={actionLoading[p.address] || alreadyRequested}
                                                >
                                                    {actionLoading[p.address] ? (
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
                                                <p className="text-sm text-muted">{shortenAddress(req.patientId?.walletAddress)}</p>
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
                                        viewingRecords.records.map((r, i) => (
                                            <div key={i} className="record-card card">
                                                <div className="record-icon">
                                                    📄
                                                </div>
                                                <div className="record-info">
                                                    <h4 className="truncate">{r.originalName}</h4>
                                                    <p className="text-sm text-muted hash-text" style={{ marginTop: '0.5rem' }}>
                                                        IPFS CID: {r.fileHash?.slice(0, 16) || "N/A"}...
                                                    </p>
                                                    <div className="record-meta">
                                                        <span className="badge badge-green">⛓ On-Chain</span>
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
