import mongoose, { Document, Schema } from 'mongoose';
import { encrypt, decrypt } from '../utils/crypto';

/**
 * CalendarIntegration — per-Instagram-account Google Calendar OAuth connection.
 *
 * Design notes:
 * - accountId is the Instagram canonical IG_ID (same string used as Conversation.accountId).
 *   A Moca user may connect multiple Instagram accounts, each with its own Google Calendar.
 * - Tokens are AES-256-GCM encrypted via utils/crypto before storage.
 * - `workingHours` is a weekday → {start, end} (HH:mm, 24h, interpreted in `timezone`).
 * - Tokens persist across process restarts; refresh is handled by googleOAuth.service.ts.
 *
 * NOTE: We do NOT reuse Moca's existing `integration.model.ts` because:
 *   - That model enforces `unique(userId, type)` (single google_calendar per user).
 *   - We need per-account granularity + scheduling-specific fields (workingHours, duration, etc).
 */

export type CalendarProvider = 'google';
export type CalendarIntegrationStatus = 'disconnected' | 'connected' | 'error';

interface CalendarAuth {
  accessToken?: string; // encrypted
  refreshToken?: string; // encrypted
  tokenExpiresAt?: Date;
}

// Weekday → working-hour window. Days missing = not working that day.
export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export interface WorkingHourWindow {
  start: string; // "HH:mm"
  end: string; // "HH:mm"
}
export type WorkingHours = Partial<Record<Weekday, WorkingHourWindow>>;

export interface ICalendarIntegration extends Document {
  id: string;
  userId: string;
  accountId: string; // Instagram canonical IG_ID
  provider: CalendarProvider;
  status: CalendarIntegrationStatus;

  googleEmail?: string;
  scopes: string[];
  calendarId: string; // default 'primary'
  timezone: string; // IANA, e.g. 'America/Santiago'
  workingHours: WorkingHours;
  bufferMinutes: number; // padding between meetings
  meetingDurationMinutes: number; // default slot length
  ccEmails: string[]; // internal invite recipients copied on every scheduled meeting
  enabled: boolean;

  auth: CalendarAuth;
  lastSyncedAt?: Date;
  error?: string;

  createdAt: Date;
  updatedAt: Date;

  setTokens: (tokens: { accessToken?: string; refreshToken?: string; tokenExpiresAt?: Date }) => void;
  clearTokens: () => void;
  toSafeObject: () => Record<string, any>;
}

const WorkingHourWindowSchema = new Schema<WorkingHourWindow>(
  {
    start: { type: String, required: true }, // "HH:mm"
    end: { type: String, required: true },
  },
  { _id: false }
);

// Default working hours — Mon–Fri 9:00–18:00 in the configured timezone.
// Saturday / Sunday absent ⇒ not available.
const DEFAULT_WORKING_HOURS: WorkingHours = {
  mon: { start: '09:00', end: '18:00' },
  tue: { start: '09:00', end: '18:00' },
  wed: { start: '09:00', end: '18:00' },
  thu: { start: '09:00', end: '18:00' },
  fri: { start: '09:00', end: '18:00' },
};

const CalendarIntegrationSchema = new Schema<ICalendarIntegration>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true } as any,
    accountId: { type: String, required: true, index: true },
    provider: { type: String, enum: ['google'], default: 'google' },
    status: {
      type: String,
      enum: ['disconnected', 'connected', 'error'],
      default: 'disconnected',
    },

    googleEmail: { type: String, trim: true },
    scopes: { type: [String], default: [] },
    calendarId: { type: String, default: 'primary' },
    timezone: { type: String, default: 'America/Santiago' },
    workingHours: {
      mon: { type: WorkingHourWindowSchema },
      tue: { type: WorkingHourWindowSchema },
      wed: { type: WorkingHourWindowSchema },
      thu: { type: WorkingHourWindowSchema },
      fri: { type: WorkingHourWindowSchema },
      sat: { type: WorkingHourWindowSchema },
      sun: { type: WorkingHourWindowSchema },
    },
    bufferMinutes: { type: Number, default: 15 },
    meetingDurationMinutes: { type: Number, default: 30 },
    ccEmails: {
      type: [String],
      default: [],
      set: (emails: string[]) =>
        Array.from(
          new Set(
            (emails || [])
              .map((email) => String(email).trim().toLowerCase())
              .filter(Boolean)
          )
        ),
    },
    enabled: { type: Boolean, default: true },

    auth: {
      accessToken: { type: String },
      refreshToken: { type: String },
      tokenExpiresAt: { type: Date },
    },

    lastSyncedAt: { type: Date },
    error: { type: String },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// One Google Calendar connection per (user, Instagram account) pair.
// If the owner wants to reconnect with a different Google account, they disconnect first.
CalendarIntegrationSchema.index({ userId: 1, accountId: 1 }, { unique: true });

// Backfill defaults for docs created before workingHours was populated.
CalendarIntegrationSchema.pre('save', function (next) {
  if (!this.workingHours || Object.keys(this.workingHours).length === 0) {
    this.workingHours = DEFAULT_WORKING_HOURS as WorkingHours;
  }
  next();
});

CalendarIntegrationSchema.methods.setTokens = function (tokens: {
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
}) {
  if (tokens.accessToken) {
    this.auth.accessToken = encrypt(tokens.accessToken);
  }
  if (tokens.refreshToken) {
    this.auth.refreshToken = encrypt(tokens.refreshToken);
  }
  if (tokens.tokenExpiresAt) {
    this.auth.tokenExpiresAt = tokens.tokenExpiresAt;
  }
};

CalendarIntegrationSchema.methods.clearTokens = function () {
  this.auth.accessToken = undefined;
  this.auth.refreshToken = undefined;
  this.auth.tokenExpiresAt = undefined;
};

CalendarIntegrationSchema.methods.toSafeObject = function () {
  return {
    id: this.id,
    userId: this.userId,
    accountId: this.accountId,
    provider: this.provider,
    status: this.status,
    googleEmail: this.googleEmail,
    scopes: this.scopes,
    calendarId: this.calendarId,
    timezone: this.timezone,
    workingHours: this.workingHours,
    bufferMinutes: this.bufferMinutes,
    meetingDurationMinutes: this.meetingDurationMinutes,
    ccEmails: this.ccEmails || [],
    enabled: this.enabled,
    lastSyncedAt: this.lastSyncedAt,
    tokenExpiresAt: this.auth?.tokenExpiresAt,
    error: this.error,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export const revealCalendarTokens = (
  integration: ICalendarIntegration
): { accessToken?: string; refreshToken?: string; tokenExpiresAt?: Date } => ({
  accessToken: decrypt(integration.auth?.accessToken),
  refreshToken: decrypt(integration.auth?.refreshToken),
  tokenExpiresAt: integration.auth?.tokenExpiresAt,
});

export const GOOGLE_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
];

export default mongoose.model<ICalendarIntegration>('CalendarIntegration', CalendarIntegrationSchema);
