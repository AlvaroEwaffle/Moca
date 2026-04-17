/**
 * Audit and optionally repair Moca conversation display data.
 *
 * Dry-run:
 *   npx tsx src/scripts/audit-conversation-data.ts
 *
 * Apply fixes:
 *   npx tsx src/scripts/audit-conversation-data.ts --write
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import Conversation from '../models/conversation.model';
import Message from '../models/message.model';

const WRITE = process.argv.includes('--write');
const MIN_VALID_YEAR = 2020;
const MAX_VALID_YEAR = 2030;
const PLACEHOLDER_TEXT = '[Mensaje recibido sin texto visible]';
const TIMESTAMP_FIELDS = [
  'timestamps.createdAt',
  'timestamps.lastUserMessage',
  'timestamps.lastBotMessage',
  'timestamps.lastActivity'
] as const;

type Counters = {
  conversationsScanned: number;
  conversationsFixed: number;
  messageScanned: number;
  messageTimestampsFixed: number;
  messageTextFixed: number;
};

function getByPath(source: any, path: string): any {
  return path.split('.').reduce((value, key) => value?.[key], source);
}

function isValidDisplayDate(date: Date): boolean {
  if (Number.isNaN(date.getTime())) return false;
  const year = date.getFullYear();
  return year >= MIN_VALID_YEAR && year <= MAX_VALID_YEAR;
}

function recoverDate(value: any, fallback?: Date): Date | null {
  if (!value) return null;

  const original = value instanceof Date ? value : new Date(value);
  if (isValidDisplayDate(original)) return original;

  if (!Number.isNaN(original.getTime())) {
    const divided = new Date(original.getTime() / 1000);
    if (isValidDisplayDate(divided)) return divided;
  }

  return fallback && isValidDisplayDate(fallback) ? fallback : null;
}

function setUpdate(update: Record<string, any>, path: string, value: any): void {
  update[path] = value;
}

async function auditConversations(counters: Counters): Promise<void> {
  const cursor = Conversation.find({}).cursor();

  for await (const conversation of cursor) {
    counters.conversationsScanned++;
    const update: Record<string, any> = {};
    const fallback = recoverDate((conversation as any).updatedAt) || recoverDate((conversation as any).createdAt) || new Date();

    for (const field of TIMESTAMP_FIELDS) {
      const original = getByPath(conversation, field);
      if (!original) continue;
      const recovered = recoverDate(original, fallback);
      if (!recovered) continue;

      const originalDate = original instanceof Date ? original : new Date(original);
      if (!isValidDisplayDate(originalDate) || originalDate.getTime() !== recovered.getTime()) {
        setUpdate(update, field, recovered);
      }
    }

    if (Object.keys(update).length === 0) continue;

    counters.conversationsFixed++;
    console.log(`${WRITE ? 'Fixing' : 'Would fix'} conversation ${conversation._id}:`, update);

    if (WRITE) {
      await Conversation.updateOne({ _id: conversation._id }, { $set: update });
    }
  }
}

async function auditMessages(counters: Counters): Promise<void> {
  const cursor = Message.find({}).cursor();

  for await (const message of cursor) {
    counters.messageScanned++;
    const update: Record<string, any> = {};
    const createdAt = recoverDate((message as any).createdAt);
    const originalTimestamp = (message as any).metadata?.timestamp;
    const recoveredTimestamp = originalTimestamp
      ? recoverDate(originalTimestamp, createdAt || undefined)
      : null;

    if (recoveredTimestamp) {
      const originalDate = originalTimestamp instanceof Date ? originalTimestamp : new Date(originalTimestamp);
      if (!isValidDisplayDate(originalDate) || originalDate.getTime() !== recoveredTimestamp.getTime()) {
        setUpdate(update, 'metadata.timestamp', recoveredTimestamp);
        counters.messageTimestampsFixed++;
      }
    }

    const text = typeof (message as any).content?.text === 'string'
      ? (message as any).content.text.trim()
      : '';
    if (!text || text.toLowerCase() === 'message') {
      setUpdate(update, 'content.text', PLACEHOLDER_TEXT);
      counters.messageTextFixed++;
    }

    if (Object.keys(update).length === 0) continue;

    console.log(`${WRITE ? 'Fixing' : 'Would fix'} message ${message._id}:`, update);

    if (WRITE) {
      await Message.updateOne({ _id: message._id }, { $set: update });
    }
  }
}

async function main(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is not set');
  }

  await mongoose.connect(mongoUri);
  console.log(`Connected to MongoDB. Mode: ${WRITE ? 'WRITE' : 'DRY-RUN'}`);

  const counters: Counters = {
    conversationsScanned: 0,
    conversationsFixed: 0,
    messageScanned: 0,
    messageTimestampsFixed: 0,
    messageTextFixed: 0
  };

  await auditConversations(counters);
  await auditMessages(counters);

  console.log('\nAudit summary:', counters);
  await mongoose.disconnect();
}

main().catch(error => {
  console.error('Audit failed:', error);
  process.exit(1);
});
