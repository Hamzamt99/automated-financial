export const money = (value) => `${Number(value || 0).toFixed(2)} د.أ`;
export const number = (value) => new Intl.NumberFormat("ar-JO", { maximumFractionDigits: 2 }).format(Number(value || 0));
export const dayName = (date) => new Intl.DateTimeFormat("ar-JO", { weekday: "long" }).format(new Date(`${date}T12:00:00`));
export const displayDate = (date) => date.split("-").reverse().join("/");
export const initials = (name = "—") => name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("");
export const monthName = (month) => {
  const [year, value] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("ar-JO", { month: "long", year: "numeric" }).format(new Date(year, value - 1));
};
export const currentMonth = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};
export const clampDate = (date, start, end) => date < start ? start : date > end ? end : date;
export const today = () => new Date().toLocaleDateString("en-CA");
