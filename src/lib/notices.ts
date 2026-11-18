// Daily notices ("cheguei" / "saí") to a client who invited the provider and to whom the provider
// chose to show them. Browser only.
//
// Without a connection the notice waits in the outbox and is sent when the app opens again —
// but only on the same day: the server refuses past days, and the notebook already has the time.

import {addNotice} from './api';
import {queueNotice, readStore, removeFromOutbox, type QueuedNotice} from './device-store';
import {getRpcErrorCode} from '@/i18n/errors';
import {toDateKey, type NotebookClient} from './notebook';

export function sharesNoticesWith(client: NotebookClient) {
  return Boolean(client.link && client.link.status === 'active' && client.link.sharesDailyNotice);
}

export type NoticeResult = 'sent' | 'queued' | 'not_shared' | 'refused';

/** Sends one notice now, or keeps it for later when offline. */
export async function sendNotice(client: NotebookClient, kind: QueuedNotice['kind'], occurredAt = new Date()): Promise<NoticeResult> {
  if (!client.link || !sharesNoticesWith(client)) return 'not_shared';
  try {
    await addNotice(client.link.slug, client.link.inviteToken, kind, occurredAt.toISOString());
    return 'sent';
  } catch (error) {
    if (getRpcErrorCode(error) === 'network') {
      queueNotice({clientId: client.id, kind, occurredAt: occurredAt.toISOString()});
      return 'queued';
    }
    return 'refused';
  }
}

/** Retries waiting notices. Old ones (another day) and refused ones are dropped. */
export async function flushOutbox() {
  const store = readStore();
  if (store.outbox.length === 0) return;
  const today = toDateKey(new Date());
  const done: QueuedNotice[] = [];
  for (const notice of store.outbox) {
    const client = store.clients.find((item) => item.id === notice.clientId);
    if (!client?.link || !sharesNoticesWith(client) || toDateKey(new Date(notice.occurredAt)) !== today) {
      done.push(notice);
      continue;
    }
    try {
      await addNotice(client.link.slug, client.link.inviteToken, notice.kind, notice.occurredAt);
      done.push(notice);
    } catch (error) {
      if (getRpcErrorCode(error) === 'network') break; // still offline: try again later
      done.push(notice);
    }
  }
  if (done.length) removeFromOutbox(done);
}
