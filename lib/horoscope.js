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

function parseBirthDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
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

function buildHoroscope(input = {}) {
  if (typeof input.name !== "string" || input.name.trim().length < 2) {
    return { error: "name must contain at least 2 characters" };
  }
  const birthDate = parseBirthDate(input.birthDate);
  if (!birthDate) return { error: "birthDate must be a valid date in YYYY-MM-DD format" };
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
  const dailyReadings = [
    "Keep your attention on one meaningful task today. A calm pace will help a useful opportunity become clearer.",
    "A thoughtful conversation may open a new path. Listen closely, then make decisions from a place of balance.",
    "Today favors steady progress over dramatic changes. Finish a small promise to yourself before taking on more.",
    "Your practical insight is especially valuable today. Share it generously, while leaving room for another perspective.",
    "Make space for rest and reflection. The best next step may appear once the noise around you settles."
  ];
  const today = new Date().toISOString().slice(0, 10);
  const dailyReading = dailyReadings[(Math.abs(dayIndex) + today.split("-").reduce((sum, part) => sum + Number(part), 0)) % dailyReadings.length];
  const location = input.location.trim();
  const name = input.name.trim();

  return {
    profile: {
      rashi: `${rashi.name} (${rashi.english})`,
      nakshatra,
      lagna: `${lagna.name} (${lagna.english})`,
      surya: `${rashi.name} (${rashi.english})`,
      chandra: nakshatra,
      grahas: 9
    },
    birthDetails: { name, date: input.birthDate, time: input.birthTime, location },
    dailyHoroscope: { date: today, reading: dailyReading },
    interpretation: `Traditional Jyotisha profile for ${location}. This educational result uses a deterministic sign and nakshatra mapping from the supplied birth details; it is not a scientifically validated prediction.`
  };
}

module.exports = { buildHoroscope };