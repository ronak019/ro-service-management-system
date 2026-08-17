'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import TechShell from '../_components/TechShell';
import { techApiFetch, isTechLoggedIn } from '../../../lib/techApi';

const STATUS_COLORS: Record<string, string> = {
  pending: 'border-amber-500 text-amber-700',
  in_progress: 'border-blue-500 text-blue-700',
  completed: 'border-green-500 text-green-700',
  cancelled: 'border-gray-400 text-gray-500',
};

export default function TechJobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isTechLoggedIn()) return;
    techApiFetch('/jobs')
      .then((d) => setJobs(d.jobs))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <TechShell>
      {error && <p className="text-red-600 mb-3">{error}</p>}
      {loading && <p className="text-gray-500">Loading...</p>}
      {!loading && jobs.length === 0 && (
        <p className="text-gray-500 text-center mt-10">
          No jobs assigned yet / अभी तक कोई काम नहीं
        </p>
      )}
      <div className="space-y-3">
        {jobs.map((j) => (
          <Link
            key={j.id}
            href={`/tech/jobs/${j.id}`}
            className={`block bg-white rounded-lg shadow p-4 border-l-4 ${STATUS_COLORS[j.status] || 'border-gray-300'}`}
          >
            <div className="font-bold text-lg">{j.customer_name}</div>
            <div className="text-gray-600 text-sm">{j.address}, {j.city}</div>
            <div className="text-gray-400 text-sm mt-1">
              {new Date(j.scheduled_at).toLocaleString('en-IN')}
            </div>
            <div className={`mt-2 font-semibold text-sm uppercase ${STATUS_COLORS[j.status]?.split(' ')[1] || ''}`}>
              {j.status.replace('_', ' ')}
            </div>
          </Link>
        ))}
      </div>
    </TechShell>
  );
}
