/**
 * S2 B1 (17. 10. 2026): datum splatnosti faktury.
 *
 * § 605 odst. 1 OZ (zákon č. 89/2012 Sb.): lhůta určená podle dnů počíná dnem, který následuje po skutečnosti rozhodné
 * pro její počátek → splatnost „14 dní od vystavení“ = datum vystavení + 14 dní.
 * § 607 OZ: připadne-li poslední den lhůty na sobotu, neděli nebo svátek, je posledním dnem lhůty pracovní den nejblíže
 * následující. Zda se to vztahuje i na sjednanou splatnost faktury, zákon výslovně neříká – nástroj proto ukazuje obojí.
 * Svátky podle zákona č. 245/2000 Sb. (viz @ez/cz/holidays) – kontrolujeme jen pro roky HOLIDAY_YEARS.
 */
import { addDays, czHolidayName, isIsoDate, isWeekend, nextCzWorkingDay, weekdayCs } from "@ez/cz/holidays";

/** Roky, pro které svátky ukazujeme (podle znění zákona č. 245/2000 Sb. platného k 17. 10. 2026). */
export const HOLIDAY_YEARS = { from: 2024, to: 2030 } as const;
/** Mezi podnikateli: splatnost delší než 60 dní jen výslovně a ne zvláště nevýhodně pro věřitele (§ 1963 odst. 2 OZ). */
export const B2B_LONG_DUE_DAYS = 60;
export const MAX_DUE_DAYS = 3650;

export type DueDateResult =
  | {
      ok: true;
      due: string;
      weekday: string;
      /** název svátku, připadá-li splatnost na svátek */
      holiday: string | null;
      weekend: boolean;
      /** nejbližší pracovní den (= due, je-li pracovní) */
      nextWorking: string;
      nextWorkingWeekday: string;
      /** svátky pro tento rok neověřujeme */
      holidaysUnknown: boolean;
      longB2b: boolean;
    }
  | { ok: false; error: "date" | "days" };

const inHolidayYears = (date: string) => {
  const y = Number(date.slice(0, 4));
  return y >= HOLIDAY_YEARS.from && y <= HOLIDAY_YEARS.to;
};

export function dueDate(issued: string, days: number): DueDateResult {
  if (!isIsoDate(issued)) return { ok: false, error: "date" };
  if (!Number.isInteger(days) || days < 0 || days > MAX_DUE_DAYS) return { ok: false, error: "days" };
  const due = addDays(issued, days);
  const known = inHolidayYears(due);
  const holiday = known ? czHolidayName(due) : null;
  const weekend = isWeekend(due);
  let nextWorking = due;
  if (known) nextWorking = nextCzWorkingDay(due);
  else while (isWeekend(nextWorking)) nextWorking = addDays(nextWorking, 1);
  return {
    ok: true,
    due,
    weekday: weekdayCs(due),
    holiday,
    weekend,
    nextWorking,
    nextWorkingWeekday: weekdayCs(nextWorking),
    holidaysUnknown: !known,
    longB2b: days > B2B_LONG_DUE_DAYS,
  };
}
