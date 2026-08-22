import type { ReactNode } from 'react';
import type { Route } from '../router';

interface Props {
  to: Route;
  navigate: (to: Route) => void;
  className?: string;
  children: ReactNode;
}

export function Link({ to, navigate, className, children }: Props) {
  return (
    <a
      href={to}
      className={className}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}
