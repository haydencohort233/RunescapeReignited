// Image preloading/caching. The browser already caches static files after
// first load (standard HTTP caching) — what this actually solves is the
// STAGGERED pop-in you get when 100 <img> tags each independently trigger
// their own fetch as they scroll into view. Calling preloadImages() with
// every path a list is about to show fires all those requests off in
// parallel up front, so by the time GameImage renders each one, most are
// already resolved (or resolve close together) instead of trickling in.

const loadedUrls = new Set<string>();
const failedUrls = new Set<string>();
const inFlight = new Map<string, Promise<boolean>>();

/** Resolves true if the image loaded, false if it 404'd/errored — never
 *  rejects, so Promise.all over a big list never short-circuits on one
 *  missing asset. */
export function preloadImage(url: string): Promise<boolean> {
  if (loadedUrls.has(url)) return Promise.resolve(true);
  if (failedUrls.has(url)) return Promise.resolve(false);
  const existing = inFlight.get(url);
  if (existing) return existing;

  const promise = new Promise<boolean>((resolve) => {
    const img = new Image();
    img.onload = () => {
      loadedUrls.add(url);
      inFlight.delete(url);
      resolve(true);
    };
    img.onerror = () => {
      failedUrls.add(url);
      inFlight.delete(url);
      resolve(false);
    };
    img.src = url;
  });
  inFlight.set(url, promise);
  return promise;
}

export function preloadImages(urls: string[]): Promise<boolean[]> {
  return Promise.all(urls.map(preloadImage));
}

export function isImageLoaded(url: string): boolean {
  return loadedUrls.has(url);
}

export function didImageFail(url: string): boolean {
  return failedUrls.has(url);
}