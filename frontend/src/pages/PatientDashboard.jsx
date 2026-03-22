import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import {
    getMyRecords,
    uploadRecord,
    anchorRecord,
    deleteRecord,
    getPatientRequests,
    approveRequest,
    rejectRequest,
    revokeRequest,
} from "../services/api";
import {
    grantAccess,
    revokeAccess,
    addRecordOnChain,
    registerOnChain,
} from "../services/blockchain";
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
    const [registering, setRegistering] = useState(false);

    useEffect(() => {
        fetchRecords();
        fetchRequests();
    }, []);

    const showMsg = (type, text) => {
        setMsg({ type, text });
        setTimeout(() => setMsg({ type: "", text: "" }), 5000);
    };

    const fetchRecords = async () => {
        try {
            const { data } = await getMyRecords();
            setRecords(data.records);
        } catch { }
    };

    const fetchRequests = async () => {
        try {
            const { data } = await getPatientRequests(user._id);
            setRequests(data.requests);
        } catch { }
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!uploadFile) return;
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", uploadFile);
            formData.append("description", uploadDesc);
            const { data } = await uploadRecord(formData);
            showMsg("success", "Record uploaded successfully!");

            // Anchor on blockchain if wallet connected
            if (walletAddress) {
                try {
                    const receipt = await addRecordOnChain(data.record.fileHashBytes32);
                    await anchorRecord(data.record._id, receipt.hash);
                    showMsg("success", "Record uploaded and anchored on blockchain! ✅");
                } catch (bcErr) {
                    showMsg("info", "File uploaded. Blockchain anchoring skipped (wallet not connected or tx failed).");
                }
            }

            setUploadFile(null);
            setUploadDesc("");
            fetchRecords();
        } catch (err) {
            showMsg("error", err.response?.data?.message || "Upload failed");
        } finally {
            setUploading(false);
        }
    };

    const handleApprove = async (req) => {
        setActionLoading((p) => ({ ...p, [req._id]: true }));
        try {
            let txHash = null;
            if (walletAddress && req.doctorId?.walletAddress) {
                const receipt = await grantAccess(req.doctorId.walletAddress);
                txHash = receipt.hash;
            }
            await approveRequest(req._id, txHash);
            showMsg("success", `Access granted to Dr. ${req.doctorId?.name}!`);
            fetchRequests();
        } catch (err) {
            showMsg("error", err.response?.data?.message || err.message || "Error approving");
        } finally {
            setActionLoading((p) => ({ ...p, [req._id]: false }));
        }
    };

    const handleReject = async (req) => {
        setActionLoading((p) => ({ ...p, [`r${req._id}`]: true }));
        try {
            await rejectRequest(req._id);
            showMsg("success", "Request rejected.");
            fetchRequests();
        } catch (err) {
            showMsg("error", err.response?.data?.message || "Error rejecting");
        } finally {
            setActionLoading((p) => ({ ...p, [`r${req._id}`]: false }));
        }
    };

    const handleRevoke = async (req) => {
        setActionLoading((p) => ({ ...p, [`v${req._id}`]: true }));
        try {
            let txHash = null;
            if (walletAddress && req.doctorId?.walletAddress) {
                const receipt = await revokeAccess(req.doctorId.walletAddress);
                txHash = receipt.hash;
            }
            await revokeRequest(req._id, txHash);
            showMsg("success", `Access revoked from Dr. ${req.doctorId?.name}.`);
            fetchRequests();
        } catch (err) {
            showMsg("error", err.response?.data?.message || err.message || "Error revoking");
        } finally {
            setActionLoading((p) => ({ ...p, [`v${req._id}`]: false }));
        }
    };

    const handleRegisterOnChain = async () => {
        setRegistering(true);
        try {
            await registerOnChain("patient");
            showMsg("success", "Registered as patient on blockchain! ✅");
        } catch (err) {
            showMsg("error", err.message || "Blockchain registration failed");
        } finally {
            setRegistering(false);
        }
    };

    const handleDeleteRecord = async (id) => {
        if (!confirm("Delete this record? This cannot be undone.")) return;
        try {
            await deleteRecord(id);
            showMsg("success", "Record deleted.");
            fetchRecords();
        } catch (err) {
            showMsg("error", "Delete failed");
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
                        <p className="text-muted">Welcome, <strong>{user.name}</strong></p>
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
                            {records.filter((r) => r.onChain).length}
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
                            <h3>📤 Upload Medical Record</h3>
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
                                    />
                                </div>
                                <button className="btn btn-primary" disabled={uploading}>
                                    {uploading ? <><span className="spinner" /> Uploading...</> : "Upload Record"}
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
                                records.map((r) => (
                                    <div key={r._id} className="record-card card">
                                        <div className="record-icon">
                                            {r.mimeType?.includes("pdf") ? "📄" : r.mimeType?.includes("image") ? "🖼" : "📋"}
                                        </div>
                                        <div className="record-info">
                                            <h4 className="truncate">{r.originalName}</h4>
                                            <p className="text-sm text-muted">{r.description || "No description"}</p>
                                            <p className="text-sm text-muted hash-text" title={r.fileHash}>
                                                SHA-256: {r.fileHash.slice(0, 16)}...
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
                                        <div className="record-actions">
                                            <a
                                                href={r.fileUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="btn btn-outline btn-sm"
                                            >
                                                View
                                            </a>
                                            <button
                                                className="btn btn-danger btn-sm"
                                                onClick={() => handleDeleteRecord(r._id)}
                                            >
                                                Delete
                                            </button>
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
                                                <p className="text-sm text-muted">{req.doctorId?.specialization || "General Practitioner"}</p>
                                                <p className="text-sm text-muted">{req.doctorId?.email}</p>
                                                {req.message && <p className="text-sm request-message">"{req.message}"</p>}
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
