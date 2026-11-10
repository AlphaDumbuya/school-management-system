import { useEffect } from 'react';

const SITE = 'https://www.wiskulsl.com';

function setMeta(selector: string, attr: 'name' | 'property', key: string, content: string): () => void {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  const created = !el;
  const previous = el?.getAttribute('content') ?? null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
  return () => {
    if (!el) return;
    if (created) el.remove();
    else if (previous !== null) el.setAttribute('content', previous);
  };
}

/**
 * Sets the page title, description, canonical address and social-share tags for one public page,
 * and puts the previous values back when the page is left. (The app is a single-page site, so
 * without this every page would share the one title from index.html.)
 */
export function usePageMeta(title: string, description: string, path: string): void {
  useEffect(() => {
    const url = `${SITE}${path === '/' ? '' : path}`;
    // A new page opens at the top (unless the link points to a #section).
    if (!window.location.hash) window.scrollTo(0, 0);
    const previousTitle = document.title;
    document.title = title;

    const undo = [
      setMeta('meta[name="description"]', 'name', 'description', description),
      setMeta('meta[property="og:title"]', 'property', 'og:title', title),
      setMeta('meta[property="og:description"]', 'property', 'og:description', description),
      setMeta('meta[property="og:url"]', 'property', 'og:url', url),
      setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title),
      setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description),
    ];

    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const linkCreated = !link;
    const previousHref = link?.getAttribute('href') ?? null;
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', url);

    return () => {
      document.title = previousTitle;
      undo.forEach((fn) => fn());
      if (link) {
        if (linkCreated) link.remove();
        else if (previousHref !== null) link.setAttribute('href', previousHref);
      }
    };
  }, [title, description, path]);
}

export default usePageMeta;
