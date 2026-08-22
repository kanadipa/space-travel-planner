import { useCallback, useEffect, useState } from 'react';

/** The two screens. Anything else is the planner. */
export type Route = '/' | '/missions';

function routeOf(pathname: string): Route {
  return pathname === '/missions' ? '/missions' : '/';
}

export function useRoute(): [Route, (to: Route) => void] {
  const [route, setRoute] = useState<Route>(() => routeOf(window.location.pathname));

  useEffect(() => {
    const onPop = () => setRoute(routeOf(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((to: Route) => {
    if (to !== window.location.pathname) window.history.pushState(null, '', to);
    setRoute(to);
    window.scrollTo(0, 0);
  }, []);

  return [route, navigate];
}
