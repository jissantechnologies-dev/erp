import { useEffect, useRef, useState } from 'react';

/**
 * Debounces a value. Used for the register toolbars' search boxes so typing
 * does not fire a request per keystroke.
 */
export function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/** Sets document.title, restoring the previous one on unmount. */
export function useDocumentTitle(title: string): void {
  const previous = useRef(document.title);
  useEffect(() => {
    document.title = `${title} · Indus Foundries ERP`;
    const prev = previous.current;
    return () => { document.title = prev; };
  }, [title]);
}
