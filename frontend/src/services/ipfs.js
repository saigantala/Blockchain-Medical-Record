import axios from "axios";

// ── Pinata IPFS Service ────────────────────────────────────────────────────────
// Ensure you have these environment variables set in frontend/.env
// VITE_PINATA_API_KEY
// VITE_PINATA_SECRET_API_KEY

export const uploadToIPFS = async (file) => {
    if (!import.meta.env.VITE_PINATA_API_KEY || !import.meta.env.VITE_PINATA_SECRET_API_KEY) {
        throw new Error("Pinata API keys are missing in .env");
    }

    const url = "https://api.pinata.cloud/pinning/pinFileToIPFS";
    
    // Create FormData 
    let data = new FormData();
    data.append("file", file);

    const metadata = JSON.stringify({
        name: file.name,
    });
    data.append("pinataMetadata", metadata);

    try {
        const res = await axios.post(url, data, {
            headers: {
                "Content-Type": `multipart/form-data; boundary=${data._boundary}`,
                pinata_api_key: import.meta.env.VITE_PINATA_API_KEY,
                pinata_secret_api_key: import.meta.env.VITE_PINATA_SECRET_API_KEY,
            },
        });
        
        return res.data.IpfsHash; // The CID
    } catch (error) {
        console.error("Error uploading to IPFS:", error);
        throw new Error("Failed to upload file to IPFS.");
    }
};

/**
 * Returns the gateway URL for a given IPFS CID.
 */
export const getIPFSGatewayUrl = (cid) => {
    return `https://gateway.pinata.cloud/ipfs/${cid}`;
};
