'use client';

import { useState, useRef } from 'react';

export default function ComplaintForm({ token }: { token: string }) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string>('');

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

  function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []).slice(0, 5 - images.length);
    setImages((prev) => [...prev, ...files]);
    setImagePreviews((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
    e.target.value = '';
  }
  function removeImage(idx: number) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
    setImagePreviews((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleVideoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setVideo(file);
      setVideoPreview(URL.createObjectURL(file));
    }
    e.target.value = '';
  }
  function removeVideo() {
    setVideo(null);
    setVideoPreview('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() && !audioBlob && images.length === 0 && !video) {
      setError('Please write a message, add a photo/video, or record audio.');
      return;
    }
    setLoading(true);
    setError('');
    setDone(false);

    const formData = new FormData();
    formData.append('message', message);
    if (audioBlob) formData.append('audio', audioBlob, 'complaint.webm');
    images.forEach((img, i) => formData.append('images', img, img.name || `photo_${i}.jpg`));
    if (video) formData.append('video', video, video.name || 'complaint_video.mp4');

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
      setImages([]);
      setImagePreviews([]);
      setVideo(null);
      setVideoPreview('');
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

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={toggleRecording}
          className={`px-4 py-2 rounded text-white ${recording ? 'bg-red-600' : 'bg-gray-700'}`}
        >
          {recording ? '⏹ Stop Recording' : '🎤 Record Audio'}
        </button>
        {audioBlob && !recording && <span className="text-sm text-green-700">Audio ready</span>}

        <label className="px-4 py-2 rounded bg-gray-700 text-white cursor-pointer">
          📷 Add Photo
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            disabled={images.length >= 5}
            onChange={handleImagePick}
          />
        </label>

        <label className="px-4 py-2 rounded bg-gray-700 text-white cursor-pointer">
          🎥 Add Video
          <input
            type="file"
            accept="video/*"
            capture="environment"
            className="hidden"
            disabled={!!video}
            onChange={handleVideoPick}
          />
        </label>
      </div>

      {imagePreviews.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {imagePreviews.map((src, idx) => (
            <div key={idx} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
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
          <span className="text-xs text-gray-500 self-center">{images.length}/5 photos</span>
        </div>
      )}

      {videoPreview && (
        <div className="relative w-48">
          <video src={videoPreview} controls className="w-48 rounded border" />
          <button
            type="button"
            onClick={removeVideo}
            className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 text-xs"
          >
            ✕
          </button>
        </div>
      )}

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
