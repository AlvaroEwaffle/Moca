import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  calendarFindOne: vi.fn(),
  getAvailability: vi.fn(),
  createMeetingEvent: vi.fn(),
}));

vi.mock('../models/calendarIntegration.model', () => ({
  default: {
    findOne: mocks.calendarFindOne,
  },
}));

vi.mock('../services/googleCalendar.service', () => ({
  getAvailability: mocks.getAvailability,
  createMeetingEvent: mocks.createMeetingEvent,
}));

const { extractCalendarDateIntent, loadCalendarToolsForAccount } = await import(
  '../services/nativeAgentTools.service'
);

const connectedIntegration = {
  status: 'connected',
  enabled: true,
  timezone: 'America/Santiago',
  calendarId: 'primary',
  meetingDurationMinutes: 30,
  bufferMinutes: 15,
};

describe('nativeAgentTools calendar date handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.calendarFindOne.mockResolvedValue(connectedIntegration);
    mocks.getAvailability.mockResolvedValue({
      slots: [],
      timezone: 'America/Santiago',
      calendarId: 'primary',
      durationMin: 30,
    });
  });

  it('resolves "mañana" to the next local calendar day', () => {
    const intent = extractCalendarDateIntent(
      'Agenda una sesión para mañana',
      'America/Santiago',
      new Date('2026-04-22T15:05:00-04:00')
    );

    expect(intent).toMatchObject({
      date: '2026-04-23',
      source: 'manana',
      fromIso: '2026-04-23T04:00:00.000Z',
      toIso: '2026-04-24T04:00:00.000Z',
    });
  });

  it('overrides an incorrect model range with the user-requested relative date', async () => {
    const bundle = await loadCalendarToolsForAccount({
      accountId: '17841467023627361',
      currentUserMessage: 'Agenda una sesión para mañana',
      now: new Date('2026-04-22T15:05:00-04:00'),
    });

    await bundle!.execute('get_calendar_availability', {
      fromIso: '2026-04-26T04:00:00.000Z',
      toIso: '2026-04-27T04:00:00.000Z',
      durationMin: 30,
    });

    expect(mocks.getAvailability).toHaveBeenCalledWith('17841467023627361', {
      from: '2026-04-23T04:00:00.000Z',
      to: '2026-04-24T04:00:00.000Z',
      durationMin: 30,
    });
  });

  it('rejects scheduling on a different local date than the one requested by the lead', async () => {
    const bundle = await loadCalendarToolsForAccount({
      accountId: '17841467023627361',
      currentUserMessage: 'Agenda una sesión para mañana',
      now: new Date('2026-04-22T15:05:00-04:00'),
    });

    await expect(
      bundle!.execute('schedule_meeting', {
        attendeeName: 'Alvaro',
        attendeeEmail: 'alvaro@example.com',
        startIso: '2026-04-26T14:00:00.000Z',
      })
    ).rejects.toThrow(/Lead requested manana \(2026-04-23\)/);

    expect(mocks.createMeetingEvent).not.toHaveBeenCalled();
  });
});
