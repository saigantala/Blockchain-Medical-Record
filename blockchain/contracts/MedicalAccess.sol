// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MedicalAccess
 * @dev Manages patient-controlled access to medical records on-chain.
 *      Only file IPFS hashes and permissions live here; actual files stay on IPFS.
 */
contract MedicalAccess {
    struct User {
        string name;
        string role; // "patient" or "doctor"
        bool isRegistered;
    }

    // ── State ──────────────────────────────────────────────────────────────
    // patient => doctor => approved
    mapping(address => mapping(address => bool)) public permissions;

    // patient => array of IPFS record hashes (CIDs) they have registered
    mapping(address => string[]) private patientRecords;

    // track registered users
    mapping(address => User) public users;

    // Optional arrays to keep track of all registered patients and doctors
    // Useful for frontend to list them without a backend
    address[] public allPatients;
    address[] public allDoctors;

    // ── Events ─────────────────────────────────────────────────────────────
    event UserRegistered(address indexed user, string name, string role);
    event RecordAdded(address indexed patient, string ipfsHash, uint256 timestamp);
    event AccessRequested(address indexed doctor, address indexed patient, uint256 timestamp);
    event AccessGranted(address indexed doctor, address indexed patient, uint256 timestamp);
    event AccessRevoked(address indexed doctor, address indexed patient, uint256 timestamp);

    // ── Modifiers ──────────────────────────────────────────────────────────
    modifier onlyPatient() {
        require(
            keccak256(bytes(users[msg.sender].role)) == keccak256(bytes("patient")),
            "Caller is not a registered patient"
        );
        _;
    }

    modifier onlyDoctor() {
        require(
            keccak256(bytes(users[msg.sender].role)) == keccak256(bytes("doctor")),
            "Caller is not a registered doctor"
        );
        _;
    }

    // ── Registration ───────────────────────────────────────────────────────
    /**
     * @notice Register the calling address with a name and a role.
     * @param name Name of the user.
     * @param role Either "patient" or "doctor".
     */
    function register(string calldata name, string calldata role) external {
        require(
            keccak256(bytes(role)) == keccak256(bytes("patient")) ||
            keccak256(bytes(role)) == keccak256(bytes("doctor")),
            "Role must be 'patient' or 'doctor'"
        );
        require(!users[msg.sender].isRegistered, "Already registered");
        
        users[msg.sender] = User({
            name: name,
            role: role,
            isRegistered: true
        });

        if (keccak256(bytes(role)) == keccak256(bytes("patient"))) {
            allPatients.push(msg.sender);
        } else {
            allDoctors.push(msg.sender);
        }

        emit UserRegistered(msg.sender, name, role);
    }

    // ── Getters for Users ──────────────────────────────────────────────────
    /**
     * @notice Get all registered patients.
     */
    function getAllPatients() external view returns (address[] memory) {
        return allPatients;
    }

    /**
     * @notice Get all registered doctors.
     */
    function getAllDoctors() external view returns (address[] memory) {
        return allDoctors;
    }

    // ── Record Management ──────────────────────────────────────────────────
    /**
     * @notice Anchor an IPFS medical record CID on-chain.
     * @param ipfsHash CID of the file stored on IPFS.
     */
    function addRecord(string calldata ipfsHash) external onlyPatient {
        patientRecords[msg.sender].push(ipfsHash);
        emit RecordAdded(msg.sender, ipfsHash, block.timestamp);
    }

    /**
     * @notice Return all record IPFS hashes for a patient.
     * @param patient The patient's wallet address.
     */
    function getRecords(address patient) external view returns (string[] memory) {
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
            keccak256(bytes(users[patient].role)) == keccak256(bytes("patient")),
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
            keccak256(bytes(users[doctor].role)) == keccak256(bytes("doctor")),
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
