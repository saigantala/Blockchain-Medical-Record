import { ethers } from "ethers";

// ── Web2 Simulation Layer ──────────────────────────────────────────────────────
function getWeb2User() {
    const sessionEmail = localStorage.getItem("medchain_session");
    if (!sessionEmail) return null;
    const users = JSON.parse(localStorage.getItem("medchain_users") || "[]");
    return users.find(u => u.email === sessionEmail);
}

function getMockAddress(email) {
    let hash = 0;
    for (let i = 0; i < email.length; i++) {
        hash = ((hash << 5) - hash) + email.charCodeAt(i);
        hash |= 0;
    }
    return "0x999999999999999999999999" + Math.abs(hash).toString(16).padStart(16, '0');
}

function saveMockLog(type, args) {
    const logs = JSON.parse(localStorage.getItem("w2_logs") || "[]");
    logs.push({ type, args, timestamp: Date.now() / 1000 });
    localStorage.setItem("w2_logs", JSON.stringify(logs));
}

// ── Contract Info ────────────────────────────────────────────────────────────
let contractInfo = null;

async function loadContractInfo() {
    if (contractInfo) return contractInfo;
    try {
        const mod = await import("../contracts/MedicalAccess.json");
        contractInfo = mod.default;
        return contractInfo;
    } catch {
        throw new Error("Contract not deployed yet. Run Hardhat deploy script.");
    }
}

// ── Provider / Signer ────────────────────────────────────────────────────────
let providerInstance = null;

export async function getProvider() {
    if (!window.ethereum) {
        throw new Error("MetaMask not found. Please install the MetaMask extension.");
    }
    if (!providerInstance) {
        providerInstance = new ethers.BrowserProvider(window.ethereum, "any");
        providerInstance.pollingInterval = 15000; // Increase polling interval to 15s to bypass strict rate limits on public testnets
    }
    return providerInstance;
}

export async function getSigner() {
    const provider = await getProvider();
    await provider.send("eth_requestAccounts", []);
    return provider.getSigner();
}

export async function getContract(withSigner = true) {
    const info = await loadContractInfo();
    const signerOrProvider = withSigner ? await getSigner() : await getProvider();
    return new ethers.Contract(info.address, info.abi, signerOrProvider);
}

// ── Wallet ───────────────────────────────────────────────────────────────────
export async function connectWallet() {
    const signer = await getSigner();
    return signer.getAddress();
}

export async function getConnectedAddress() {
    const w2User = getWeb2User();
    if (w2User) return getMockAddress(w2User.email);
    if (!window.ethereum) return null;
    const accounts = await window.ethereum.request({ method: "eth_accounts" });
    return accounts[0] || null;
}

// ── Contract Calls ───────────────────────────────────────────────────────────
export async function registerOnChain(name, role) {
    if (getWeb2User()) return { wait: async () => true };
    const contract = await getContract();
    const tx = await contract.register(name, role);
    const receipt = await tx.wait();
    return receipt;
}

export async function getUserProfile(address) {
    if (address && address.startsWith("0x9999999999")) {
        const users = JSON.parse(localStorage.getItem("medchain_users") || "[]");
        const match = users.find(u => getMockAddress(u.email) === address);
        if (match) return { name: match.name, role: match.role, isRegistered: true };
        throw new Error("User not found");
    }
    const contract = await getContract(false);
    return contract.users(address);
}

export async function getAllPatients() {
    let profiles = [];
    try {
        const contract = await getContract(false);
        const addresses = await contract.getAllPatients();
        profiles = await Promise.all(
            addresses.map(async (addr) => {
                const user = await contract.users(addr);
                return { address: addr, name: user.name, role: user.role };
            })
        );
    } catch(e) {}
    
    const users = JSON.parse(localStorage.getItem("medchain_users") || "[]");
    users.filter(u => u.role === "patient").forEach(u => {
        profiles.push({ address: getMockAddress(u.email), name: u.name, role: u.role });
    });
    
    return profiles;
}

export async function requestAccess(patientAddress) {
    const w2User = getWeb2User();
    const isMockTarget = patientAddress && patientAddress.startsWith("0x9999999999");
    if (w2User || isMockTarget) {
        const caller = w2User ? getMockAddress(w2User.email) : await getConnectedAddress();
        saveMockLog("AccessRequested", [caller, patientAddress]);
        return { wait: async () => true };
    }
    const contract = await getContract();
    const tx = await contract.requestAccess(patientAddress);
    const receipt = await tx.wait();
    return receipt;
}

export async function grantAccess(doctorAddress) {
    const w2User = getWeb2User();
    const isMockTarget = doctorAddress && doctorAddress.startsWith("0x9999999999");
    if (w2User || isMockTarget) {
        const caller = w2User ? getMockAddress(w2User.email) : await getConnectedAddress();
        saveMockLog("AccessGranted", [doctorAddress, caller]);
        return { wait: async () => true };
    }
    const contract = await getContract();
    const tx = await contract.grantAccess(doctorAddress);
    const receipt = await tx.wait();
    return receipt;
}

export async function revokeAccess(doctorAddress) {
    const w2User = getWeb2User();
    const isMockTarget = doctorAddress && doctorAddress.startsWith("0x9999999999");
    if (w2User || isMockTarget) {
        const caller = w2User ? getMockAddress(w2User.email) : await getConnectedAddress();
        saveMockLog("AccessRevoked", [doctorAddress, caller]);
        return { wait: async () => true };
    }
    const contract = await getContract();
    const tx = await contract.revokeAccess(doctorAddress);
    const receipt = await tx.wait();
    return receipt;
}

export async function addRecordOnChain(ipfsHash) {
    const w2User = getWeb2User();
    if (w2User) {
        const mockAddr = getMockAddress(w2User.email);
        const records = JSON.parse(localStorage.getItem(`w2_records_${mockAddr}`) || "[]");
        records.push(ipfsHash);
        localStorage.setItem(`w2_records_${mockAddr}`, JSON.stringify(records));
        saveMockLog("RecordAdded", [mockAddr, ipfsHash]);
        return { wait: async () => true };
    }
    const contract = await getContract();
    const tx = await contract.addRecord(ipfsHash);
    const receipt = await tx.wait();
    return receipt;
}

export async function getRecordsOnChain(patientAddress) {
    if (patientAddress && patientAddress.startsWith("0x9999999999")) {
        return JSON.parse(localStorage.getItem(`w2_records_${patientAddress}`) || "[]");
    }
    const contract = await getContract(false);
    return contract.getRecords(patientAddress);
}

export async function checkAccess(patientAddress, doctorAddress) {
    const contract = await getContract(false);
    return contract.checkAccess(patientAddress, doctorAddress);
}

// ── Event Listener (for Access Log) ──────────────────────────────────────────
export async function listenToEvents(callback) {
    const info = await loadContractInfo();
    const provider = await getProvider();
    const contract = new ethers.Contract(info.address, info.abi, provider);

    const handlers = {
        AccessRequested: (doctor, patient, timestamp, event) =>
            callback({ type: "AccessRequested", doctor, patient, timestamp: Number(timestamp), event }),
        AccessGranted: (doctor, patient, timestamp, event) =>
            callback({ type: "AccessGranted", doctor, patient, timestamp: Number(timestamp), event }),
        AccessRevoked: (doctor, patient, timestamp, event) =>
            callback({ type: "AccessRevoked", doctor, patient, timestamp: Number(timestamp), event }),
        RecordAdded: (patient, fileHash, timestamp, event) =>
            callback({ type: "RecordAdded", patient, fileHash, timestamp: Number(timestamp), event }),
    };

    Object.entries(handlers).forEach(([name, fn]) => contract.on(name, fn));

    // Return cleanup function
    return () => {
        Object.keys(handlers).forEach((name) => contract.off(name, handlers[name]));
    };
}

// ── Event History ───────────────────────────────────────────────────────────
// Used to build "Requests" state without a backend
export async function getRequestHistory(patientAddress) {
    const contract = await getContract(false);
    const filterReq = contract.filters.AccessRequested(null, patientAddress);
    const filterGrant = contract.filters.AccessGranted(null, patientAddress);
    const filterRevoke = contract.filters.AccessRevoked(null, patientAddress);

    const [reqLogs, grantLogs, revokeLogs] = await Promise.all([
        contract.queryFilter(filterReq).catch(()=>[]),
        contract.queryFilter(filterGrant).catch(()=>[]),
        contract.queryFilter(filterRevoke).catch(()=>[])
    ]);

    const logs = JSON.parse(localStorage.getItem("w2_logs") || "[]");
    const formatLog = (l) => ({ args: [...l.args, l.timestamp] });
    
    const w2Req = logs.filter(l => l.type === "AccessRequested" && l.args[1] === patientAddress).map(formatLog);
    const w2Grant = logs.filter(l => l.type === "AccessGranted" && l.args[1] === patientAddress).map(formatLog);
    const w2Revoke = logs.filter(l => l.type === "AccessRevoked" && l.args[1] === patientAddress).map(formatLog);

    return { 
        reqLogs: [...reqLogs, ...w2Req], 
        grantLogs: [...grantLogs, ...w2Grant], 
        revokeLogs: [...revokeLogs, ...w2Revoke] 
    };
}

export async function getDoctorRequestHistory(doctorAddress) {
    const contract = await getContract(false);
    const filterReq = contract.filters.AccessRequested(doctorAddress, null);
    const filterGrant = contract.filters.AccessGranted(doctorAddress, null);
    const filterRevoke = contract.filters.AccessRevoked(doctorAddress, null);

    const [reqLogs, grantLogs, revokeLogs] = await Promise.all([
        contract.queryFilter(filterReq).catch(()=>[]),
        contract.queryFilter(filterGrant).catch(()=>[]),
        contract.queryFilter(filterRevoke).catch(()=>[])
    ]);

    const logs = JSON.parse(localStorage.getItem("w2_logs") || "[]");
    const formatLog = (l) => ({ args: [...l.args, l.timestamp] });
    
    const w2Req = logs.filter(l => l.type === "AccessRequested" && l.args[0] === doctorAddress).map(formatLog);
    const w2Grant = logs.filter(l => l.type === "AccessGranted" && l.args[0] === doctorAddress).map(formatLog);
    const w2Revoke = logs.filter(l => l.type === "AccessRevoked" && l.args[0] === doctorAddress).map(formatLog);

    return { 
        reqLogs: [...reqLogs, ...w2Req], 
        grantLogs: [...grantLogs, ...w2Grant], 
        revokeLogs: [...revokeLogs, ...w2Revoke] 
    };
}

// ── Utility ───────────────────────────────────────────────────────────────────
export function shortenAddress(addr) {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
