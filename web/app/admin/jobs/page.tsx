'use client';

import { useEffect, useState } from 'react';
import AdminShell from '../_components/AdminShell';
import { apiFetch } from '../../../lib/api';

export default function JobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

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
      <h1 className="text-2xl font-bold mb-4">Jobs</h1>
      {error && <p className="text-red-600 mb-2">{error}</p>}
      {notice && <p className="text-green-700 mb-2 break-all">{notice}</p>}

      <form onSubmit={createJob} className="bg-white rounded shadow p-4 mb-6 grid gap-2 sm:grid-cols-2">
        <select
          className="border rounded p-2"
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
          className="border rounded p-2"
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
          className="border rounded p-2"
          required
          value={form.scheduledAt}
          onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
        />
        <input
          className="border rounded p-2"
          placeholder="Notes (optional)"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
        <button className="sm:col-span-2 bg-blue-600 text-white rounded p-2">Create Job</button>
      </form>

      <div className="bg-white rounded shadow divide-y">
        {jobs.map((j) => (
          <div key={j.id} className="p-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-medium">
                #{j.id} {j.customer_name} → {j.technician_name}
              </div>
              <div className="text-sm text-gray-500">
                {new Date(j.scheduled_at).toLocaleString('en-IN')} · <span className="capitalize">{j.status.replace('_', ' ')}</span>
              </div>
            </div>
            <div className="flex gap-2 text-sm items-center flex-wrap">
              <select
                className="border rounded p-1 text-sm"
                defaultValue=""
                onChange={(e) => reassign(j.id, e.target.value)}
              >
                <option value="" disabled>
                  Reassign to...
                </option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <button onClick={() => generateLink(j.id)} className="px-3 py-1 bg-gray-800 text-white rounded">
                Generate link
              </button>
              <button onClick={() => revokeLink(j.id)} className="px-3 py-1 bg-red-600 text-white rounded">
                Revoke link
              </button>
            </div>
          </div>
        ))}
        {jobs.length === 0 && <p className="p-4 text-gray-500">No jobs yet.</p>}
      </div>
    </AdminShell>
  );
}
