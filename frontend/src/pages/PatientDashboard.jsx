import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import {
    grantAccess,
    revokeAccess,
    addRecordOnChain,
    getRecordsOnChain,
    getRequestHistory,
    getUserProfile
} from "../services/blockchain";
import { uploadToIPFS, getIPFSGatewayUrl } from "../services/ipfs";
import AccessLog from "../components/AccessLog";
import "./Dashboard.css";

export default function PatientDashboard() {
    const { user, walletAddress } = useAuth();

    // Records state
    const [records, setRecords] = useState([]);
    const [requests, setRequests] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [uploadFile, setUploadFile] = useState(null);
    const [uploadDesc, setUploadDesc] = useState("");
    const [activeTab, setActiveTab] = useState("records");
    const [actionLoading, setActionLoading] = useState({});
    const [msg, setMsg] = useState({ type: "", text: "" });

    useEffect(() => {
        if (walletAddress) {
            fetchRecords();
            fetchRequests();
        }
    }, [walletAddress]);

    const showMsg = (type, text) => {
        setMsg({ type, text });
        setTimeout(() => setMsg({ type: "", text: "" }), 5000);
    };

    const fetchRecords = async () => {
        try {
            const hashes = await getRecordsOnChain(walletAddress);
            const formattedRecords = hashes.map(hash => ({
                _id: hash,
                fileHash: hash,
                fileUrl: getIPFSGatewayUrl(hash),
                originalName: `IPFS Record: ${hash.slice(0, 8)}...`,
                description: "Blockchain stored record",
                createdAt: Date.now(), // Blockchain doesn't easily give timestamps for these without event parsing, using current time for display
                onChain: true
            }));
            setRecords(formattedRecords);
        } catch (err) {
            console.error("Failed to fetch records", err);
        }
    };

    const fetchRequests = async () => {
        try {
            const { reqLogs, grantLogs, revokeLogs } = await getRequestHistory(walletAddress);
            
            // Build current state per doctor
            const doctorStatus = {}; // address -> "pending" | "approved"
            const doctorTimestamps = {};
            
            // Replay events to find current status
            reqLogs.forEach(log => {
                const docAddr = log.args[0]; // doctor
                doctorStatus[docAddr] = "pending";
                doctorTimestamps[docAddr] = Number(log.args[2]) * 1000;
            });
            
            grantLogs.forEach(log => {
                const docAddr = log.args[0];
                doctorStatus[docAddr] = "approved";
                doctorTimestamps[docAddr] = Number(log.args[2]) * 1000;
            });
            
            revokeLogs.forEach(log => {
                const docAddr = log.args[0];
                // Once revoked, we can just remove them or mark as revoked
                delete doctorStatus[docAddr];
            });

            // Fetch doctor profiles
            const requestObjects = [];
            for (const [docAddr, status] of Object.entries(doctorStatus)) {
                let name = "Unknown Doctor";
                try {
                    const profile = await getUserProfile(docAddr);
                    if (profile && profile.name) name = profile.name;
                } catch(e) {}
                
                requestObjects.push({
                    _id: docAddr,
                    doctorId: { walletAddress: docAddr, name },
                    status,
                    createdAt: doctorTimestamps[docAddr]
                });
            }

            setRequests(requestObjects.sort((a,b) => b.createdAt - a.createdAt));
        } catch (err) {
             console.error("Failed to fetch requests", err);
        }
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!uploadFile) return;
        setUploading(true);
        try {
            // 1. Upload to IPFS
            const cid = await uploadToIPFS(uploadFile);
            
            // 2. Anchor to Blockchain
            await addRecordOnChain(cid);
            showMsg("success", "Record uploaded to IPFS and anchored on blockchain! ✅");

            setUploadFile(null);
            setUploadDesc("");
            fetchRecords();
        } catch (err) {
            showMsg("error", err.message || "Upload failed");
        } finally {
            setUploading(false);
        }
    };

    const handleApprove = async (req) => {
        setActionLoading((p) => ({ ...p, [req._id]: true }));
        try {
            await grantAccess(req.doctorId.walletAddress);
            showMsg("success", `Access granted to Dr. ${req.doctorId?.name}!`);
            fetchRequests();
        } catch (err) {
            showMsg("error", err.message || "Error approving");
        } finally {
            setActionLoading((p) => ({ ...p, [req._id]: false }));
        }
    };

    const handleReject = async (req) => {
        setActionLoading((p) => ({ ...p, [`r${req._id}`]: true }));
        try {
            // Reject is same as revoke essentially, or we just ignore. Wait, smart contract only has revoke.
            // Let's just revoke to clear the pending state.
            await revokeAccess(req.doctorId.walletAddress);
            showMsg("success", "Request rejected.");
            fetchRequests();
        } catch (err) {
            showMsg("error", err.message || "Error rejecting");
        } finally {
            setActionLoading((p) => ({ ...p, [`r${req._id}`]: false }));
        }
    };

    const handleRevoke = async (req) => {
        setActionLoading((p) => ({ ...p, [`v${req._id}`]: true }));
        try {
            await revokeAccess(req.doctorId.walletAddress);
            showMsg("success", `Access revoked from Dr. ${req.doctorId?.name}.`);
            fetchRequests();
        } catch (err) {
            showMsg("error", err.message || "Error revoking");
        } finally {
            setActionLoading((p) => ({ ...p, [`v${req._id}`]: false }));
        }
    };

    const pendingRequests = requests.filter((r) => r.status === "pending");
    const approvedRequests = requests.filter((r) => r.status === "approved");

    return (
        <div className="dashboard-page">
            <div className="container">
                {/* Header */}
                <div className="dashboard-header animate-in">
                    <div>
                        <h1>Patient Dashboard</h1>
                        <p className="text-muted">Welcome, <strong>{user?.name}</strong></p>
                    </div>
                </div>

                {/* Stats */}
                <div className="stats-row animate-in">
                    <div className="stat-card card">
                        <div className="stat-value gradient-text">{records.length}</div>
                        <div className="stat-label">Medical Records</div>
                    </div>
                    <div className="stat-card card">
                        <div className="stat-value" style={{ color: "var(--accent-amber)" }}>{pendingRequests.length}</div>
                        <div className="stat-label">Pending Requests</div>
                    </div>
                    <div className="stat-card card">
                        <div className="stat-value" style={{ color: "var(--accent-green)" }}>{approvedRequests.length}</div>
                        <div className="stat-label">Approved Doctors</div>
                    </div>
                    <div className="stat-card card">
                        <div className="stat-value" style={{ color: "var(--accent-purple)" }}>
                            {records.length}
                        </div>
                        <div className="stat-label">On-Chain</div>
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
                    {["records", "requests", "log"].map((t) => (
                        <button
                            key={t}
                            className={`tab-btn ${activeTab === t ? "tab-btn--active" : ""}`}
                            onClick={() => setActiveTab(t)}
                        >
                            {t === "records" && "📁 My Records"}
                            {t === "requests" && `🔔 Access Requests ${pendingRequests.length > 0 ? `(${pendingRequests.length})` : ""}`}
                            {t === "log" && "⛓ Blockchain Log"}
                        </button>
                    ))}
                </div>

                {/* ── Tab: Records ── */}
                {activeTab === "records" && (
                    <div className="animate-in">
                        {/* Upload form */}
                        <div className="card upload-card">
                            <h3>📤 Upload Medical Record to IPFS</h3>
                            <form onSubmit={handleUpload} className="upload-form">
                                <div className="form-group">
                                    <label className="form-label">Select File (PDF, Image, DOC — max 10MB)</label>
                                    <input
                                        className="form-input file-input"
                                        type="file"
                                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.txt"
                                        onChange={(e) => setUploadFile(e.target.files[0])}
                                        required
                                    />
                                    {uploadFile && (
                                        <p className="text-sm text-muted mt-1">
                                            Selected: {uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)
                                        </p>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Description (optional)</label>
                                    <input
                                        className="form-input"
                                        placeholder="e.g. Blood test report Jan 2025"
                                        value={uploadDesc}
                                        onChange={(e) => setUploadDesc(e.target.value)}
                                        disabled
                                        title="IPFS only stores the file, not the metadata right now"
                                    />
                                </div>
                                <button className="btn btn-primary" disabled={uploading}>
                                    {uploading ? <><span className="spinner" /> Uploading...</> : "Upload & Anchor"}
                                </button>
                            </form>
                        </div>

                        {/* Records list */}
                        <div className="records-grid">
                            {records.length === 0 ? (
                                <div className="empty-state">
                                    <span>📭</span>
                                    <p>No records yet. Upload your first medical record above.</p>
                                </div>
                            ) : (
                                records.map((r, i) => (
                                    <div key={i} className="record-card card">
                                        <div className="record-icon">
                                            📄
                                        </div>
                                        <div className="record-info">
                                            <h4 className="truncate">{r.originalName}</h4>
                                            <p className="text-sm text-muted hash-text" title={r.fileHash}>
                                                IPFS CID: {r.fileHash.slice(0, 16)}...
                                            </p>
                                            <div className="record-meta">
                                                <span className="badge badge-green">⛓ On-Chain</span>
                                            </div>
                                        </div>
                                        <div className="record-actions">
                                            <a
                                                href={r.fileUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="btn btn-outline btn-sm"
                                            >
                                                View
                                            </a>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* ── Tab: Requests ── */}
                {activeTab === "requests" && (
                    <div className="animate-in">
                        {requests.length === 0 ? (
                            <div className="empty-state">
                                <span>🔕</span>
                                <p>No access requests yet.</p>
                            </div>
                        ) : (
                            <div className="requests-list">
                                {requests.map((req) => (
                                    <div key={req._id} className="request-card card">
                                        <div className="request-info">
                                            <div className="doctor-avatar">👨‍⚕️</div>
                                            <div>
                                                <h4>Dr. {req.doctorId?.name}</h4>
                                                <p className="text-sm text-muted">{req.doctorId?.walletAddress}</p>
                                                <p className="text-sm text-muted">{new Date(req.createdAt).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <div className="request-controls">
                                            <span className={`badge ${req.status === "pending" ? "badge-amber" : req.status === "approved" ? "badge-green" : "badge-red"}`}>
                                                {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                                            </span>
                                            {req.status === "pending" && (
                                                <div className="flex gap-1">
                                                    <button
                                                        className="btn btn-success btn-sm"
                                                        onClick={() => handleApprove(req)}
                                                        disabled={actionLoading[req._id]}
                                                    >
                                                        {actionLoading[req._id] ? <span className="spinner" /> : "✅ Approve"}
                                                    </button>
                                                    <button
                                                        className="btn btn-danger btn-sm"
                                                        onClick={() => handleReject(req)}
                                                        disabled={actionLoading[`r${req._id}`]}
                                                    >
                                                        {actionLoading[`r${req._id}`] ? <span className="spinner" /> : "❌ Reject"}
                                                    </button>
                                                </div>
                                            )}
                                            {req.status === "approved" && (
                                                <button
                                                    className="btn btn-danger btn-sm"
                                                    onClick={() => handleRevoke(req)}
                                                    disabled={actionLoading[`v${req._id}`]}
                                                >
                                                    {actionLoading[`v${req._id}`] ? <span className="spinner" /> : "🚫 Revoke"}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ── Tab: Access Log ── */}
                {activeTab === "log" && <AccessLog />}
            </div>
        </div>
    );
}
