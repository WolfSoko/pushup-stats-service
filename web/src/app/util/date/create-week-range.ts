import { toLocalIsoDate } from './to-local-iso-date';

export function createWeekRange(): { from: string; to: string } {
  const now = new Date();
  const to = toLocalIsoDate(now);
  const fromDate = new Date(now);
  fromDate.setDate(fromDate.getDate() - 6);
  const from = toLocalIsoDate(fromDate);
  return { from, to };
}
