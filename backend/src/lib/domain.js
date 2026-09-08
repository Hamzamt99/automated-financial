import { AppError } from "./errors.js";

export const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function getPayPeriod(monthValue, startDay = 21) {
  if (!MONTH_PATTERN.test(monthValue)) throw new AppError(400, "صيغة الشهر غير صحيحة.", "INVALID_MONTH");
  const [year, month] = monthValue.split("-").map(Number);
  const previousMonth = month === 1 ? 12 : month - 1;
  const previousYear = month === 1 ? year - 1 : year;
  const pad = (value) => String(value).padStart(2, "0");
  return {
    month: monthValue,
    start: `${previousYear}-${pad(previousMonth)}-${pad(startDay)}`,
    end: `${year}-${pad(month)}-${pad(startDay - 1)}`
  };
}

export const numeric = (value) => Number.parseFloat(value || 0);
export const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
