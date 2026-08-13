'use client';

import { useEffect, useState } from 'react';
import AdminShell from '../_components/AdminShell';
import { apiFetch } from '../../../lib/api';

export default function DashboardPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([apiFetch('/admin/jobs'), apiFetch('/admin/complaints?status=open')])
      .then(([jobsRes, complaintsRes]) => {
        setJobs(jobsRes.jobs);
        setComplaints(complaintsRes.complaints);
      })
      .catch((e) => setError(e.message));
  }, []);

  const counts = jobs.reduce((acc: Record<string, number>, j) => {
    acc[j.status] = (acc[j.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <AdminShell>
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      {error && <p className="text-red-600">{error}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {['pending', 'in_progress', 'completed', 'cancelled'].map((s) => (
          <div key={s} className="bg-white rounded shadow p-4 text-center">
            <div className="text-3xl font-bold">{counts[s] || 0}</div>
            <div className="text-sm text-gray-500 capitalize">{s.replace('_', ' ')}</div>
          </div>
        ))}
      </div>

      <h2 className="text-lg font-semibold mb-2">Open complaints ({complaints.length})</h2>
      <div className="bg-white rounded shadow divide-y">
        {complaints.length === 0 && <p className="p-4 text-gray-500">No open complaints.</p>}
        {complaints.map((c) => (
          <div key={c.id} className="p-3">
            <div className="font-medium">{c.customer_name} — Job #{c.job_id}</div>
            <div className="text-sm text-gray-600">{c.customer_message}</div>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
