import { notFound } from 'next/navigation';
import ComplaintForm from './ComplaintForm';

async function fetchReport(token: string) {
  const res = await fetch(`${process.env.API_URL}/reports/public/${token}`, {
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function ReportPage({ params }: { params: { token: string } }) {
  const data = await fetchReport(params.token);
  if (!data || !data.job) notFound();

  const { job, report, images } = data;

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-3xl mx-auto bg-white rounded shadow p-6">
        <h1 className="text-2xl font-bold mb-1">RO Service Report</h1>
        <p className="text-sm text-gray-500 mb-4">आरओ सर्विस रिपोर्ट</p>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6 text-sm">
          <div>
            <dt className="text-gray-500">Customer / ग्राहक</dt>
            <dd className="font-medium">{job.customer_name}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Address / पता</dt>
            <dd className="font-medium">{job.address}, {job.city}</dd>
          </div>
          <div>
            <dt className="text-gray-500">RO Model</dt>
            <dd className="font-medium">{job.ro_model || '-'}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Service Date / सेवा तिथि</dt>
            <dd className="font-medium">
              {new Date(job.scheduled_at).toLocaleDateString('en-IN')}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Status</dt>
            <dd className="font-medium capitalize">{job.status.replace('_', ' ')}</dd>
          </div>
        </dl>

        <h2 className="text-xl font-semibold mb-2">Report / रिपोर्ट</h2>
        {report ? (
          <>
            {report.text_report && (
              <p className="whitespace-pre-wrap mb-3 text-gray-800">{report.text_report}</p>
            )}
            {report.audio_url && (
              <audio controls className="w-full mb-4">
                <source src={report.audio_url} />
                Your browser does not support audio playback.
              </audio>
            )}
            {images && images.length > 0 && (
              <>
                <h3 className="font-semibold mt-4 mb-2">Photos / फोटो</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                  {images.map((img: any) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={img.id}
                      src={img.image_url}
                      alt="RO unit"
                      className="rounded border object-cover aspect-square"
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <p className="text-gray-500 mb-4">No report has been submitted for this job yet.</p>
        )}

        <hr className="my-6" />

        <h2 className="text-xl font-semibold mb-2">
          Submit Complaint / Feedback <span className="text-sm text-gray-500">शिकायत दर्ज करें</span>
        </h2>
        <ComplaintForm token={params.token} />
      </div>
    </div>
  );
}
