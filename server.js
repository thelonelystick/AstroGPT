require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { buildHoroscope } = require("./lib/horoscope");
const { calculateGroupMatches } = require("./lib/compatibility");
const { SIGNS, NAKSHATRAS } = require("./lib/signsData");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "702260817489-jsrc44ee2f4f8rbg7fdemat6e3mjq7jd.apps.googleusercontent.com";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";

// Middleware
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Serve static assets
app.use(express.static(ROOT));

// Health Check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    framework: "Express.js",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Firebase Public Client Config
app.get("/api/firebase-config", (req, res) => {
  res.json({
    apiKey: process.env.FIREBASE_API_KEY || "AIzaSyD1vyZyXapmfdOyqTgctbJob--s645NcrA",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "astrogpt-da2e2.firebaseapp.com",
    projectId: process.env.FIREBASE_PROJECT_ID || "astrogpt-da2e2",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "astrogpt-da2e2.firebasestorage.app",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "480223079656",
    appId: process.env.FIREBASE_APP_ID || "1:480223079656:web:7367df27d43956b782ed5d",
    measurementId: process.env.FIREBASE_MEASUREMENT_ID || "G-X3MCKV2FYY",
    googleClientId: GOOGLE_CLIENT_ID
  });
});

// Full Signs & Nakshatras Dataset
app.get("/api/signs", (req, res) => {
  const signs = SIGNS.map((sign) => ({
    ...sign,
    nakshatras: NAKSHATRAS.filter((n) => n.sign.split(" / ").includes(sign.name) || n.sign.includes(sign.name))
  }));
  res.json({ signs, nakshatras: NAKSHATRAS });
});

// Google Login API — exchange OAuth code or verify ID token
app.post("/api/auth/google", async (req, res) => {
  try {
    const { code, idToken } = req.body || {};
    let token = idToken;
    let tokenPayload = null;

    if (code) {
      if (!GOOGLE_CLIENT_SECRET) {
        return res.status(500).json({ error: "Google client secret is not configured on the server" });
      }
      const params = new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: "postmessage",
        grant_type: "authorization_code"
      });
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params
      });
      const tokenJson = await tokenRes.json();
      if (!tokenRes.ok || !tokenJson.id_token) {
        return res.status(401).json({ error: tokenJson.error_description || "Google login failed" });
      }
      token = tokenJson.id_token;
    }

    if (!token) {
      return res.status(400).json({ error: "Google authorization code or ID token is required" });
    }

    const infoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`);
    tokenPayload = await infoRes.json();
    if (!infoRes.ok || tokenPayload.aud !== GOOGLE_CLIENT_ID) {
      return res.status(401).json({ error: "Invalid Google ID token" });
    }

    res.json({
      idToken: token,
      user: {
        uid: tokenPayload.sub,
        email: tokenPayload.email,
        name: tokenPayload.name,
        picture: tokenPayload.picture,
        emailVerified: tokenPayload.email_verified === "true" || tokenPayload.email_verified === true
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Google login failed" });
  }
});

// Generate Horoscope
app.post("/api/horoscope", (req, res) => {
  try {
    const result = buildHoroscope(req.body);
    if (result.error) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to generate horoscope" });
  }
});

// Multi-Person "It's a Match" Compatibility API
app.post("/api/match", (req, res) => {
  try {
    const people = req.body.people || req.body;
    const result = calculateGroupMatches(people);
    if (result.error) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to calculate compatibility match" });
  }
});

// HTML page routing
app.get("/match", (req, res) => {
  res.sendFile(path.join(ROOT, "match.html"));
});
app.get("/horoscope", (req, res) => {
  res.sendFile(path.join(ROOT, "horoscope.html"));
});
app.get("/signs", (req, res) => {
  res.sendFile(path.join(ROOT, "signs.html"));
});
app.get("/research", (req, res) => {
  res.sendFile(path.join(ROOT, "research.html"));
});

// Default 404
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

const server = app.listen(PORT, () => {
  console.log(`[AstroGPT Backend] Express server running at http://localhost:${PORT}`);
  console.log(`[Firebase] Configured with project: ${process.env.FIREBASE_PROJECT_ID || "astrogpt-da2e2"}`);
  console.log(`[Google Auth] Client ID: ${GOOGLE_CLIENT_ID}`);
});

module.exports = { app, server };