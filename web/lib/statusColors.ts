// Shared status → color mapping so every screen (dashboard, jobs, complaints)
// uses the exact same colors for the exact same status.

export const JOB_STATUS_STYLES: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  pending: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Pending' },
  in_progress: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500', label: 'In Progress' },
  completed: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500', label: 'Completed' },
  cancelled: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400', label: 'Cancelled' },
};

export const COMPLAINT_STATUS_STYLES: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  open: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Open' },
  in_progress: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500', label: 'In Progress' },
  resolved: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500', label: 'Resolved' },
};

export function jobStatusStyle(status: string) {
  return JOB_STATUS_STYLES[status] || JOB_STATUS_STYLES.pending;
}
export function complaintStatusStyle(status: string) {
  return COMPLAINT_STATUS_STYLES[status] || COMPLAINT_STATUS_STYLES.open;
}
