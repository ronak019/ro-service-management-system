'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import TechShell from '../../_components/TechShell';
import { techApiFetch, isTechLoggedIn } from '../../../../lib/techApi';
import { queueAdd } from '../../../../lib/offlineQueue';

export default function TechJobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [job, setJob] = useState<any>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [textReport, setTextReport] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [done, setDone] = useState(false);
  const [offlineSaved, setOfflineSaved] = useState(false);

  // Separate section: technician logs a complaint the customer told them
  // about over the phone, without the customer needing to open their link.
  const [complaintMessage, setComplaintMessage] = useState('');
  const [complaintImages, setComplaintImages] = useState<File[]>([]);
  const [complaintImagePreviews, setComplaintImagePreviews] = useState<string[]>([]);
  const [complaintRecording, setComplaintRecording] = useState(false);
  const [complaintAudioBlob, setComplaintAudioBlob] = useState<Blob | null>(null);
  const [complaintSubmitting, setComplaintSubmitting] = useState(false);
  const [complaintDone, setComplaintDone] = useState(false);
  const [complaintOfflineSaved, setComplaintOfflineSaved] = useState(false);
  const complaintRecorderRef = useRef<MediaRecorder | null>(null);
  const complaintChunksRef = useRef<Blob[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  function load() {
    techApiFetch(`/jobs/${id}`)
      .then((d) => {
        setJob(d.job);
        setReports(d.reports || []);
      })
      .catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (isTechLoggedIn()) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function updateStatus(status: string) {
    setStatusUpdating(true);
    setError('');
    try {
      const data = await techApiFetch(`/jobs/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      setJob((prev: any) => ({ ...prev, status: data.job.status }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setStatusUpdating(false);
    }
  }

  function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    setImages((prev) => [...prev, ...files]);
    setImagePreviews((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
    e.target.value = ''; // allow picking the same file again / repeated captures
  }
  function removeImage(idx: number) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
    setImagePreviews((prev) => prev.filter((_, i) => i !== idx));
  }

  async function toggleRecording() {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        setAudioBlob(new Blob(chunksRef.current, { type: 'audio/webm' }));
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch {
      setError('Microphone permission denied / माइक्रोफ़ोन अनुमति नहीं मिली');
    }
  }

  async function submitReport(e: React.FormEvent) {
    e.preventDefault();
    if (!textReport.trim() && !audioBlob) {
      setError('Add text or record audio for the report / रिपोर्ट के लिए टेक्स्ट या ऑडियो जोड़ें');
      return;
    }
    setSubmitting(true);
    setError('');
    setDone(false);
    setOfflineSaved(false);

    // No signal right now — save locally instead of failing, and let the
    // background sync (see TechShell) upload it automatically once online.
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      try {
        await queueAdd({ type: 'report', jobId: String(id), text: textReport, images, audioBlob });
        setOfflineSaved(true);
        setTextReport('');
        setImages([]);
        setImagePreviews([]);
        setAudioBlob(null);
      } catch (e: any) {
        setError('Could not save offline: ' + e.message);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    try {
      const formData = new FormData();
      formData.append('textReport', textReport);
      if (audioBlob) formData.append('audio', audioBlob, 'report.webm');
      images.forEach((img, i) => formData.append('images', img, img.name || `photo_${i}.jpg`));

      await techApiFetch(`/reports/jobs/${id}`, { method: 'POST', body: formData });
      setDone(true);
      setTextReport('');
      setImages([]);
      setImagePreviews([]);
      setAudioBlob(null);
      load();
    } catch (e: any) {
      // Request itself failed (signal dropped mid-upload, DNS failure, etc.)
      // — fall back to the offline queue rather than losing the report.
      try {
        await queueAdd({ type: 'report', jobId: String(id), text: textReport, images, audioBlob });
        setOfflineSaved(true);
        setTextReport('');
        setImages([]);
        setImagePreviews([]);
        setAudioBlob(null);
      } catch {
        setError(e.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleComplaintImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []).slice(0, 5 - complaintImages.length);
    setComplaintImages((prev) => [...prev, ...files]);
    setComplaintImagePreviews((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
    e.target.value = '';
  }
  function removeComplaintImage(idx: number) {
    setComplaintImages((prev) => prev.filter((_, i) => i !== idx));
    setComplaintImagePreviews((prev) => prev.filter((_, i) => i !== idx));
  }

  async function toggleComplaintRecording() {
    if (complaintRecording) {
      complaintRecorderRef.current?.stop();
      setComplaintRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      complaintChunksRef.current = [];
      recorder.ondataavailable = (e) => complaintChunksRef.current.push(e.data);
      recorder.onstop = () => {
        setComplaintAudioBlob(new Blob(complaintChunksRef.current, { type: 'audio/webm' }));
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      complaintRecorderRef.current = recorder;
      setComplaintRecording(true);
    } catch {
      setError('Microphone permission denied / माइक्रोफ़ोन अनुमति नहीं मिली');
    }
  }

  async function submitComplaint(e: React.FormEvent) {
    e.preventDefault();
    if (!complaintMessage.trim() && !complaintAudioBlob && complaintImages.length === 0) {
      setError('Complaint ke liye message, photo ya audio dein');
      return;
    }
    setComplaintSubmitting(true);
    setError('');
    setComplaintDone(false);
    setComplaintOfflineSaved(false);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      try {
        await queueAdd({
          type: 'complaint',
          jobId: String(id),
          text: complaintMessage,
          images: complaintImages,
          audioBlob: complaintAudioBlob,
        });
        setComplaintOfflineSaved(true);
        setComplaintMessage('');
        setComplaintImages([]);
        setComplaintImagePreviews([]);
        setComplaintAudioBlob(null);
      } catch (e: any) {
        setError('Could not save offline: ' + e.message);
      } finally {
        setComplaintSubmitting(false);
      }
      return;
    }

    try {
      const formData = new FormData();
      formData.append('message', complaintMessage);
      if (complaintAudioBlob) formData.append('audio', complaintAudioBlob, 'complaint.webm');
      complaintImages.forEach((img, i) => formData.append('images', img, img.name || `complaint_${i}.jpg`));

      await techApiFetch(`/complaints/technician/${id}`, { method: 'POST', body: formData });
      setComplaintDone(true);
      setComplaintMessage('');
      setComplaintImages([]);
      setComplaintImagePreviews([]);
      setComplaintAudioBlob(null);
    } catch (e: any) {
      try {
        await queueAdd({
          type: 'complaint',
          jobId: String(id),
          text: complaintMessage,
          images: complaintImages,
          audioBlob: complaintAudioBlob,
        });
        setComplaintOfflineSaved(true);
        setComplaintMessage('');
        setComplaintImages([]);
        setComplaintImagePreviews([]);
        setComplaintAudioBlob(null);
      } catch {
        setError(e.message);
      }
    } finally {
      setComplaintSubmitting(false);
    }
  }

  return (
    <TechShell>
      <button onClick={() => router.push('/tech/jobs')} className="text-blue-700 text-sm mb-3">
        ← Back to jobs
      </button>

      {error && <p className="text-red-600 mb-3">{error}</p>}
      {!job && !error && <p className="text-gray-500">Loading...</p>}

      {job && (
        <>
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <div className="font-bold text-lg">{job.customer_name}</div>
            <div className="text-gray-600 text-sm">{job.address}, {job.city}</div>
            <div className="text-gray-400 text-sm mt-1">
              {new Date(job.scheduled_at).toLocaleString('en-IN')}
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => updateStatus('in_progress')}
                disabled={statusUpdating}
                className={`flex-1 py-3 rounded font-medium border ${
                  job.status === 'in_progress' ? 'bg-blue-600 text-white' : 'border-blue-600 text-blue-600'
                }`}
              >
                Start Work / शुरू करें
              </button>
              <button
                onClick={() => updateStatus('completed')}
                disabled={statusUpdating}
                className={`flex-1 py-3 rounded font-medium border ${
                  job.status === 'completed' ? 'bg-green-600 text-white' : 'border-green-600 text-green-600'
                }`}
              >
                Mark Complete / पूर्ण करें
              </button>
            </div>
          </div>

          <form onSubmit={submitReport} className="bg-white rounded-lg shadow p-4 space-y-4">
            <h2 className="font-bold text-lg">Submit Report / रिपोर्ट जमा करें</h2>

            <div>
              <label className="block text-sm font-medium mb-1">Type Report / रिपोर्ट लिखें</label>
              <textarea
                className="w-full border rounded p-3 text-base"
                rows={4}
                value={textReport}
                onChange={(e) => setTextReport(e.target.value)}
                placeholder="यहाँ रिपोर्ट लिखें / Write report here"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Audio Report / ऑडियो रिपोर्ट</label>
              <button
                type="button"
                onClick={toggleRecording}
                className={`w-full py-4 rounded-full text-white text-lg font-bold ${
                  recording ? 'bg-red-600' : 'bg-blue-600'
                }`}
              >
                {recording ? '⏹ Stop' : '🎤 Record'}
              </button>
              {audioBlob && !recording && (
                <p className="text-green-700 text-sm mt-1">✓ Audio ready / ऑडियो तैयार है</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Photos / फोटो</label>
              <div className="flex gap-2">
                <label className="flex-1 text-center bg-gray-100 rounded p-3 font-medium cursor-pointer">
                  📷 Camera
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    className="hidden"
                    onChange={handleImagePick}
                  />
                </label>
                <label className="flex-1 text-center bg-gray-100 rounded p-3 font-medium cursor-pointer">
                  🖼 Gallery
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleImagePick} />
                </label>
              </div>
              {imagePreviews.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {imagePreviews.map((src, idx) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <div key={idx} className="relative">
                      <img src={src} alt="" className="w-20 h-20 object-cover rounded border" />
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-green-600 text-white rounded p-4 text-base font-bold disabled:opacity-50"
            >
              {submitting ? 'Submitting... / जमा हो रहा है...' : 'Submit Report / रिपोर्ट जमा करें'}
            </button>

            {done && <p className="text-green-600 text-center">Report submitted! / रिपोर्ट जमा हो गई!</p>}
            {offlineSaved && (
              <p className="text-amber-700 text-center text-sm">
                📴 Internet nahi hai — phone mein save ho gaya, internet aane par apne aap upload ho jaayega
              </p>
            )}
          </form>

          <form onSubmit={submitComplaint} className="bg-white rounded-lg shadow p-4 space-y-4 mt-4 border-l-4 border-amber-500">
            <h2 className="font-bold text-lg">
              Complaint Darj Karein / शिकायत दर्ज करें
              <span className="block text-sm font-normal text-gray-500">
                (agar customer ne phone par bataya ho / if customer told you over the phone)
              </span>
            </h2>

            <textarea
              className="w-full border rounded p-3 text-base"
              rows={3}
              value={complaintMessage}
              onChange={(e) => setComplaintMessage(e.target.value)}
              placeholder="Customer ne kya complaint ki / What did the customer say?"
            />

            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={toggleComplaintRecording}
                className={`px-4 py-3 rounded font-medium text-white ${
                  complaintRecording ? 'bg-red-600' : 'bg-gray-700'
                }`}
              >
                {complaintRecording ? '⏹ Stop' : '🎤 Record Audio'}
              </button>
              {complaintAudioBlob && !complaintRecording && (
                <span className="self-center text-sm text-green-700">Audio ready</span>
              )}

              <label className="px-4 py-3 rounded font-medium bg-gray-100 cursor-pointer">
                📷 Add Photo
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  className="hidden"
                  disabled={complaintImages.length >= 5}
                  onChange={handleComplaintImagePick}
                />
              </label>
            </div>

            {complaintImagePreviews.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {complaintImagePreviews.map((src, idx) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <div key={idx} className="relative">
                    <img src={src} alt="" className="w-20 h-20 object-cover rounded border" />
                    <button
                      type="button"
                      onClick={() => removeComplaintImage(idx)}
                      className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              type="submit"
              disabled={complaintSubmitting}
              className="w-full bg-amber-600 text-white rounded p-4 text-base font-bold disabled:opacity-50"
            >
              {complaintSubmitting ? 'Submitting...' : 'Submit Complaint / शिकायत जमा करें'}
            </button>

            {complaintDone && (
              <p className="text-green-600 text-center">Complaint logged! / शिकायत दर्ज हो गई!</p>
            )}
            {complaintOfflineSaved && (
              <p className="text-amber-700 text-center text-sm">
                📴 Internet nahi hai — phone mein save ho gaya, internet aane par apne aap upload ho jaayega
              </p>
            )}
          </form>

          {reports.length > 0 && (
            <div className="mt-4">
              <h3 className="font-semibold mb-2">Previous reports</h3>
              {reports.map((r: any) => (
                <div key={r.id} className="bg-white rounded shadow p-3 mb-2 text-sm">
                  {r.text_report && <p className="mb-1">{r.text_report}</p>}
                  <p className="text-gray-400">{new Date(r.created_at).toLocaleString('en-IN')}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </TechShell>
  );
}
