'use client';

import { useEffect, useState } from 'react';
import AdminShell from '../_components/AdminShell';
import StatusBadge from '../_components/StatusBadge';
import { apiFetch } from '../../../lib/api';
import { COMPLAINT_STATUS_STYLES, complaintStatusStyle } from '../../../lib/statusColors';

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
];

function waLink(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits.length === 10 ? '91' + digits : digits}`;
}

export default function ComplaintsPage() {
  const [complaints, setComplaints] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');

  function load(status = filter) {
    apiFetch(`/admin/complaints${status ? `?status=${status}` : ''}`)
      .then((d) => setComplaints(d.complaints))
      .catch((e) => setError(e.message));
  }
  useEffect(() => load(filter), [filter]); // eslint-disable-line react-hooks/exhaustive-deps

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
      <h1 className="text-xl font-bold text-slate-900 mb-1">Complaints</h1>
      <p className="text-sm text-slate-500 mb-5">{complaints.length} showing</p>
      {error && <p className="text-red-600 mb-3 text-sm">{error}</p>}

      <div className="flex gap-1 mb-5 bg-white border border-slate-200 rounded-lg p-1 w-fit">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === f.value ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {complaints.map((c) => (
          <div key={c.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-slate-900">Job #{c.job_id} — {c.customer_name}</h3>
                  <StatusBadge style={complaintStatusStyle(c.status)} />
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span>{new Date(c.created_at).toLocaleString('en-IN')}</span>
                  {c.customer_phone && (
                    <>
                      <a href={`tel:${c.customer_phone}`} className="text-blue-600 hover:underline">📞 {c.customer_phone}</a>
                      <a href={waLink(c.customer_phone)} target="_blank" rel="noreferrer" className="text-green-600 hover:underline">
                        WhatsApp
                      </a>
                    </>
                  )}
                </div>
              </div>
              <select
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-medium"
                value={c.status}
                onChange={(e) => updateStatus(c.id, e.target.value)}
              >
                {Object.entries(COMPLAINT_STATUS_STYLES).map(([value, style]) => (
                  <option key={value} value={value}>{style.label}</option>
                ))}
              </select>
            </div>

            {/* Body */}
            <div className="px-5 py-4">
              {c.customer_message && <p className="text-sm text-slate-700 mb-3">{c.customer_message}</p>}

              {(c.image_urls?.length > 0 || c.video_url || c.audio_url) && (
                <div className="space-y-3">
                  {c.image_urls?.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {c.image_urls.map((url: string, idx: number) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <a key={idx} href={url} target="_blank" rel="noreferrer">
                          <img src={url} alt="" className="w-20 h-20 object-cover rounded-lg border border-slate-200" />
                        </a>
                      ))}
                    </div>
                  )}
                  {c.video_url && (
                    <video controls className="w-full max-w-sm rounded-lg border border-slate-200">
                      <source src={c.video_url} />
                    </video>
                  )}
                  {c.audio_url && (
                    <audio controls className="w-full max-w-sm">
                      <source src={c.audio_url} />
                    </audio>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {complaints.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center text-slate-500 text-sm">
            Is filter mein koi complaint nahi hai
          </div>
        )}
      </div>
    </AdminShell>
  );
}
