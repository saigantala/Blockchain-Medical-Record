import { ethers } from "ethers";

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
    if (!window.ethereum) return null;
    const accounts = await window.ethereum.request({ method: "eth_accounts" });
    return accounts[0] || null;
}

// ── Contract Calls ───────────────────────────────────────────────────────────
export async function registerOnChain(name, role) {
    const contract = await getContract();
    const tx = await contract.register(name, role);
    const receipt = await tx.wait();
    return receipt;
}

export async function getUserProfile(address) {
    const contract = await getContract(false);
    return contract.users(address);
}

export async function getAllPatients() {
    const contract = await getContract(false);
    const addresses = await contract.getAllPatients();
    const profiles = await Promise.all(
        addresses.map(async (addr) => {
            const user = await contract.users(addr);
            return { address: addr, name: user.name, role: user.role };
        })
    );
    return profiles;
}

export async function requestAccess(patientAddress) {
    const contract = await getContract();
    const tx = await contract.requestAccess(patientAddress);
    const receipt = await tx.wait();
    return receipt;
}

export async function grantAccess(doctorAddress) {
    const contract = await getContract();
    const tx = await contract.grantAccess(doctorAddress);
    const receipt = await tx.wait();
    return receipt;
}

export async function revokeAccess(doctorAddress) {
    const contract = await getContract();
    const tx = await contract.revokeAccess(doctorAddress);
    const receipt = await tx.wait();
    return receipt;
}

export async function addRecordOnChain(ipfsHash) {
    const contract = await getContract();
    const tx = await contract.addRecord(ipfsHash);
    const receipt = await tx.wait();
    return receipt;
}

export async function getRecordsOnChain(patientAddress) {
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
        contract.queryFilter(filterReq),
        contract.queryFilter(filterGrant),
        contract.queryFilter(filterRevoke)
    ]);

    return { reqLogs, grantLogs, revokeLogs };
}

export async function getDoctorRequestHistory(doctorAddress) {
    const contract = await getContract(false);
    const filterReq = contract.filters.AccessRequested(doctorAddress, null);
    const filterGrant = contract.filters.AccessGranted(doctorAddress, null);
    const filterRevoke = contract.filters.AccessRevoked(doctorAddress, null);

    const [reqLogs, grantLogs, revokeLogs] = await Promise.all([
        contract.queryFilter(filterReq),
        contract.queryFilter(filterGrant),
        contract.queryFilter(filterRevoke)
    ]);

    return { reqLogs, grantLogs, revokeLogs };
}

// ── Utility ───────────────────────────────────────────────────────────────────
export function shortenAddress(addr) {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
