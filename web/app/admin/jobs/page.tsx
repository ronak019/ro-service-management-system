'use client';

import { useEffect, useState } from 'react';
import AdminShell from '../_components/AdminShell';
import StatusBadge from '../_components/StatusBadge';
import { apiFetch } from '../../../lib/api';
import { jobStatusStyle } from '../../../lib/statusColors';

export default function JobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({ customerId: '', technicianId: '', scheduledAt: '', notes: '' });

  function load() {
    Promise.all([apiFetch('/admin/jobs'), apiFetch('/admin/customers'), apiFetch('/admin/technicians')])
      .then(([j, c, t]) => {
        setJobs(j.jobs);
        setCustomers(c.customers);
        setTechnicians(t.technicians);
      })
      .catch((e) => setError(e.message));
  }
  useEffect(load, []);

  async function createJob(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await apiFetch('/admin/jobs', {
        method: 'POST',
        body: JSON.stringify({
          customerId: Number(form.customerId),
          technicianId: Number(form.technicianId),
          scheduledAt: new Date(form.scheduledAt).toISOString(),
          notes: form.notes,
        }),
      });
      setForm({ customerId: '', technicianId: '', scheduledAt: '', notes: '' });
      setShowForm(false);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function generateLink(jobId: number) {
    try {
      const data = await apiFetch(`/admin/jobs/${jobId}/report-link`, { method: 'POST', body: JSON.stringify({}) });
      await navigator.clipboard.writeText(data.link).catch(() => {});
      setNotice(`Link copied: ${data.link}`);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function revokeLink(jobId: number) {
    try {
      await apiFetch(`/admin/jobs/${jobId}/report-link/revoke`, { method: 'POST' });
      setNotice(`Link revoked for job #${jobId}`);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function reassign(jobId: number, technicianId: string) {
    if (!technicianId) return;
    try {
      await apiFetch(`/admin/jobs/${jobId}/assign`, {
        method: 'PUT',
        body: JSON.stringify({ technicianId: Number(technicianId) }),
      });
      setNotice(`Job #${jobId} reassigned — technician ko notification bhi bhej diya`);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Jobs</h1>
          <p className="text-sm text-slate-500">{jobs.length} total</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          {showForm ? 'Cancel' : '+ New Job'}
        </button>
      </div>

      {error && <p className="text-red-600 mb-3 text-sm">{error}</p>}
      {notice && <p className="text-green-700 mb-3 text-sm break-all">{notice}</p>}

      {showForm && (
        <form onSubmit={createJob} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6 grid gap-3 sm:grid-cols-2">
          <select
            className="border border-slate-300 rounded-lg p-2.5 text-sm"
            required
            value={form.customerId}
            onChange={(e) => setForm({ ...form, customerId: e.target.value })}
          >
            <option value="">Select customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>
            ))}
          </select>
          <select
            className="border border-slate-300 rounded-lg p-2.5 text-sm"
            required
            value={form.technicianId}
            onChange={(e) => setForm({ ...form, technicianId: e.target.value })}
          >
            <option value="">Select technician</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>{t.name} — {t.phone}</option>
            ))}
          </select>
          <input
            type="datetime-local"
            className="border border-slate-300 rounded-lg p-2.5 text-sm"
            required
            value={form.scheduledAt}
            onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
          />
          <input
            className="border border-slate-300 rounded-lg p-2.5 text-sm"
            placeholder="Notes (optional)"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          <button className="sm:col-span-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg p-2.5">
            Create Job
          </button>
        </form>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100">
        {jobs.map((j) => (
          <div key={j.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-slate-900 text-sm">#{j.id} {j.customer_name}</span>
                <span className="text-slate-400 text-sm">→ {j.technician_name}</span>
                <StatusBadge style={jobStatusStyle(j.status)} />
              </div>
              <div className="text-xs text-slate-500">
                {new Date(j.scheduled_at).toLocaleString('en-IN')}
              </div>
            </div>
            <div className="flex gap-2 text-sm items-center flex-wrap">
              <select
                className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs"
                defaultValue=""
                onChange={(e) => reassign(j.id, e.target.value)}
              >
                <option value="" disabled>Reassign to...</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <button onClick={() => generateLink(j.id)} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-medium">
                Generate link
              </button>
              <button onClick={() => revokeLink(j.id)} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium">
                Revoke link
              </button>
            </div>
          </div>
        ))}
        {jobs.length === 0 && <p className="p-6 text-slate-500 text-sm text-center">Koi job nahi hai abhi — "+ New Job" se banayein</p>}
      </div>
    </AdminShell>
  );
}
