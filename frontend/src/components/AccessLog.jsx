import React, { useEffect, useState } from "react";
import { listenToEvents, shortenAddress } from "../services/blockchain";
import "./AccessLog.css";

const EVENT_ICONS = {
    AccessRequested: "🔔",
    AccessGranted: "✅",
    AccessRevoked: "🚫",
    RecordAdded: "📁",
};

const EVENT_COLORS = {
    AccessRequested: "badge-amber",
    AccessGranted: "badge-green",
    AccessRevoked: "badge-red",
    RecordAdded: "badge-cyan",
};

export default function AccessLog() {
    const [events, setEvents] = useState([]);
    const [listening, setListening] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let cleanup = null;

        const start = async () => {
            try {
                setError("");
                setListening(true);
                cleanup = await listenToEvents((event) => {
                    setEvents((prev) => [event, ...prev].slice(0, 50)); // keep last 50
                });
            } catch (err) {
                setError(err.message || "Could not connect to blockchain events.");
                setListening(false);
            }
        };

        start();

        return () => {
            if (cleanup) cleanup();
        };
    }, []);

    const clearLogs = () => setEvents([]);

    return (
        <div className="access-log animate-in">
            <div className="log-header">
                <div>
                    <h3>⛓ Blockchain Event Log</h3>
                    <p className="text-muted text-sm">
                        Real-time on-chain events from the MedicalAccess contract
                    </p>
                </div>
                <div className="log-controls">
                    <span className={`log-status ${listening && !error ? "log-status--live" : "log-status--off"}`}>
                        <span className="status-dot" />
                        {listening && !error ? "Live" : "Disconnected"}
                    </span>
                    {events.length > 0 && (
                        <button className="btn btn-outline btn-sm" onClick={clearLogs}>
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {error && (
                <div className="alert alert-error">
                    ⚠️ {error}
                    <br />
                    <small>Deploy the smart contract and connect MetaMask to see live events.</small>
                </div>
            )}

            {events.length === 0 && !error ? (
                <div className="log-empty">
                    <div className="log-pulse">
                        <span className="pulse-ring" />
                        <span>⛓</span>
                    </div>
                    <p>Listening for events...</p>
                    <p className="text-sm text-muted">
                        Events will appear here as patients and doctors interact with the smart contract.
                    </p>
                </div>
            ) : (
                <div className="log-list">
                    {events.map((ev, i) => (
                        <div key={i} className={`log-item animate-in ${i === 0 ? "log-item--new" : ""}`}>
                            <span className="log-icon">{EVENT_ICONS[ev.type] || "🔷"}</span>
                            <div className="log-content">
                                <div className="log-top">
                                    <span className={`badge ${EVENT_COLORS[ev.type] || "badge-cyan"}`}>
                                        {ev.type}
                                    </span>
                                    <span className="log-time text-sm text-muted">
                                        {new Date(ev.timestamp * 1000).toLocaleTimeString()}
                                    </span>
                                </div>
                                <div className="log-body text-sm text-muted">
                                    {ev.doctor && (
                                        <span>Doctor: <code>{shortenAddress(ev.doctor)}</code></span>
                                    )}
                                    {ev.patient && (
                                        <span> → Patient: <code>{shortenAddress(ev.patient)}</code></span>
                                    )}
                                    {ev.fileHash && (
                                        <span>Hash: <code>{ev.fileHash.slice(0, 18)}...</code></span>
                                    )}
                                </div>
                                {ev.event?.transactionHash && (
                                    <p className="log-tx text-sm">
                                        Tx:{" "}
                                        <code className="hash-text">{ev.event.transactionHash.slice(0, 20)}...</code>
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
