const { SIGNS, NAKSHATRAS, getSignByDate } = require("./signsData");
const { buildHoroscope } = require("./horoscope");

// Elemental compatibility scoring
const ELEMENT_AFFINITIES = {
  "Fire": { "Fire": 92, "Air": 96, "Earth": 70, "Water": 64 },
  "Air": { "Air": 90, "Fire": 96, "Water": 68, "Earth": 74 },
  "Earth": { "Earth": 94, "Water": 97, "Fire": 70, "Air": 74 },
  "Water": { "Water": 95, "Earth": 97, "Fire": 64, "Air": 68 }
};

// Planetary ruler friendship matrix
const RULER_FRIENDSHIPS = {
  "Sun": ["Mars", "Jupiter", "Moon"],
  "Moon": ["Sun", "Mercury", "Jupiter"],
  "Mars": ["Sun", "Moon", "Jupiter"],
  "Mercury": ["Sun", "Venus", "Saturn"],
  "Jupiter": ["Sun", "Moon", "Mars"],
  "Venus": ["Mercury", "Saturn", "Jupiter"],
  "Saturn": ["Mercury", "Venus"],
  "Mars & Pluto": ["Sun", "Moon", "Jupiter"],
  "Saturn & Uranus": ["Mercury", "Venus"],
  "Jupiter & Neptune": ["Sun", "Moon", "Mars"]
};

function getRulerHarmony(ruler1, ruler2) {
  if (ruler1 === ruler2) return 94;
  const friends1 = RULER_FRIENDSHIPS[ruler1] || [];
  const friends2 = RULER_FRIENDSHIPS[ruler2] || [];
  if (friends1.some(f => ruler2.includes(f)) && friends2.some(f => ruler1.includes(f))) {
    return 92;
  }
  if (friends1.some(f => ruler2.includes(f)) || friends2.some(f => ruler1.includes(f))) {
    return 84;
  }
  return 74;
}

function calculatePairCompatibility(personA, personB) {
  const signA = personA.sign;
  const signB = personB.sign;

  const elementScore = (ELEMENT_AFFINITIES[signA.element] && ELEMENT_AFFINITIES[signA.element][signB.element]) || 78;
  const rulerScore = getRulerHarmony(signA.ruler, signB.ruler);

  // Modality interaction
  let modalityScore = 80;
  if (signA.modality === signB.modality) {
    modalityScore = signA.modality === "Fixed" ? 75 : 85;
  } else if (
    (signA.modality === "Cardinal" && signB.modality === "Mutable") ||
    (signA.modality === "Mutable" && signB.modality === "Cardinal")
  ) {
    modalityScore = 92;
  } else {
    modalityScore = 88;
  }

  // Nakshatra lunar resonance
  const nakshatraA = personA.profile.nakshatra;
  const nakshatraB = personB.profile.nakshatra;
  const charSum = (nakshatraA.length + nakshatraB.length) % 15;
  const lunarScore = 78 + charSum;

  // Composite overall score
  const overall = Math.round(
    elementScore * 0.35 +
    rulerScore * 0.25 +
    modalityScore * 0.20 +
    lunarScore * 0.20
  );

  // Sub-scores
  const emotional = Math.min(99, Math.round(
    (signA.element === "Water" || signB.element === "Water" ? 92 : 80) * 0.5 +
    lunarScore * 0.5
  ));

  const spark = Math.min(99, Math.round(
    (signA.element === "Fire" || signB.element === "Fire" ? 95 : 82) * 0.5 +
    rulerScore * 0.5
  ));

  const intellectual = Math.min(99, Math.round(
    (signA.element === "Air" || signB.element === "Air" ? 96 : 82) * 0.5 +
    modalityScore * 0.5
  ));

  const stability = Math.min(99, Math.round(
    (signA.element === "Earth" || signB.element === "Earth" ? 96 : 79) * 0.5 +
    elementScore * 0.5
  ));

  let synergyTitle = "Harmonious Alliance";
  let advice = "Your signs blend gracefully with shared understanding and mutual respect.";

  if (overall >= 90) {
    synergyTitle = "Cosmic Soulmate Synergy";
    advice = "An exceptional alignment of elemental forces and planetary rulers. Natural trust, effortless flow, and profound mutual growth.";
  } else if (overall >= 82) {
    synergyTitle = "Dynamic Creative Chemistry";
    advice = "Strong magnetic resonance. You inspire each other to expand perspectives while balancing one another's natural blind spots.";
  } else if (overall >= 74) {
    synergyTitle = "Complementary Growth Partners";
    advice = "Different approaches that yield deep stability when communication stays open. You offer distinct views that ground and elevate each other.";
  } else {
    synergyTitle = "Intriguing Catalyst";
    advice = "Unique cosmic temperaments that challenge each other to evolve. Patience and appreciation of your differences create powerful loyalty.";
  }

  return {
    personA: { name: personA.birthDetails.name, sign: signA.name, glyph: signA.glyph, element: signA.element },
    personB: { name: personB.birthDetails.name, sign: signB.name, glyph: signB.glyph, element: signB.element },
    overallScore: Math.min(99, Math.max(60, overall)),
    synergyTitle,
    advice,
    breakdown: {
      emotional,
      spark,
      intellectual,
      stability,
      elementHarmony: elementScore,
      planetaryHarmony: rulerScore
    }
  };
}

function calculateGroupMatches(people = []) {
  if (!Array.isArray(people) || people.length < 2) {
    return { error: "Please provide at least 2 people to find matches and compatibility." };
  }

  const profiles = [];
  for (const p of people) {
    const horoscope = buildHoroscope(p);
    if (horoscope.error) {
      return { error: `Error for ${p.name || "person"}: ${horoscope.error}` };
    }
    profiles.push(horoscope);
  }

  const pairs = [];
  for (let i = 0; i < profiles.length; i++) {
    for (let j = i + 1; j < profiles.length; j++) {
      const match = calculatePairCompatibility(profiles[i], profiles[j]);
      pairs.push(match);
    }
  }

  // Sort pairs by overall score descending
  pairs.sort((a, b) => b.overallScore - a.overallScore);

  const bestMatch = pairs[0];

  return {
    peopleCount: profiles.length,
    profiles: profiles.map(p => ({
      name: p.birthDetails.name,
      birthDate: p.birthDetails.date,
      sign: p.sign.name,
      sanskrit: p.sign.sanskrit,
      glyph: p.sign.glyph,
      element: p.sign.element,
      ruler: p.sign.ruler
    })),
    bestMatch,
    pairs,
    evaluatedAt: new Date().toISOString()
  };
}

module.exports = {
  calculatePairCompatibility,
  calculateGroupMatches
};
