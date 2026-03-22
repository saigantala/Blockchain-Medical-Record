import axios from "axios";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "/api",
    headers: { "Content-Type": "application/json" },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// Handle 401 globally
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            window.location.href = "/login";
        }
        return Promise.reject(error);
    }
);

// ── Auth ────────────────────────────────────────────────────────────────────
export const register = (data) => api.post("/auth/register", data);
export const login = (data) => api.post("/auth/login", data);
export const getMe = () => api.get("/auth/me");
export const linkWallet = (walletAddress) => api.put("/auth/wallet", { walletAddress });
export const getUsers = (role) => api.get("/auth/users", { params: { role } });

// ── Records ─────────────────────────────────────────────────────────────────
export const uploadRecord = (formData) =>
    api.post("/records/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
    });

export const getMyRecords = () => api.get("/records/my");
export const getPatientRecords = (patientId) => api.get(`/records/${patientId}`);
export const anchorRecord = (id, blockchainTxHash) =>
    api.patch(`/records/${id}/anchor`, { blockchainTxHash });
export const deleteRecord = (id) => api.delete(`/records/${id}`);

// ── Requests ─────────────────────────────────────────────────────────────────
export const createRequest = (data) => api.post("/requests", data);
export const getPatientRequests = (id) => api.get(`/requests/patient/${id}`);
export const getDoctorRequests = (id) => api.get(`/requests/doctor/${id}`);
export const approveRequest = (id, approveTxHash) =>
    api.put(`/requests/${id}/approve`, { approveTxHash });
export const rejectRequest = (id) => api.put(`/requests/${id}/reject`);
export const revokeRequest = (id, revokeTxHash) =>
    api.put(`/requests/${id}/revoke`, { revokeTxHash });

export default api;
