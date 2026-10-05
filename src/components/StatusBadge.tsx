import type { LoanStatus } from '../types';

const LABEL: Record<LoanStatus, string> = { active: 'Al día', overdue: 'En mora', paid: 'Pagado' };

export function StatusBadge({ status }: { status: LoanStatus }) {
  return <span className={`badge badge-${status}`}>{LABEL[status]}</span>;
}
