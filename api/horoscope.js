const { buildHoroscope } = require("../lib/horoscope");

module.exports = function horoscope(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const result = buildHoroscope(request.body);
  response.status(result.error ? 400 : 200).json(result);
};