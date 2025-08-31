// Export all models
export { Doctor } from './doctor.model';
export { Patient } from './patient.model';
export { Appointment } from './appointment.model';
export { Billing } from './billing.model';
export { CalendarOAuth } from './calendarOAuth.model';
export { EventLog } from './eventLog.model';
export { PromoCode } from './promoCode.model';
export { Session } from './session.model';

// New Instagram DM models
export { default as InstagramAccount } from './instagramAccount.model';
export { default as Contact } from './contact.model';
export { default as Conversation } from './conversation.model';
export { default as Message } from './message.model';
export { default as OutboundQueue } from './outboundQueue.model';

// Export interfaces
export type { IDoctor } from './doctor.model';
export type { IPatient } from './patient.model';
export type { IAppointment } from './appointment.model';
export type { IBilling } from './billing.model';
export type { IEventLog } from './eventLog.model';
