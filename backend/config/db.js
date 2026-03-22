const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log(`✅ MongoDB Connected: ${mongoose.connection.host}`);
    } catch (error) {
        console.error(`❌ MongoDB Connection Error: ${error.message}`);

        // Fallback to in-memory database
        console.log("⚠️ Attempting fallback to In-Memory MongoDB...");
        try {
            const mongod = await MongoMemoryServer.create();
            const uri = mongod.getUri();
            await mongoose.connect(uri);
            console.log(`✅ Connected to In-Memory MongoDB at ${uri}`);
            console.log("⚠️ NOTE: Data will persist only as long as this server runs.");
        } catch (err) {
            console.error(`❌ Fallback Failed: ${err.message}`);
            process.exit(1);
        }
    }
};

module.exports = connectDB;
