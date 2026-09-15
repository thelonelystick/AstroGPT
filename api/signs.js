const { SIGNS, NAKSHATRAS } = require("../lib/signsData");

module.exports = function signs(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const signs = SIGNS.map((sign) => ({
    ...sign,
    nakshatras: NAKSHATRAS.filter((nakshatra) =>
      nakshatra.sign.split(" / ").includes(sign.name) || nakshatra.sign.includes(sign.name)
    )
  }));

  response.status(200).json({ signs, nakshatras: NAKSHATRAS });
};
