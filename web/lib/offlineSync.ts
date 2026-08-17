'use client';

import { queueGetAll, queueRemove } from './offlineQueue';
import { techApiFetch } from './techApi';

let syncing = false;

/**
 * Attempts to upload every queued offline item. Safe to call repeatedly —
 * it no-ops if already running or if the browser reports no connection.
 * Items that fail (still offline, or a real server error) simply stay in
 * the queue and are retried on the next call.
 */
export async function syncOfflineQueue(): Promise<{ uploaded: number; remaining: number }> {
  if (syncing || typeof navigator === 'undefined' || !navigator.onLine) {
    const remaining = typeof navigator !== 'undefined' ? (await queueGetAll()).length : 0;
    return { uploaded: 0, remaining };
  }
  syncing = true;
  let uploaded = 0;
  try {
    const items = await queueGetAll();
    for (const item of items) {
      try {
        const formData = new FormData();
        if (item.type === 'report') {
          formData.append('textReport', item.text);
          if (item.audioBlob) formData.append('audio', item.audioBlob, 'report.webm');
          item.images.forEach((img, i) => formData.append('images', img, img.name || `photo_${i}.jpg`));
          await techApiFetch(`/reports/jobs/${item.jobId}`, { method: 'POST', body: formData });
        } else {
          formData.append('message', item.text);
          if (item.audioBlob) formData.append('audio', item.audioBlob, 'complaint.webm');
          item.images.forEach((img, i) => formData.append('images', img, img.name || `complaint_${i}.jpg`));
          await techApiFetch(`/complaints/technician/${item.jobId}`, { method: 'POST', body: formData });
        }
        if (item.id) await queueRemove(item.id);
        uploaded += 1;
      } catch (e) {
        // Still offline, or the server rejected it — leave it queued and
        // try again on the next sync pass rather than losing the data.
        console.warn('Offline sync: item still pending', item.id, e);
      }
    }
  } finally {
    syncing = false;
  }
  const remaining = (await queueGetAll()).length;
  return { uploaded, remaining };
}
