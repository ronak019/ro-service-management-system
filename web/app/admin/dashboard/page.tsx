'use client';

import { useEffect, useState } from 'react';
import AdminShell from '../_components/AdminShell';
import StatusBadge from '../_components/StatusBadge';
import { apiFetch } from '../../../lib/api';
import { jobStatusStyle, complaintStatusStyle, JOB_STATUS_STYLES } from '../../../lib/statusColors';

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

  const statusOrder = ['pending', 'in_progress', 'completed', 'cancelled'];

  return (
    <AdminShell>
      <h1 className="text-xl font-bold text-slate-900 mb-1">Dashboard</h1>
      <p className="text-sm text-slate-500 mb-6">Aaj ka service overview</p>
      {error && <p className="text-red-600 mb-4">{error}</p>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {statusOrder.map((s) => {
          const style = jobStatusStyle(s);
          return (
            <div key={s} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <span className={`w-2 h-2 rounded-full ${style.dot}`} />
              </div>
              <div className="text-2xl font-bold text-slate-900">{counts[s] || 0}</div>
              <div className="text-sm text-slate-500">{style.label}</div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Open Complaints ({complaints.length})</h2>
        </div>
        {complaints.length === 0 ? (
          <p className="px-5 py-6 text-slate-500 text-sm">No open complaints — sab kuch theek hai 🎉</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {complaints.map((c) => (
              <div key={c.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-slate-900 text-sm">
                    {c.customer_name} <span className="text-slate-400 font-normal">· Job #{c.job_id}</span>
                  </div>
                  <div className="text-sm text-slate-500 truncate">{c.customer_message || 'Voice/photo complaint'}</div>
                </div>
                <StatusBadge style={complaintStatusStyle(c.status)} />
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
