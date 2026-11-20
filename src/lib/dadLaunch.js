// 9am UK time on Saturday 21 November 2026 (GMT). Shared by checkout and countdown.
export const DAD_LAUNCH_AT = Date.parse('2026-11-21T09:00:00Z');
export const dadSalesOpen = (now = Date.now()) => Number.isFinite(now) && now >= DAD_LAUNCH_AT;
