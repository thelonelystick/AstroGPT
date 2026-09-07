const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;

const rashis = [
  { name: "Mesha", english: "Aries", start: [4, 14], end: [5, 13] },
  { name: "Vrishabha", english: "Taurus", start: [5, 14], end: [6, 13] },
  { name: "Mithuna", english: "Gemini", start: [6, 14], end: [7, 14] },
  { name: "Karka", english: "Cancer", start: [7, 15], end: [8, 14] },
  { name: "Simha", english: "Leo", start: [8, 15], end: [9, 14] },
  { name: "Kanya", english: "Virgo", start: [9, 15], end: [10, 14] },
  { name: "Tula", english: "Libra", start: [10, 15], end: [11, 13] },
  { name: "Vrishchika", english: "Scorpio", start: [11, 14], end: [12, 13] },
  { name: "Dhanu", english: "Sagittarius", start: [12, 14], end: [1, 13] },
  { name: "Makara", english: "Capricorn", start: [1, 14], end: [2, 12] },
  { name: "Kumbha", english: "Aquarius", start: [2, 13], end: [3, 13] },
  { name: "Meena", english: "Pisces", start: [3, 14], end: [4, 13] }
];

const nakshatras = [
  "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
  "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni",
  "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha",
  "Jyeshtha", "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana",
  "Dhanishtha", "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati"
];

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*"
  });
  response.end(JSON.stringify(body));
}

function parseBirthDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return null;
  }
  return date;
}

function getRashi(month, day) {
  return rashis.find((rashi) => {
    const [startMonth, startDay] = rashi.start;
    const [endMonth, endDay] = rashi.end;
    if (startMonth <= endMonth) {
      return (month === startMonth && day >= startDay) ||
        (month === endMonth && day <= endDay) ||
        (month > startMonth && month < endMonth);
    }
    return (month === startMonth && day >= startDay) ||
      (month === endMonth && day <= endDay) ||
      month > startMonth || month < endMonth;
  }) || rashis[0];
}

function buildHoroscope(input) {
  const birthDate = parseBirthDate(input.birthDate);
  if (!birthDate) {
    return { error: "birthDate must be a valid date in YYYY-MM-DD format" };
  }
  if (typeof input.birthTime !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.birthTime)) {
    return { error: "birthTime must be a valid 24-hour time in HH:mm format" };
  }
  if (typeof input.location !== "string" || input.location.trim().length < 2) {
    return { error: "location must contain at least 2 characters" };
  }

  const rashi = getRashi(birthDate.getUTCMonth() + 1, birthDate.getUTCDate());
  const dayIndex = Math.floor(birthDate.getTime() / 86400000);
  const nakshatra = nakshatras[((dayIndex % nakshatras.length) + nakshatras.length) % nakshatras.length];
  const lagna = rashis[(Math.abs(dayIndex) + Number(input.birthTime.slice(0, 2))) % rashis.length];

  return {
    profile: {
      rashi: `${rashi.name} (${rashi.english})`,
      nakshatra,
      lagna: `${lagna.name} (${lagna.english})`,
      surya: `${rashi.name} (${rashi.english})`,
      chandra: nakshatra,
      grahas: 9
    },
    birthDetails: {
      date: input.birthDate,
      time: input.birthTime,
      location: input.location.trim()
    },
    interpretation: `Traditional Jyotisha profile for ${input.location.trim()}. This educational result uses a deterministic sign and nakshatra mapping from the supplied birth details; it is not a scientifically validated prediction.`
  };
}

function serveIndex(response) {
  fs.readFile(path.join(ROOT, "index.html"), (error, content) => {
    if (error) {
      sendJson(response, 500, { error: "Unable to load the application" });
      return;
    }
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(content);
  });
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 10000) {
        reject(new Error("Request body is too large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(new Error("Request body must be valid JSON"));
      }
    });
    request.on("error", reject);
  });
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    response.end();
    return;
  }

  if (request.method === "GET" && request.url === "/api/health") {
    sendJson(response, 200, { status: "ok" });
    return;
  }

  if (request.method === "POST" && request.url === "/api/horoscope") {
    try {
      const result = buildHoroscope(await readJson(request));
      if (result.error) {
        sendJson(response, 400, result);
        return;
      }
      sendJson(response, 200, result);
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
    return;
  }

  if (request.method === "GET" && request.url === "/") {
    serveIndex(response);
    return;
  }

  sendJson(response, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`AstroGPT backend listening at http://localhost:${PORT}`);
});