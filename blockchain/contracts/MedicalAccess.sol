// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MedicalAccess
 * @dev Manages patient-controlled access to medical records on-chain.
 *      Only file hashes and permissions live here; actual files stay off-chain.
 */
contract MedicalAccess {
    // ── State ──────────────────────────────────────────────────────────────
    // patient => doctor => approved
    mapping(address => mapping(address => bool)) public permissions;

    // patient => array of record hashes they have registered on-chain
    mapping(address => bytes32[]) private patientRecords;

    // track registered roles
    mapping(address => string) public roles; // "patient" | "doctor" | ""

    // ── Events ─────────────────────────────────────────────────────────────
    event UserRegistered(address indexed user, string role);
    event RecordAdded(address indexed patient, bytes32 fileHash, uint256 timestamp);
    event AccessRequested(address indexed doctor, address indexed patient, uint256 timestamp);
    event AccessGranted(address indexed doctor, address indexed patient, uint256 timestamp);
    event AccessRevoked(address indexed doctor, address indexed patient, uint256 timestamp);

    // ── Modifiers ──────────────────────────────────────────────────────────
    modifier onlyPatient() {
        require(
            keccak256(bytes(roles[msg.sender])) == keccak256(bytes("patient")),
            "Caller is not a registered patient"
        );
        _;
    }

    modifier onlyDoctor() {
        require(
            keccak256(bytes(roles[msg.sender])) == keccak256(bytes("doctor")),
            "Caller is not a registered doctor"
        );
        _;
    }

    // ── Registration ───────────────────────────────────────────────────────
    /**
     * @notice Register the calling address with a role.
     * @param role Either "patient" or "doctor".
     */
    function register(string calldata role) external {
        require(
            keccak256(bytes(role)) == keccak256(bytes("patient")) ||
            keccak256(bytes(role)) == keccak256(bytes("doctor")),
            "Role must be 'patient' or 'doctor'"
        );
        require(bytes(roles[msg.sender]).length == 0, "Already registered");
        roles[msg.sender] = role;
        emit UserRegistered(msg.sender, role);
    }

    // ── Record Management ──────────────────────────────────────────────────
    /**
     * @notice Anchor a medical record hash on-chain.
     * @param fileHash SHA-256 hash of the file stored off-chain.
     */
    function addRecord(bytes32 fileHash) external onlyPatient {
        patientRecords[msg.sender].push(fileHash);
        emit RecordAdded(msg.sender, fileHash, block.timestamp);
    }

    /**
     * @notice Return all record hashes for a patient.
     * @param patient The patient's wallet address.
     */
    function getRecords(address patient) external view returns (bytes32[] memory) {
        require(
            msg.sender == patient || permissions[patient][msg.sender],
            "No permission to view records"
        );
        return patientRecords[patient];
    }

    // ── Access Control ─────────────────────────────────────────────────────
    /**
     * @notice Doctor signals intent to view a patient's records.
     * @param patient The patient's wallet address.
     */
    function requestAccess(address patient) external onlyDoctor {
        require(
            keccak256(bytes(roles[patient])) == keccak256(bytes("patient")),
            "Target is not a registered patient"
        );
        emit AccessRequested(msg.sender, patient, block.timestamp);
    }

    /**
     * @notice Patient approves a doctor's access.
     * @param doctor The doctor's wallet address.
     */
    function grantAccess(address doctor) external onlyPatient {
        require(
            keccak256(bytes(roles[doctor])) == keccak256(bytes("doctor")),
            "Target is not a registered doctor"
        );
        permissions[msg.sender][doctor] = true;
        emit AccessGranted(doctor, msg.sender, block.timestamp);
    }

    /**
     * @notice Patient revokes a doctor's access.
     * @param doctor The doctor's wallet address.
     */
    function revokeAccess(address doctor) external onlyPatient {
        permissions[msg.sender][doctor] = false;
        emit AccessRevoked(doctor, msg.sender, block.timestamp);
    }

    /**
     * @notice Check if a doctor has access to a patient's records.
     */
    function checkAccess(address patient, address doctor) external view returns (bool) {
        return permissions[patient][doctor];
    }
}
