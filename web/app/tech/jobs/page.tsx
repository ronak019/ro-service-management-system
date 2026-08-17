'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import TechShell from '../_components/TechShell';
import { techApiFetch, isTechLoggedIn } from '../../../lib/techApi';

const STATUS_COLORS: Record<string, string> = {
  pending: 'border-amber-500 text-amber-700',
  in_progress: 'border-blue-500 text-blue-700',
  completed: 'border-green-500 text-green-700',
  cancelled: 'border-gray-400 text-gray-500',
};

export default function TechJobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [showQuickForm, setShowQuickForm] = useState(false);
  const [quickForm, setQuickForm] = useState({ customerName: '', customerPhone: '', address: '' });
  const [quickSubmitting, setQuickSubmitting] = useState(false);
  const [quickError, setQuickError] = useState('');

  function load() {
    if (!isTechLoggedIn()) return;
    techApiFetch('/jobs')
      .then((d) => setJobs(d.jobs))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function submitQuickJob(e: React.FormEvent) {
    e.preventDefault();
    setQuickError('');
    setQuickSubmitting(true);
    try {
      const data = await techApiFetch('/jobs/quick', {
        method: 'POST',
        body: JSON.stringify(quickForm),
      });
      // Straight to the report screen for this job — that's the whole point.
      router.push(`/tech/jobs/${data.job.id}`);
    } catch (e: any) {
      setQuickError(e.message);
    } finally {
      setQuickSubmitting(false);
    }
  }

  return (
    <TechShell>
      {error && <p className="text-red-600 mb-3">{error}</p>}

      {!showQuickForm ? (
        <button
          onClick={() => setShowQuickForm(true)}
          className="w-full mb-4 bg-blue-700 text-white rounded-lg p-3 font-medium"
        >
          + Naya Customer / Quick Report (जो सीधे कॉल करें)
        </button>
      ) : (
        <form onSubmit={submitQuickJob} className="bg-white rounded-lg shadow p-4 mb-4 space-y-2">
          <h2 className="font-bold mb-1">Naya Customer Report / नया ग्राहक रिपोर्ट</h2>
          <input
            className="w-full border rounded p-3 text-base"
            placeholder="Customer Name / ग्राहक का नाम"
            required
            value={quickForm.customerName}
            onChange={(e) => setQuickForm({ ...quickForm, customerName: e.target.value })}
          />
          <input
            className="w-full border rounded p-3 text-base"
            placeholder="Phone / फ़ोन नंबर"
            inputMode="numeric"
            required
            value={quickForm.customerPhone}
            onChange={(e) => setQuickForm({ ...quickForm, customerPhone: e.target.value })}
          />
          <input
            className="w-full border rounded p-3 text-base"
            placeholder="Address (optional) / पता"
            value={quickForm.address}
            onChange={(e) => setQuickForm({ ...quickForm, address: e.target.value })}
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={quickSubmitting}
              className="flex-1 bg-green-600 text-white rounded p-3 font-medium disabled:opacity-50"
            >
              {quickSubmitting ? 'Creating...' : 'Continue → Add Report'}
            </button>
            <button
              type="button"
              onClick={() => setShowQuickForm(false)}
              className="px-4 bg-gray-200 rounded"
            >
              Cancel
            </button>
          </div>
          {quickError && <p className="text-red-600 text-sm">{quickError}</p>}
        </form>
      )}

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
