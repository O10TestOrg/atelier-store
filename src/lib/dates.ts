// Dates as the store shows them: British style, in UK time. Servers run in
// UTC, so without the time zone, times are an hour out during BST.
export const STORE_TIME_ZONE = "Europe/London";

const formatter = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: STORE_TIME_ZONE, ...options });

const long = formatter({ dateStyle: "long" });
const medium = formatter({ dateStyle: "medium" });
const longTime = formatter({ dateStyle: "long", timeStyle: "short" });
const mediumTime = formatter({ dateStyle: "medium", timeStyle: "short" });
const monthYear = formatter({ month: "long", year: "numeric" });

// 9 November 2026
export const formatDate = (date: Date) => long.format(date);
// 9 Nov 2026
export const formatShortDate = (date: Date) => medium.format(date);
// 9 November 2026 at 14:05
export const formatDateTime = (date: Date) => longTime.format(date);
// 9 Nov 2026, 14:05
export const formatShortDateTime = (date: Date) => mediumTime.format(date);
// November 2026
export const formatMonthYear = (date: Date) => monthYear.format(date);
