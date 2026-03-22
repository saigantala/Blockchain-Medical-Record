import React from "react";
import {
    BrowserRouter,
    Routes,
    Route,
    Navigate,
    Outlet,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import Login from "./pages/Login";
import Register from "./pages/Register";
import PatientDashboard from "./pages/PatientDashboard";
import DoctorDashboard from "./pages/DoctorDashboard";

// ── Protected route wrapper ───────────────────────────────────────────────────
function ProtectedRoute({ allowedRoles }) {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div
                style={{
                    minHeight: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <span className="spinner" style={{ width: 40, height: 40 }} />
            </div>
        );
    }

    if (!user) return <Navigate to="/login" replace />;

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        return <Navigate to={user.role === "patient" ? "/patient" : "/doctor"} replace />;
    }

    return <Outlet />;
}

// ── Layout wrapper (adds Navbar) ──────────────────────────────────────────────
function Layout() {
    return (
        <div className="page-wrapper">
            <Navbar />
            <Outlet />
        </div>
    );
}

// ── Root redirect based on role ───────────────────────────────────────────────
function RootRedirect() {
    const { user, loading } = useAuth();
    if (loading) return null;
    if (!user) return <Navigate to="/login" replace />;
    return <Navigate to={user.role === "patient" ? "/patient" : "/doctor"} replace />;
}

export default function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    {/* Public routes */}
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />

                    {/* Protected routes with Navbar layout */}
                    <Route element={<Layout />}>
                        <Route path="/" element={<RootRedirect />} />

                        <Route element={<ProtectedRoute allowedRoles={["patient"]} />}>
                            <Route path="/patient" element={<PatientDashboard />} />
                        </Route>

                        <Route element={<ProtectedRoute allowedRoles={["doctor"]} />}>
                            <Route path="/doctor" element={<DoctorDashboard />} />
                        </Route>

                        {/* Catch-all */}
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Route>
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    );
}
