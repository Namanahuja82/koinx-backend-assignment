const { connect, JSONCodec } = require("nats");
require("dotenv").config();

let nc;
let jc;

// Connect to NATS
async function connectToNATS() {
  try {
    nc = await connect({
      servers: process.env.NATS_SERVER || "nats://localhost:4222",
    });
    jc = JSONCodec();
    console.log("Connected to NATS server");

    // Handle connection close
    nc.closed().then(() => {
      console.log("NATS connection closed");
    });
  } catch (err) {
    console.error("Failed to connect to NATS:", err);
    // Retry connection after 5 seconds
    setTimeout(connectToNATS, 5000);
  }
}

// Publish crypto update event
async function publishCryptoUpdate() {
  if (!nc || nc.isClosed()) {
    console.log("NATS not connected, attempting to reconnect...");
    await connectToNATS();
    return;
  }

  try {
    const message = { trigger: "update", timestamp: new Date() };
    nc.publish("crypto.update", jc.encode(message));
    console.log("Published crypto update event:", message);
  } catch (err) {
    console.error("Error publishing event:", err);
  }
}

// Schedule job to run every 15 minutes
function scheduleJob() {
  const INTERVAL = 15 * 60 * 1000; // 15 minutes in milliseconds

  console.log("Starting background job - will run every 15 minutes");

  // Run immediately on startup
  publishCryptoUpdate();

  // Schedule to run every 15 minutes
  setInterval(() => {
    console.log("Running scheduled crypto update job...");
    publishCryptoUpdate();
  }, INTERVAL);
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down worker server...");
  if (nc) {
    await nc.close();
  }
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("Shutting down worker server...");
  if (nc) {
    await nc.close();
  }
  process.exit(0);
});

// Start the worker
async function start() {
  console.log("Starting worker server...");
  await connectToNATS();
  scheduleJob();
}

start().catch((err) => {
  console.error("Failed to start worker:", err);
  process.exit(1);
});
