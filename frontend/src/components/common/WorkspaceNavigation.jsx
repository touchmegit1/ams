import { useCallback } from 'react';
import { flushSync } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';

let activeTransition;
export function useWorkspaceNavigate() {
  const navigate = useNavigate();
  return useCallback((to, options) => {
    if (!document.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      navigate(to, options);
      return;
    }
    activeTransition?.skipTransition();
    activeTransition = document.startViewTransition(() => flushSync(() => navigate(to, options)));
    activeTransition.finished.catch(() => {});
  }, [navigate]);
}

export function SmoothLink({ to, replace, state, onClick, target, children, ...props }) {
  const navigate = useWorkspaceNavigate();
  return <Link {...props} to={to} replace={replace} state={state} target={target} onClick={(event) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || (target && target !== '_self') || props.download != null) return;
    event.preventDefault();
    navigate(to, { replace, state });
  }}>{children}</Link>;
}
