import axios from "axios";

// ── Pinata IPFS Service ────────────────────────────────────────────────────────
// Ensure you have these environment variables set in frontend/.env
// VITE_PINATA_API_KEY
// VITE_PINATA_SECRET_API_KEY

export const uploadToIPFS = async (file) => {
    if (!import.meta.env.VITE_PINATA_API_KEY || !import.meta.env.VITE_PINATA_SECRET_API_KEY) {
        console.warn("Pinata API Keys missing. Using Simulated IPFS Local Mock.");
        const fakeCid = "QmMock" + Date.now() + Math.floor(Math.random() * 10000);
        
        if (file.size < 2 * 1024 * 1024) { // Under 2MB
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                try {
                    localStorage.setItem(`mock_ipfs_${fakeCid}`, reader.result);
                } catch(e) { console.warn("Local storage full, cannot mock file preview") }
            };
        }
        await new Promise(r => setTimeout(r, 1000));
        return fakeCid;
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
    if (cid && cid.startsWith("QmMock")) {
        const dataUrl = localStorage.getItem(`mock_ipfs_${cid}`);
        if (dataUrl) return dataUrl;
        // Create a generic placeholder data URL for larger files or non-images
        return "data:text/html;charset=utf-8," + encodeURIComponent(`<h1>Simulated IPFS File</h1><p>Record CID: ${cid}</p><p>This file was stored on the mock local IPFS layer due to missing Pinata keys.</p>`);
    }
    return `https://gateway.pinata.cloud/ipfs/${cid}`;
};
