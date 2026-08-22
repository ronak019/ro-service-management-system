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

      <div className="flex gap-1 mb-5 bg-white border border-slate-200 rounded-lg p-1 w-fit overflow-x-auto max-w-full">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
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
            {/* Header — stacks vertically on narrow/mobile screens */}
            <div className="px-4 sm:px-5 py-4 border-b border-slate-100 flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-slate-900">Job #{c.job_id} — {c.customer_name}</h3>
                <StatusBadge style={complaintStatusStyle(c.status)} />
                {c.source === 'technician' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700">
                    🔧 Technician{c.logged_by_name ? ` — ${c.logged_by_name}` : ''}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700">
                    🧑 Customer
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span>{new Date(c.created_at).toLocaleString('en-IN')}</span>
                {c.customer_phone && (
                  <>
                    <a href={`tel:${c.customer_phone}`} className="text-blue-600 font-medium">📞 {c.customer_phone}</a>
                    <a href={waLink(c.customer_phone)} target="_blank" rel="noreferrer" className="text-green-600 font-medium">
                      WhatsApp
                    </a>
                  </>
                )}
              </div>

              <select
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium w-full sm:w-auto sm:self-start"
                value={c.status}
                onChange={(e) => updateStatus(c.id, e.target.value)}
              >
                {Object.entries(COMPLAINT_STATUS_STYLES).map(([value, style]) => (
                  <option key={value} value={value}>{style.label}</option>
                ))}
              </select>
            </div>

            {/* Body — full, unclipped text + all attachments */}
            <div className="px-4 sm:px-5 py-4">
              {c.customer_message ? (
                <p className="text-sm text-slate-800 whitespace-pre-wrap mb-4 leading-relaxed">{c.customer_message}</p>
              ) : (
                <p className="text-sm text-slate-400 italic mb-4">No text message — see attachments below</p>
              )}

              {c.image_urls?.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-slate-500 mb-1.5">PHOTOS ({c.image_urls.length})</p>
                  <div className="flex flex-wrap gap-2">
                    {c.image_urls.map((url: string, idx: number) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <a key={idx} href={url} target="_blank" rel="noreferrer">
                        <img src={url} alt="" className="w-24 h-24 sm:w-28 sm:h-28 object-cover rounded-lg border border-slate-200" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {c.video_url && (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-slate-500 mb-1.5">VIDEO</p>
                  <video controls className="w-full max-w-sm rounded-lg border border-slate-200">
                    <source src={c.video_url} />
                  </video>
                </div>
              )}

              {c.audio_url && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-1.5">VOICE NOTE</p>
                  <audio controls className="w-full">
                    <source src={c.audio_url} />
                  </audio>
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
