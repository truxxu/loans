import { initials } from '../lib/loanView';

export function Avatar({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' | 'xl' }) {
  return (
    <span className={`avatar avatar-${size}`} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
