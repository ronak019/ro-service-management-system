'use client';

import { useState, useRef } from 'react';

export default function ComplaintForm({ token }: { token: string }) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

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
    } catch (e) {
      setError('Microphone permission denied. आप बिना ऑडियो के भी शिकायत दर्ज कर सकते हैं।');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() && !audioBlob) {
      setError('Please write a message or record audio.');
      return;
    }
    setLoading(true);
    setError('');
    setDone(false);

    const formData = new FormData();
    formData.append('message', message);
    if (audioBlob) formData.append('audio', audioBlob, 'complaint.webm');

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/complaints/${token}`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit complaint');
      setDone(true);
      setMessage('');
      setAudioBlob(null);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        className="w-full border rounded p-2"
        rows={4}
        placeholder="Write your complaint or feedback here (Hindi / English) / यहाँ लिखें"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleRecording}
          className={`px-4 py-2 rounded text-white ${recording ? 'bg-red-600' : 'bg-gray-700'}`}
        >
          {recording ? '⏹ Stop Recording' : '🎤 Record Audio'}
        </button>
        {audioBlob && !recording && <span className="text-sm text-green-700">Audio ready</span>}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
      >
        {loading ? 'Submitting...' : 'Submit Complaint'}
      </button>

      {done && <p className="text-green-600">Complaint submitted successfully. धन्यवाद!</p>}
      {error && <p className="text-red-600">{error}</p>}
    </form>
  );
}
