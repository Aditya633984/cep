/**
 * Donation status helpers – label, colour, and icon for each status value.
 */

export const STATUS_META = {
  POSTED:             { label: 'Posted',            color: '#2563EB', bg: '#EFF6FF', icon: '📋' },
  ACCEPTED:           { label: 'Accepted',           color: '#7C3AED', bg: '#F5F3FF', icon: '✅' },
  VOLUNTEER_ASSIGNED: { label: 'Volunteer Assigned', color: '#D97706', bg: '#FFFBEB', icon: '🚴' },
  PICKED_UP:          { label: 'Picked Up',          color: '#0891B2', bg: '#ECFEFF', icon: '📦' },
  DELIVERED:          { label: 'Delivered',          color: '#059669', bg: '#ECFDF5', icon: '🎯' },
  COMPLETED:          { label: 'Completed',          color: '#16A34A', bg: '#F0FDF4', icon: '🎉' },
  CANCELLED:          { label: 'Cancelled',          color: '#DC2626', bg: '#FEF2F2', icon: '❌' },
};

export const MUTABLE_STATUSES = ['POSTED'];

export const isEditable   = (status) => MUTABLE_STATUSES.includes(status);
export const isCancellable = (status) => MUTABLE_STATUSES.includes(status);
