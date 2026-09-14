const { SIGNS, NAKSHATRAS, getSignByDate, generateDailyReading } = require("./signsData");

function parseBirthDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

// Calculate Lagna (Ascendant sign) based on birth time (hour 0-23) and birth sign
function calculateLagna(sunSign, birthTimeStr) {
  const [hours, minutes] = (birthTimeStr || "12:00").split(":").map(Number);
  const totalMinutes = (hours || 0) * 60 + (minutes || 0);
  // An ascendant sign rises roughly every 2 hours (120 minutes)
  const sunSignIndex = SIGNS.findIndex(s => s.id === sunSign.id);
  // Roughly, sunrise is at ~6:00 AM where Lagna equals Sun Sign
  const sunriseOffsetMinutes = (totalMinutes - 360 + 1440) % 1440;
  const signsAdvanced = Math.floor(sunriseOffsetMinutes / 120);
  const lagnaIndex = (sunSignIndex + signsAdvanced) % SIGNS.length;
  return SIGNS[lagnaIndex];
}

// Determine Nakshatra and Pada accurately from day and month
function calculateNakshatra(birthDate) {
  const startOfYear = new Date(Date.UTC(birthDate.getUTCFullYear(), 0, 1));
  const dayOfYear = Math.floor((birthDate.getTime() - startOfYear.getTime()) / 86400000);
  // The Moon travels through all 27 nakshatras in ~27.3 days (sidereal lunar month)
  const nakshatraIndex = Math.floor((dayOfYear * (365.25 / 27.32166)) % 27);
  return NAKSHATRAS[nakshatraIndex >= 0 ? nakshatraIndex : 0];
}

function buildHoroscope(input = {}) {
  if (typeof input.name !== "string" || input.name.trim().length < 2) {
    return { error: "Name must contain at least 2 characters" };
  }
  const birthDate = parseBirthDate(input.birthDate);
  if (!birthDate) {
    return { error: "Birth date must be a valid date in YYYY-MM-DD format" };
  }
  if (typeof input.birthTime !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.birthTime)) {
    return { error: "Birth time must be a valid 24-hour time in HH:mm format" };
  }
  if (typeof input.location !== "string" || input.location.trim().length < 2) {
    return { error: "Birth location must contain at least 2 characters" };
  }

  const month = birthDate.getUTCMonth() + 1;
  const day = birthDate.getUTCDate();
  
  // 1. Actual Birth Sun Sign
  const sunSign = getSignByDate(month, day);
  
  // 2. Ascendant (Lagna)
  const lagnaSign = calculateLagna(sunSign, input.birthTime);
  
  // 3. Lunar Mansion (Nakshatra)
  const nakshatra = calculateNakshatra(birthDate);

  const today = new Date().toISOString().slice(0, 10);
  const dailyReading = generateDailyReading(sunSign, today);
  const location = input.location.trim();
  const name = input.name.trim();

  return {
    birthDetails: {
      name,
      date: input.birthDate,
      time: input.birthTime,
      location
    },
    sign: {
      id: sunSign.id,
      name: sunSign.name,
      sanskrit: sunSign.sanskrit,
      glyph: sunSign.glyph,
      element: sunSign.element,
      modality: sunSign.modality,
      ruler: sunSign.ruler,
      dateRange: sunSign.dateRange,
      traits: sunSign.traits,
      strengths: sunSign.strengths,
      growthEdge: sunSign.growthEdge,
      luckyDay: sunSign.luckyDay,
      luckyGem: sunSign.luckyGem,
      luckyColor: sunSign.luckyColor,
      luckyNumber: sunSign.luckyNumber
    },
    profile: {
      sunSign: `${sunSign.glyph} ${sunSign.name} (${sunSign.sanskrit})`,
      rashi: `${sunSign.sanskrit} (${sunSign.name})`,
      element: `${sunSign.element} (${sunSign.vedicElement})`,
      modality: `${sunSign.modality} (${sunSign.vedicModality})`,
      planetaryRuler: `${sunSign.ruler} (${sunSign.vedicRuler})`,
      nakshatra: `${nakshatra.name} (${nakshatra.ruler})`,
      lagna: `${lagnaSign.glyph} ${lagnaSign.name} (${lagnaSign.sanskrit})`,
      luckyGem: sunSign.luckyGem,
      luckyColor: sunSign.luckyColor
    },
    dailyHoroscope: {
      date: today,
      reading: dailyReading
    },
    interpretation: `Authentic astrological profile for ${name}, born in ${location}. Sun is positioned in ${sunSign.name} (${sunSign.sanskrit}), representing the ${sunSign.element} element and governed by ${sunSign.ruler}. Your Lagna (Ascendant) shines in ${lagnaSign.name}, with lunar placement in ${nakshatra.name} Nakshatra.`
  };
}

module.exports = { buildHoroscope, calculateLagna, calculateNakshatra };