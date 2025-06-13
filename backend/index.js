const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const FormData = require("form-data");
const Web3 = require('web3').default;
const axios = require("axios");
const cors = require("cors");
const contractJson = require("../build/contracts/DocumentVerifier.json");

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

// Connect to local blockchain (Ganache)
const web3 = new Web3("http://127.0.0.1:8545");

// Load deployed contract
const networkId = Object.keys(contractJson.networks)[0];
const contract = new web3.eth.Contract(
  contractJson.abi,
  contractJson.networks[Object.keys(contractJson.networks)[0]].address
);

// Async setup to load accounts before server starts
async function startServer() {
  const accounts = await web3.eth.getAccounts();
  const account = accounts[0];

  // Serve HTML pages
  app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "frontend", "index.html"));
  });

  app.get("/ganache-wallet", (req, res) => {
    res.sendFile(path.join(__dirname, "frontend", "ganache-wallet.html"));
  });

  app.get("/verify-by-file", (req, res) => {
    res.sendFile(path.join(__dirname, "frontend", "verify-by-file.html"));
  });

  app.get("/register", (req, res) => {
    res.sendFile(path.join(__dirname, "frontend", "register.html"));
  });

  app.get("/check", (req, res) => {
    res.sendFile(path.join(__dirname, "frontend", "check.html"));
  });

  // Register a document
  app.post("/register", upload.single("file"), async (req, res) => {
    const filePath = path.join(__dirname, req.file.path);
    try {
      const buffer = fs.readFileSync(filePath);
      const fileHex = "0x" + buffer.toString("hex");
      const hash = web3.utils.sha3(fileHex);
      await contract.methods.verifyDocument(hash, true).send({ from: account });
      res.json({ hash, message: "Document registered successfully." });
    } catch (err) {
      res.status(500).json({ error: "Registration failed", details: err.message });
    } finally {
      fs.unlinkSync(filePath);
    }
  });

  // Verify a document
  app.post("/verify", upload.single("file"), async (req, res) => {
    const filePath = path.join(__dirname, req.file.path);
    try {
      const buffer = fs.readFileSync(filePath);
      const fileHex = "0x" + buffer.toString("hex");
      const hash = web3.utils.sha3(fileHex);

      const formData = new FormData();
      formData.append("file", fs.createReadStream(filePath));
      const predictionRes = await axios.post("http://127.0.0.1:5000/predict", formData, {
        headers: formData.getHeaders(),
      });

      const isValid = predictionRes.data.prediction === 1;
      await contract.methods.verifyDocument(hash, isValid).send({ from: account });
      res.json({ hash, isValid });
    } catch (err) {
      res.status(500).json({ error: "Verification failed", details: err.message });
    } finally {
      fs.unlinkSync(filePath);
    }
  });



  // 1. Upload file and check its hash on-chain
  app.post("/upload", upload.single("file"), async (req, res) => {
    try {
      const fileBuffer = fs.readFileSync(req.file.path);
      const hash = web3.utils.keccak256(fileBuffer);
  
      // Clean up temp file
      fs.unlinkSync(req.file.path);
  
      // Query the smart contract
      const result = await contract.methods.getDocument(hash).call();
  
      const isEmptyHash =
        result[0] ===
        "0x0000000000000000000000000000000000000000000000000000000000000000";
  
      if (isEmptyHash) {
        return res.status(404).json({
          verified: false,
          message: "❌ Document not found on blockchain",
          inputHash: hash,
        });
      }
  
      // Return full response if document exists
      res.json({
        verified: true,
        inputHash: hash,
        fileHash: result[0],
        isValid: result[1],
        owner: result[2],
        message: "✅ Document is verified on blockchain",
      });
    } catch (err) {
      res.status(500).json({
        error: "Verification failed",
        details: err.message,
      });
    }
  });



  // Check hash on blockchain
  app.get("/check/:hash", async (req, res) => {
    try {
      const hash = req.params.hash;
      const result = await contract.methods.getDocument(hash).call();
      if (
        result.fileHash ===
        "0x0000000000000000000000000000000000000000000000000000000000000000"
      ) {
        return res.status(404).json({ error: "Document not found" });
      }
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: "Check failed", details: err.message });
    }
  });

  app.listen(3000, () => {
    console.log("✅ Server running at http://localhost:3000");
  });
}

startServer();
