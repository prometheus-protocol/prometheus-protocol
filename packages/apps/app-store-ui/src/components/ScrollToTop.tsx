import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * This component listens for changes in the route's pathname and
 * automatically scrolls the window to the top (0, 0) on every navigation.
 * It should be placed inside your Router component.
 */
export function ScrollToTop() {
  // The `useLocation` hook returns the location object that represents the current URL.
  const { pathname } = useLocation();

  // The `useEffect` hook will run every time the `pathname` changes.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // This component does not render any visible UI.
  return null;
}
