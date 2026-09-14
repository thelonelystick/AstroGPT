const { calculateGroupMatches } = require("../lib/compatibility");

module.exports = function match(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const people = request.body.people || request.body;
  const result = calculateGroupMatches(people);
  response.status(result.error ? 400 : 200).json(result);
};
