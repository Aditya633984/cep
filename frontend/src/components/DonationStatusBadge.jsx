import { STATUS_META } from '../utils/donationStatus';

/**
 * A coloured pill badge for a donation status.
 * Props: status (string)
 */
export default function DonationStatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status, color: '#64748B', bg: '#F1F5F9', icon: '•' };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.3rem',
        padding: '0.2rem 0.65rem',
        borderRadius: '9999px',
        fontSize: '0.72rem',
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: meta.color,
        backgroundColor: meta.bg,
        whiteSpace: 'nowrap',
      }}
    >
      {meta.icon} {meta.label}
    </span>
  );
}
