const http = require("http");
const fs = require("fs");
const path = require("path");
const { buildHoroscope } = require("./lib/horoscope");

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*"
  });
  response.end(JSON.stringify(body));
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