import { STATUS_LABEL } from '../lib/loanView';
import type { LoanStatus } from '../types';

export function StatusBadge({ status }: { status: LoanStatus }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABEL[status]}</span>;
}
