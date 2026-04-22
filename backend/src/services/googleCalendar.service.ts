import { google, calendar_v3 } from 'googleapis';
import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz';
import { getAuthorizedClientForAccount } from './googleOAuth.service';
import type { ICalendarIntegration, WorkingHours, Weekday } from '../models/calendarIntegration.model';

/**
 * Google Calendar business primitives used by the Moca scheduling MCP tools.
 *
 * Public API:
 *   - getAvailability(accountId, { from, to, durationMin? }) → free slots within workingHours
 *   - createMeetingEvent(accountId, { summary, description, startIso, endIso, attendees })
 *       → creates an event with Google Meet and sends invites
 *
 * We intentionally keep this thin — no retry/caching — so higher-level flows can compose.
 */

const WEEKDAY_ORDER: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

interface AvailabilitySlot {
  startIso: string; // ISO 8601 with offset
  endIso: string;
  startLocal: string;
  endLocal: string;
  label: string;
}

interface GetAvailabilityOptions {
  from: string; // ISO
  to: string; // ISO
  durationMin?: number;
}

interface CreateMeetingEventOptions {
  summary: string;
  description?: string;
  startIso: string;
  endIso: string;
  attendees: Array<{ email: string; name?: string }>;
  location?: string;
}

// ───────────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────────

const parseHHMM = (hhmm: string): { hour: number; minute: number } => {
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10));
  return { hour: h || 0, minute: m || 0 };
};

const roundUpToMinutes = (date: Date, stepMinutes: number): Date => {
  const stepMs = stepMinutes * 60_000;
  return new Date(Math.ceil(date.getTime() / stepMs) * stepMs);
};

const toAvailabilitySlot = (start: Date, end: Date, timezone: string): AvailabilitySlot => ({
  startIso: start.toISOString(),
  endIso: end.toISOString(),
  startLocal: formatInTimeZone(start, timezone, "yyyy-MM-dd'T'HH:mm:ssXXX"),
  endLocal: formatInTimeZone(end, timezone, "yyyy-MM-dd'T'HH:mm:ssXXX"),
  label: `${formatInTimeZone(start, timezone, 'yyyy-MM-dd HH:mm zzz')} - ${formatInTimeZone(end, timezone, 'HH:mm zzz')}`,
});

/**
 * Expand working-hours windows (in the integration's timezone) to concrete
 * [start, end] UTC Date pairs over [from, to].
 */
const expandWorkingWindows = (
  from: Date,
  to: Date,
  workingHours: WorkingHours,
  timezone: string
): Array<{ start: Date; end: Date }> => {
  const windows: Array<{ start: Date; end: Date }> = [];
  // Iterate day-by-day in the target timezone
  const cursorZoned = toZonedTime(from, timezone);
  cursorZoned.setHours(0, 0, 0, 0);
  const toTs = to.getTime();

  // Hard cap at 60 days to avoid runaway loops.
  for (let i = 0; i < 60; i += 1) {
    const dayZoned = new Date(cursorZoned);
    dayZoned.setDate(dayZoned.getDate() + i);
    const dowIndex = dayZoned.getDay(); // 0..6 in local (timezone) — acceptable approximation
    const weekday = WEEKDAY_ORDER[dowIndex];
    const window = workingHours?.[weekday];
    if (!window) continue;

    const { hour: sh, minute: sm } = parseHHMM(window.start);
    const { hour: eh, minute: em } = parseHHMM(window.end);

    // Build wall-clock-in-timezone start/end, then convert to UTC Dates.
    const y = dayZoned.getFullYear();
    const mo = String(dayZoned.getMonth() + 1).padStart(2, '0');
    const d = String(dayZoned.getDate()).padStart(2, '0');
    const startIso = `${y}-${mo}-${d}T${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}:00`;
    const endIso = `${y}-${mo}-${d}T${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}:00`;
    const startUtc = fromZonedTime(startIso, timezone);
    const endUtc = fromZonedTime(endIso, timezone);

    // Clip to the requested range
    const clippedStart = startUtc < from ? from : startUtc;
    const clippedEnd = endUtc > to ? to : endUtc;
    if (clippedStart < clippedEnd) {
      windows.push({ start: clippedStart, end: clippedEnd });
    }
    if (endUtc.getTime() > toTs) break;
  }

  return windows;
};

/**
 * Subtract busy intervals from working windows, then slice the remainder into
 * fixed-length slots (duration + buffer).
 */
const carveSlots = (
  windows: Array<{ start: Date; end: Date }>,
  busy: Array<{ start: Date; end: Date }>,
  durationMin: number,
  bufferMin: number,
  timezone: string
): AvailabilitySlot[] => {
  const slots: AvailabilitySlot[] = [];
  const slotMs = durationMin * 60_000;
  const bufferMs = bufferMin * 60_000;

  // Normalize + sort busy. The configured buffer protects time before and after
  // existing meetings, not only spacing between generated slots.
  const busySorted = busy
    .map((b) => ({
      start: new Date(b.start.getTime() - bufferMs),
      end: new Date(b.end.getTime() + bufferMs),
    }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  for (const w of windows) {
    // Build free intervals within this window by subtracting busy
    let free: Array<{ start: Date; end: Date }> = [{ start: w.start, end: w.end }];
    for (const b of busySorted) {
      const next: Array<{ start: Date; end: Date }> = [];
      for (const f of free) {
        if (b.end <= f.start || b.start >= f.end) {
          next.push(f);
          continue;
        }
        if (b.start > f.start) next.push({ start: f.start, end: b.start });
        if (b.end < f.end) next.push({ start: b.end, end: f.end });
      }
      free = next;
    }

    // Slice each free interval into slots, respecting buffer between slots
    for (const f of free) {
      let cursor = roundUpToMinutes(f.start, 15).getTime();
      while (cursor + slotMs <= f.end.getTime()) {
        const start = new Date(cursor);
        const end = new Date(cursor + slotMs);
        slots.push(toAvailabilitySlot(start, end, timezone));
        cursor += slotMs + bufferMs;
      }
    }
  }

  return slots;
};

const getCalendarApi = (auth: any): calendar_v3.Calendar => google.calendar({ version: 'v3', auth });

// ───────────────────────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────────────────────

export const getAvailability = async (
  accountId: string,
  opts: GetAvailabilityOptions
): Promise<{
  slots: AvailabilitySlot[];
  timezone: string;
  calendarId: string;
  durationMin: number;
}> => {
  const { client, integration } = await getAuthorizedClientForAccount(accountId);
  const calendar = getCalendarApi(client);

  const from = new Date(opts.from);
  const to = new Date(opts.to);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
    throw new Error('Invalid from/to range.');
  }

  // Cap window at 30 days to protect quota.
  const MAX_MS = 30 * 24 * 60 * 60 * 1000;
  if (to.getTime() - from.getTime() > MAX_MS) {
    throw new Error('Range too large: max 30 days.');
  }

  const durationMin = opts.durationMin || integration.meetingDurationMinutes || 30;
  const bufferMin = integration.bufferMinutes ?? 15;
  const now = new Date();
  const effectiveFrom = from < now ? now : from;

  if (effectiveFrom >= to) {
    throw new Error('Invalid from/to range: requested window is in the past.');
  }

  const bufferMs = bufferMin * 60_000;

  const freeBusyRes = await calendar.freebusy.query({
    requestBody: {
      timeMin: new Date(effectiveFrom.getTime() - bufferMs).toISOString(),
      timeMax: new Date(to.getTime() + bufferMs).toISOString(),
      timeZone: integration.timezone,
      items: [{ id: integration.calendarId || 'primary' }],
    },
  });

  const busyRaw = freeBusyRes.data.calendars?.[integration.calendarId || 'primary']?.busy || [];
  const busy = busyRaw
    .filter((b) => b.start && b.end)
    .map((b) => ({ start: new Date(b.start as string), end: new Date(b.end as string) }));

  const windows = expandWorkingWindows(effectiveFrom, to, integration.workingHours, integration.timezone);
  const slots = carveSlots(windows, busy, durationMin, bufferMin, integration.timezone);

  return {
    slots,
    timezone: integration.timezone,
    calendarId: integration.calendarId || 'primary',
    durationMin,
  };
};

export const createMeetingEvent = async (
  accountId: string,
  opts: CreateMeetingEventOptions
): Promise<{
  eventId: string;
  htmlLink?: string;
  meetLink?: string;
  start?: string;
  end?: string;
  status?: string;
}> => {
  const { client, integration } = await getAuthorizedClientForAccount(accountId);
  const calendar = getCalendarApi(client);
  const requestedStart = new Date(opts.startIso);
  const requestedEnd = new Date(opts.endIso);

  if (
    Number.isNaN(requestedStart.getTime()) ||
    Number.isNaN(requestedEnd.getTime()) ||
    requestedStart >= requestedEnd
  ) {
    throw new Error('Invalid event start/end range.');
  }

  const durationMin = Math.round((requestedEnd.getTime() - requestedStart.getTime()) / 60_000);
  const availability = await getAvailability(accountId, {
    from: opts.startIso,
    to: opts.endIso,
    durationMin,
  });
  const exactSlot = availability.slots.find(
    (slot) =>
      new Date(slot.startIso).getTime() === requestedStart.getTime() &&
      new Date(slot.endIso).getTime() === requestedEnd.getTime()
  );

  if (!exactSlot) {
    throw new Error(
      `Requested meeting time is not available in ${integration.timezone}. Ask the lead to choose one of the available slots first.`
    );
  }

  const requestId = `moca-meet-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const response = await calendar.events.insert({
    calendarId: integration.calendarId || 'primary',
    conferenceDataVersion: 1,
    sendUpdates: 'all',
    requestBody: {
      summary: opts.summary,
      description: opts.description,
      location: opts.location,
      start: { dateTime: opts.startIso, timeZone: integration.timezone },
      end: { dateTime: opts.endIso, timeZone: integration.timezone },
      attendees: opts.attendees.map((a) => ({ email: a.email, displayName: a.name })),
      conferenceData: {
        createRequest: {
          requestId,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
      reminders: { useDefault: true },
    },
  });

  const event = response.data;
  const meetEntry = event.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video');

  return {
    eventId: event.id as string,
    htmlLink: event.htmlLink ?? undefined,
    meetLink: meetEntry?.uri ?? event.hangoutLink ?? undefined,
    start: event.start?.dateTime ?? undefined,
    end: event.end?.dateTime ?? undefined,
    status: event.status ?? undefined,
  };
};

/**
 * Helper used by `get_calendar_config` MCP tool — exposes safe config + live
 * connection state without leaking tokens.
 */
export const getCalendarConfigForAccount = async (
  accountId: string
): Promise<{
  connected: boolean;
  integration: ICalendarIntegration | null;
}> => {
  const { default: CalendarIntegration } = await import('../models/calendarIntegration.model');
  const integration = await CalendarIntegration.findOne({ accountId });
  return {
    connected: !!integration && integration.status === 'connected' && integration.enabled,
    integration,
  };
};

// Re-export helper for HTTP layer.
export const timezoneLabel = (tz: string): string => {
  try {
    return formatInTimeZone(new Date(), tz, 'zzz');
  } catch {
    return tz;
  }
};
