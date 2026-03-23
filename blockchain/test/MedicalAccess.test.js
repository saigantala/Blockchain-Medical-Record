const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MedicalAccess", function () {
    let medicalAccess, patient, doctor, stranger;

    beforeEach(async function () {
        [, patient, doctor, stranger] = await ethers.getSigners();
        const MedicalAccess = await ethers.getContractFactory("MedicalAccess");
        medicalAccess = await MedicalAccess.deploy();
        await medicalAccess.waitForDeployment();

        // Register roles
        await medicalAccess.connect(patient).register("Alice", "patient");
        await medicalAccess.connect(doctor).register("Dr. Bob", "doctor");
    });

    it("Should register a patient", async function () {
        const user = await medicalAccess.users(patient.address);
        expect(user.role).to.equal("patient");
        expect(user.name).to.equal("Alice");
    });

    it("Should register a doctor", async function () {
        const user = await medicalAccess.users(doctor.address);
        expect(user.role).to.equal("doctor");
        expect(user.name).to.equal("Dr. Bob");
    });

    it("Should not allow duplicate registration", async function () {
        await expect(
            medicalAccess.connect(patient).register("Alice", "patient")
        ).to.be.revertedWith("Already registered");
    });

    it("Should not allow invalid role", async function () {
        await expect(
            medicalAccess.connect(stranger).register("Eve", "admin")
        ).to.be.revertedWith("Role must be 'patient' or 'doctor'");
    });

    it("Patient can add a record", async function () {
        const hash = "ipfs://QmTestHash1234567890";
        const tx = await medicalAccess.connect(patient).addRecord(hash);
        const receipt = await tx.wait();
        expect(receipt.status).to.equal(1);
    });

    it("Patient can view their own records", async function () {
        const hash = "ipfs://QmTestHash1234567890";
        await medicalAccess.connect(patient).addRecord(hash);
        const records = await medicalAccess.connect(patient).getRecords(patient.address);
        expect(records.length).to.equal(1);
        expect(records[0]).to.equal(hash);
    });

    it("Patient can add multiple records", async function () {
        const hash1 = "ipfs://QmTestHash1";
        const hash2 = "ipfs://QmTestHash2";
        await medicalAccess.connect(patient).addRecord(hash1);
        await medicalAccess.connect(patient).addRecord(hash2);
        const records = await medicalAccess.connect(patient).getRecords(patient.address);
        expect(records.length).to.equal(2);
    });

    it("Doctor cannot view records without permission", async function () {
        const hash = "ipfs://QmTestHash1234567890";
        await medicalAccess.connect(patient).addRecord(hash);
        await expect(
            medicalAccess.connect(doctor).getRecords(patient.address)
        ).to.be.revertedWith("No permission to view records");
    });

    it("Doctor can request access — emits event", async function () {
        const tx = await medicalAccess.connect(doctor).requestAccess(patient.address);
        const receipt = await tx.wait();
        expect(receipt.status).to.equal(1);
        // Find the AccessRequested event
        const event = receipt.logs.find(
            (log) => {
                try {
                    return medicalAccess.interface.parseLog(log)?.name === "AccessRequested";
                } catch { return false; }
            }
        );
        expect(event).to.not.be.undefined;
    });

    it("Patient can grant access to doctor", async function () {
        const tx = await medicalAccess.connect(patient).grantAccess(doctor.address);
        const receipt = await tx.wait();
        expect(receipt.status).to.equal(1);
        expect(await medicalAccess.checkAccess(patient.address, doctor.address)).to.be.true;
    });

    it("Doctor can view records after grant", async function () {
        const hash = "ipfs://QmTestHash1234567890";
        await medicalAccess.connect(patient).addRecord(hash);
        await medicalAccess.connect(patient).grantAccess(doctor.address);
        const records = await medicalAccess.connect(doctor).getRecords(patient.address);
        expect(records.length).to.equal(1);
        expect(records[0]).to.equal(hash);
    });

    it("Patient can revoke access", async function () {
        await medicalAccess.connect(patient).grantAccess(doctor.address);
        const tx = await medicalAccess.connect(patient).revokeAccess(doctor.address);
        const receipt = await tx.wait();
        expect(receipt.status).to.equal(1);
        expect(await medicalAccess.checkAccess(patient.address, doctor.address)).to.be.false;
    });

    it("Doctor cannot view records after revoke", async function () {
        const hash = "ipfs://QmTestHash1234567890";
        await medicalAccess.connect(patient).addRecord(hash);
        await medicalAccess.connect(patient).grantAccess(doctor.address);
        await medicalAccess.connect(patient).revokeAccess(doctor.address);
        await expect(
            medicalAccess.connect(doctor).getRecords(patient.address)
        ).to.be.revertedWith("No permission to view records");
    });

    it("Non-doctor cannot request access", async function () {
        await expect(
            medicalAccess.connect(stranger).requestAccess(patient.address)
        ).to.be.revertedWith("Caller is not a registered doctor");
    });

    it("Non-patient cannot grant access", async function () {
        await expect(
            medicalAccess.connect(stranger).grantAccess(doctor.address)
        ).to.be.revertedWith("Caller is not a registered patient");
    });

    it("checkAccess returns false for no permission", async function () {
        expect(await medicalAccess.checkAccess(patient.address, doctor.address)).to.be.false;
    });
});
