# ⛓ MedChain — Blockchain-Based Medical Record Sharing System

A decentralized healthcare application where **patients own and control their medical records**, doctors request access, and all consent & permission events are recorded immutably on the blockchain.

---

## 🏗️ Architecture

```
React Frontend (Vite)        →  http://localhost:5173
    ↓ Axios + Ethers.js
Node.js API (Express)        →  http://localhost:5000
    ↓ Mongoose
MongoDB Atlas                →  Medical data (off-chain)
    ↓ Ethers.js
Solidity Smart Contract      →  Blockchain (access control & logs)
(Hardhat — Localhost/Amoy)
```

## 📁 Project Structure

```
medical/
├── blockchain/         # Hardhat + Solidity smart contract
│   ├── contracts/      # MedicalAccess.sol
│   ├── scripts/        # deploy.js
│   └── test/           # MedicalAccess.test.js
├── backend/            # Node.js + Express REST API
│   ├── config/         # db.js (MongoDB Atlas)
│   ├── models/         # User.js, Record.js, Request.js
│   ├── routes/         # auth.js, records.js, requests.js
│   ├── controllers/    # authController, recordController, requestController
│   ├── middleware/     # auth.js (JWT)
│   └── server.js
└── frontend/           # React + Vite SPA
    └── src/
        ├── context/    # AuthContext.jsx
        ├── services/   # api.js, blockchain.js
        ├── components/ # Navbar, AccessLog
        └── pages/      # Login, Register, PatientDashboard, DoctorDashboard
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js v18+
- MetaMask browser extension
- MongoDB Atlas account (or local MongoDB)

---

### Step 1 — Smart Contract (Local Blockchain)

```bash
cd blockchain

# Install dependencies
npm install

# Start local blockchain node (keep this terminal open!)
npx hardhat node

# In a new terminal — deploy the contract
npm run deploy:local
```

> The contract address and ABI are automatically saved to `frontend/src/contracts/MedicalAccess.json`

---

### Step 2 — Backend

```bash
cd backend

# Install dependencies
npm install

# Copy and fill in environment variables
copy .env.example .env
# Edit .env: set MONGO_URI to your MongoDB Atlas connection string

# Start the server
npm run dev
```

Backend runs at: **http://localhost:5000**

---

### Step 3 — Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

Frontend runs at: **http://localhost:5173**

---

### Step 4 — MetaMask Setup

1. Open MetaMask → **Add Network**:
   - Network Name: `Hardhat Local`
   - RPC URL: `http://127.0.0.1:8545`
   - Chain ID: `31337`
   - Currency: `ETH`
2. Import a test account using one of the private keys printed by `npx hardhat node`

---

## 🔄 User Flows

### Patient Flow
1. Register with role **Patient** → Connect MetaMask
2. Click **"⛓ Register on Chain"** to register wallet in the smart contract
3. Upload medical records (auto-hashed with SHA-256, optionally anchored on-chain)
4. View incoming access requests from doctors
5. **Approve** (triggers `grantAccess` tx) or **Reject** requests
6. **Revoke** any approved doctor's access anytime

### Doctor Flow
1. Register with role **Doctor** → Connect MetaMask
2. Click **"⛓ Register on Chain"**
3. Search for patients by name/email/wallet address
4. Click **"Request Access"** (triggers `requestAccess` tx on-chain)
5. Wait for patient approval
6. Once approved, click **"View Records"** to see patient records

---

## 🔐 Security

- Passwords hashed with **bcryptjs** (12 rounds)
- JWT tokens for API authentication (7-day expiry)
- Only **file hashes** stored on-chain — actual files stay off-chain
- Role-based access control at API and blockchain levels
- Patients can **revoke access at any time** (both on-chain and in DB)

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register patient or doctor |
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/auth/me` | Get current user |
| PUT | `/api/auth/wallet` | Link MetaMask wallet |
| GET | `/api/auth/users?role=patient` | List users by role |
| POST | `/api/records/upload` | Upload medical file (multipart) |
| GET | `/api/records/my` | Patient's own records |
| GET | `/api/records/:patientId` | Patient/approved doctor records |
| PATCH | `/api/records/:id/anchor` | Mark record as on-chain |
| DELETE | `/api/records/:id` | Delete record |
| POST | `/api/requests` | Doctor requests access |
| GET | `/api/requests/patient/:id` | Patient's incoming requests |
| GET | `/api/requests/doctor/:id` | Doctor's outgoing requests |
| PUT | `/api/requests/:id/approve` | Approve request |
| PUT | `/api/requests/:id/reject` | Reject request |
| PUT | `/api/requests/:id/revoke` | Revoke approved access |

---

## ⛓ Smart Contract

**`MedicalAccess.sol`** deployed on local Hardhat network (or Polygon Amoy testnet)

| Function | Called By | Description |
|----------|-----------|-------------|
| `register(role)` | Patient / Doctor | Register wallet on-chain |
| `addRecord(bytes32)` | Patient | Anchor file hash on-chain |
| `requestAccess(patient)` | Doctor | Signal intent for access |
| `grantAccess(doctor)` | Patient | Approve doctor |
| `revokeAccess(doctor)` | Patient | Revoke doctor |
| `checkAccess(patient, doctor)` | Anyone | View permission |

**Events emitted:** `UserRegistered` · `RecordAdded` · `AccessRequested` · `AccessGranted` · `AccessRevoked`

---

## 🚢 Deployment

| Component | Platform |
|-----------|----------|
| Frontend | Vercel / Netlify |
| Backend | Render / Railway |
| Database | MongoDB Atlas |
| Contract | Polygon Amoy Testnet |

### Deploy to Polygon Amoy
```bash
cd blockchain
cp .env.example .env
# Add PRIVATE_KEY and AMOY_RPC_URL to .env
npm run deploy:amoy
```

---

## 🧪 Run Tests

```bash
cd blockchain
npx hardhat test
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contract | Solidity 0.8.20, Hardhat |
| Blockchain Interaction | Ethers.js v6 |
| Frontend | React 18, Vite, React Router v6 |
| Backend | Node.js, Express.js |
| Database | MongoDB Atlas, Mongoose |
| Auth | JWT (jsonwebtoken), bcryptjs |
| File Upload | Multer |
| Styling | Vanilla CSS (Glassmorphism) |
