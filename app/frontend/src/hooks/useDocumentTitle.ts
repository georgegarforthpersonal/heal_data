import { useEffect } from 'react';

const BASE_TITLE = 'Canopy';

/**
 * Set the browser tab / history-entry title for the current page, e.g.
 * "Butterfly · Canopy". Pass undefined while the name is still loading —
 * the title updates when it arrives. Falls back to the bare product name
 * on unmount so a stale page title never outlives its page.
 */
export function useDocumentTitle(title: string | undefined): void {
  useEffect(() => {
    if (title) document.title = `${title} · ${BASE_TITLE}`;
    return () => {
      document.title = BASE_TITLE;
    };
  }, [title]);
}
