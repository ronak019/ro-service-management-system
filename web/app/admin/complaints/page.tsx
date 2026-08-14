'use client';

import { useEffect, useState } from 'react';
import AdminShell from '../_components/AdminShell';
import { apiFetch } from '../../../lib/api';

const STATUSES = ['open', 'in_progress', 'resolved'];

export default function ComplaintsPage() {
  const [complaints, setComplaints] = useState<any[]>([]);
  const [error, setError] = useState('');

  function load() {
    apiFetch('/admin/complaints').then((d) => setComplaints(d.complaints)).catch((e) => setError(e.message));
  }
  useEffect(load, []);

  async function updateStatus(id: number, status: string) {
    try {
      await apiFetch(`/admin/complaints/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <AdminShell>
      <h1 className="text-2xl font-bold mb-4">Complaints</h1>
      {error && <p className="text-red-600 mb-2">{error}</p>}

      <div className="bg-white rounded shadow divide-y">
        {complaints.map((c) => (
          <div key={c.id} className="p-3">
            <div className="flex items-center justify-between">
              <div className="font-medium">
                Job #{c.job_id} — {c.customer_name} ({c.customer_phone})
              </div>
              <select
                className="border rounded p-1 text-sm capitalize"
                value={c.status}
                onChange={(e) => updateStatus(c.id, e.target.value)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
           {c.customer_message && <p className="text-sm text-gray-600 mt-1">{c.customer_message}</p>}
            {c.image_urls && c.image_urls.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {c.image_urls.map((url: string, idx: number) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={idx} src={url} alt="" className="w-20 h-20 object-cover rounded border" />
                ))}
              </div>
            )}
            {c.video_url && (
              <video controls className="mt-2 w-full max-w-sm rounded">
                <source src={c.video_url} />
              </video>
            )}
            {c.audio_url && (
              <audio controls className="mt-2 w-full">
                <source src={c.audio_url} />
              </audio>
            )}
            <div className="text-xs text-gray-400 mt-1">
              {new Date(c.created_at).toLocaleString('en-IN')}
            </div>
          </div>
        ))}
        {complaints.length === 0 && <p className="p-4 text-gray-500">No complaints yet.</p>}
      </div>
    </AdminShell>
  );
}
