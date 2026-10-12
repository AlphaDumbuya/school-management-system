/**
 * Lets the header search hand a page its search text through `?q=`:
 *
 *   const [search, setSearch] = useState(initialQuery());
 *   useQuerySearch(setSearch);
 *
 * `initialQuery()` seeds the first render (so the list is filtered straight
 * away), and `useQuerySearch` follows later changes (searching again while
 * already on the page).
 */
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/** The `q` in the current address, or ''. */
export function initialQuery(): string {
  try {
    return (new URLSearchParams(window.location.search).get('q') || '').slice(0, 100);
  } catch {
    return '';
  }
}

export function useQuerySearch(setSearch: (value: string) => void): void {
  const { search } = useLocation();
  const first = useRef(true);
  useEffect(() => {
    // The first render was already seeded by initialQuery().
    if (first.current) { first.current = false; return; }
    const q = new URLSearchParams(search).get('q');
    if (q != null) setSearch(q.slice(0, 100));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);
}

export default useQuerySearch;
