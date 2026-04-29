export const DEFAULT_PEOPLE = [
  { id: "shao",  name: "Shao",  color: "#c2410c" },
  { id: "keith", name: "Keith", color: "#0e7490" },
  { id: "marco", name: "Marco", color: "#7c3aed" },
];

const ALL = ["shao", "keith", "marco"];
const SOLO = ["shao"];

export const seedTrip = {
  title: "Asia 2026",
  subtitle: "LAX → Taiwan → Philippines → Vietnam → LAX",
  people: DEFAULT_PEOPLE,
  legs: [
    { id: "lax-tpe", from: { name: "Los Angeles (LAX)", lat: 33.9425, lon: -118.4081 }, to: { name: "Taipei (TPE)", lat: 25.0330, lon: 121.5654 }, date: "2026-11-13", departTime: "", arriveTime: "", type: "flight", flightNumber: "", participants: SOLO, notes: "Outbound. ~14h flight." },
    { id: "taiwan-stay", from: { name: "Taipei", lat: 25.0330, lon: 121.5654 }, to: { name: "Taipei", lat: 25.0330, lon: 121.5654 }, date: "2026-11-13", endDate: "2026-11-19", type: "stay", participants: SOLO, notes: "6 nights in Taiwan." },
    { id: "tpe-mnl", from: { name: "Taipei (TPE)", lat: 25.0330, lon: 121.5654 }, to: { name: "Manila (MNL)", lat: 14.5995, lon: 120.9842 }, date: "2026-11-19", departTime: "", arriveTime: "", type: "flight", flightNumber: "", participants: SOLO, notes: "~2h." },
    { id: "philippines-stay", from: { name: "Philippines", lat: 14.5995, lon: 120.9842 }, to: { name: "Philippines", lat: 14.5995, lon: 120.9842 }, date: "2026-11-19", endDate: "2026-11-24", type: "stay", participants: ALL, notes: "Manila / island time. Meet up with Keith + Marco." },
    { id: "mnl-han", from: { name: "Manila (MNL)", lat: 14.5995, lon: 120.9842 }, to: { name: "Hanoi (HAN)", lat: 21.0285, lon: 105.8542 }, date: "2026-11-24", departTime: "", arriveTime: "", type: "flight", flightNumber: "", participants: ALL, notes: "Approximate." },
    { id: "vietnam-stay", from: { name: "Hanoi", lat: 21.0285, lon: 105.8542 }, to: { name: "Hanoi", lat: 21.0285, lon: 105.8542 }, date: "2026-11-24", endDate: "2026-11-29", type: "stay", participants: ALL, notes: "Hanoi base." },
    { id: "han-lax", from: { name: "Hanoi (HAN)", lat: 21.0285, lon: 105.8542 }, to: { name: "Los Angeles (LAX)", lat: 33.9425, lon: -118.4081 }, date: "2026-11-29", departTime: "", arriveTime: "", type: "flight", flightNumber: "", participants: SOLO, notes: "Return Nov 29 or 30." },
  ],
  packing: [
    { id: "passport", label: "Passport (>6mo validity)", category: "Documents" },
    { id: "visas", label: "Vietnam e-visa printed", category: "Documents" },
    { id: "insurance", label: "Travel insurance card", category: "Documents" },
    { id: "cards", label: "2 credit cards + some USD", category: "Money" },
    { id: "adapter", label: "Universal power adapter", category: "Electronics" },
    { id: "powerbank", label: "Power bank (<100Wh)", category: "Electronics" },
    { id: "esim", label: "eSIM / Airalo plan", category: "Electronics" },
    { id: "meds", label: "Personal meds + Imodium", category: "Health" },
    { id: "sunscreen", label: "Sunscreen", category: "Health" },
    { id: "lightclothes", label: "Light/breathable clothes", category: "Clothes" },
    { id: "rainjacket", label: "Rain jacket", category: "Clothes" },
    { id: "sandals", label: "Sandals + walking shoes", category: "Clothes" },
  ],
  todos: [
    { id: "book-tpe-mnl", label: "Book TPE → MNL flight" },
    { id: "book-mnl-han", label: "Book MNL → HAN flight" },
    { id: "book-han-lax", label: "Book HAN → LAX return" },
    { id: "vn-evisa", label: "Apply for Vietnam e-visa (~3 days)" },
    { id: "ph-arrival", label: "Fill PH eTravel form (within 72h of arrival)" },
    { id: "tw-entry", label: "Check Taiwan entry requirements" },
    { id: "hotels-tw", label: "Book Taiwan hotels" },
    { id: "hotels-ph", label: "Book Philippines hotels" },
    { id: "hotels-vn", label: "Book Hanoi hotel" },
    { id: "decide-4th", label: "Decide on optional 4th country" },
    { id: "notify-bank", label: "Notify bank of travel dates" },
    { id: "esim-buy", label: "Buy eSIM data plans" },
  ],
};

export function ensureShape(trip) {
  if (!trip) return { trip: null, changed: false };
  let changed = false;
  const next = { ...trip };
  if (!Array.isArray(next.people) || next.people.length === 0) {
    next.people = DEFAULT_PEOPLE;
    changed = true;
  }
  const firstId = next.people[0].id;
  next.legs = (next.legs || []).map((leg) => {
    if (!Array.isArray(leg.participants) || leg.participants.length === 0) {
      changed = true;
      return { ...leg, participants: [firstId] };
    }
    return leg;
  });
  return { trip: next, changed };
}
