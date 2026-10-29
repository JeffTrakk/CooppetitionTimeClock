// Contract for each way the app can reach a worker. In-app works today
// (it is just a row in the database). SMS, email and push are placeholders:
// they record a "not_connected" delivery so the message history is complete,
// and in production they would drop a row in the outbox for the
// notify-dispatch background job (supabase/functions/notify-dispatch).

import type { ChannelKey, DeliveryStatus, User } from "../../domain/types";

export interface OutgoingMessage {
  subject: string | null;
  body: string;
  companyName: string;
  appName: string;
}

export interface MessagingChannel {
  key: ChannelKey;
  name: string;
  /** The service we expect to use. Swappable — only this file changes. */
  provider: string;
  description: string;
  envVars: string[];
  docsUrl: string;
  ready: boolean;
  /** Which users this channel can reach at all. */
  canReach(user: User): boolean;
  send(user: User, msg: OutgoingMessage): Promise<DeliveryStatus>;
}

export const inAppChannel: MessagingChannel = {
  key: "in_app",
  name: "In-app",
  provider: "Built in",
  description: "Messages appear in the worker's inbox in the app. Live updates come through Supabase Realtime once it's connected.",
  envVars: [],
  docsUrl: "",
  ready: true,
  canReach: () => true,
  async send() {
    return "delivered";
  },
};

export const smsChannel: MessagingChannel = {
  key: "sms",
  name: "SMS text",
  provider: "Twilio (or any SMS API)",
  description: "Texts for schedule changes, weather cancellations and clock-out reminders. Needs a Canadian long code or toll-free number, plus opt-out (STOP) handling.",
  envVars: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER", "TWILIO_WEBHOOK_SECRET"],
  docsUrl: "https://www.twilio.com/docs/messaging",
  ready: false,
  canReach: (u) => Boolean(u.phone),
  async send() {
    return "not_connected";
  },
};

export const emailChannel: MessagingChannel = {
  key: "email",
  name: "Email",
  provider: "Resend / Postmark (any transactional email)",
  description: "Email copies of announcements, schedules and timesheet reminders, sent from the client's own domain.",
  envVars: ["EMAIL_PROVIDER_API_KEY", "EMAIL_FROM_ADDRESS"],
  docsUrl: "https://resend.com/docs",
  ready: false,
  canReach: (u) => Boolean(u.email),
  async send() {
    return "not_connected";
  },
};

export const pushChannel: MessagingChannel = {
  key: "push",
  name: "Push notifications",
  provider: "Web Push (VAPID) — FCM/APNs if a native app is added",
  description: "Phone alerts for new shifts, messages and 'still clocked in?' reminders. Uses the installed web app's service worker.",
  envVars: ["NEXT_PUBLIC_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"],
  docsUrl: "https://developer.mozilla.org/en-US/docs/Web/API/Push_API",
  ready: false,
  canReach: () => true,
  async send() {
    return "not_connected";
  },
};

export const MESSAGING_CHANNELS: MessagingChannel[] = [inAppChannel, smsChannel, emailChannel, pushChannel];

export function getChannel(key: ChannelKey): MessagingChannel {
  return MESSAGING_CHANNELS.find((c) => c.key === key)!;
}
