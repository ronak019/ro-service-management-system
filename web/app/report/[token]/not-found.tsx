export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-xl font-bold mb-2">Link not found</h1>
        <p className="text-gray-600">
          This report link is invalid, expired, or has been revoked. Please contact support for a new link.
        </p>
        <p className="text-gray-600 mt-1">यह लिंक अमान्य, समाप्त या रद्द कर दिया गया है।</p>
      </div>
    </div>
  );
}
