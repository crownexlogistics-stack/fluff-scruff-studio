// Color palette for staff members — each gets a unique color
const STAFF_COLORS = [
  { bg: "bg-purple-600", text: "text-white", hex: "#9333ea" },
  { bg: "bg-red-700", text: "text-white", hex: "#b91c1c" },
  { bg: "bg-amber-500", text: "text-white", hex: "#f59e0b" },
  { bg: "bg-emerald-600", text: "text-white", hex: "#059669" },
  { bg: "bg-blue-600", text: "text-white", hex: "#2563eb" },
  { bg: "bg-pink-600", text: "text-white", hex: "#db2777" },
  { bg: "bg-teal-600", text: "text-white", hex: "#0d9488" },
  { bg: "bg-orange-600", text: "text-white", hex: "#ea580c" },
];

export function getStaffColor(index: number) {
  return STAFF_COLORS[index % STAFF_COLORS.length];
}
