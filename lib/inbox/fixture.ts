import inboxJson from "@/data/fixtures/inbox.json";

// Simulated, read-only mailbox. Message bodies exist here only because this is
// a stand-in for a real inbox; callers must pass them to `extractBillEvent`
// and keep only its output, never the body itself.
export type InboxMessage = {
  id: string;
  from: string;
  subject: string;
  received: string;
  body: string;
};

export function readDemoInbox(): InboxMessage[] {
  return inboxJson.messages;
}
