import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  freebusyQuery: vi.fn(),
  eventsInsert: vi.fn(),
  getAuthorizedClientForAccount: vi.fn(),
}));

vi.mock('googleapis', () => ({
  google: {
    calendar: vi.fn(() => ({
      freebusy: {
        query: mocks.freebusyQuery,
      },
      events: {
        insert: mocks.eventsInsert,
      },
    })),
  },
}));

vi.mock('../services/googleOAuth.service', () => ({
  getAuthorizedClientForAccount: mocks.getAuthorizedClientForAccount,
}));

const { getAvailability, createMeetingEvent } = await import('../services/googleCalendar.service');

const integration = {
  calendarId: 'primary',
  timezone: 'America/Santiago',
  workingHours: {
    wed: { start: '09:00', end: '11:00' },
  },
  bufferMinutes: 15,
  meetingDurationMinutes: 30,
};

describe('googleCalendar.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthorizedClientForAccount.mockResolvedValue({
      client: {},
      integration,
    });
  });

  it('returns timezone-aware slots and respects buffer around busy events', async () => {
    mocks.freebusyQuery.mockResolvedValue({
      data: {
        calendars: {
          primary: {
            busy: [
              {
                start: '2026-06-03T13:30:00.000Z',
                end: '2026-06-03T14:00:00.000Z',
              },
            ],
          },
        },
      },
    });

    const result = await getAvailability('ig-account-1', {
      from: '2026-06-03T13:00:00.000Z',
      to: '2026-06-03T15:00:00.000Z',
      durationMin: 30,
    });

    expect(result.timezone).toBe('America/Santiago');
    expect(result.slots).toHaveLength(1);
    expect(result.slots[0]).toMatchObject({
      startIso: '2026-06-03T14:15:00.000Z',
      endIso: '2026-06-03T14:45:00.000Z',
      startLocal: '2026-06-03T10:15:00-04:00',
      endLocal: '2026-06-03T10:45:00-04:00',
    });
    expect(result.slots[0].label).toContain('10:15');
    expect(mocks.freebusyQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: expect.objectContaining({
          timeMin: '2026-06-03T12:45:00.000Z',
          timeMax: '2026-06-03T15:15:00.000Z',
        }),
      })
    );
  });

  it('rejects meeting creation when the requested slot is not available', async () => {
    mocks.freebusyQuery.mockResolvedValue({
      data: {
        calendars: {
          primary: {
            busy: [
              {
                start: '2026-06-03T13:30:00.000Z',
                end: '2026-06-03T14:00:00.000Z',
              },
            ],
          },
        },
      },
    });

    await expect(
      createMeetingEvent('ig-account-1', {
        summary: 'Demo Moca',
        startIso: '2026-06-03T13:30:00.000Z',
        endIso: '2026-06-03T14:00:00.000Z',
        attendees: [{ email: 'lead@example.com', name: 'Lead' }],
      })
    ).rejects.toThrow(/not available/i);

    expect(mocks.eventsInsert).not.toHaveBeenCalled();
  });
});
