/**
 * Cache Management Utility
 * Prevents stale data from being served to users
 */

// Clear browser HTTP cache for specific API endpoints
export const clearApiCache = async () => {
  try {
    // Clear service worker cache if available
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        for (const request of keys) {
          // Clear provider and search related requests
          if (
            request.url.includes('/providers') ||
            request.url.includes('/search') ||
            request.url.includes('/services')
          ) {
            await cache.delete(request);
          }
        }
      }
    }
  } catch (err) {
    console.warn('Could not clear service worker cache:', err);
  }
};

// Clear localStorage cache for providers and search
export const clearLocalStorageCache = () => {
  try {
    // Don't clear user auth token
    // Only clear transient cache data
    const keysToPreserve = ['customerToken', 'userLocation'];
    const allKeys = Object.keys(localStorage);
    
    for (const key of allKeys) {
      if (!keysToPreserve.includes(key)) {
        // Keep important data, clear search/provider cache
        if (key.includes('provider') || key.includes('search') || key.includes('cache')) {
          localStorage.removeItem(key);
        }
      }
    }
  } catch (err) {
    console.warn('Could not clear localStorage cache:', err);
  }
};

// Force refresh of provider data by clearing cache and reloading
export const forceRefreshProviders = async () => {
  await clearApiCache();
  clearLocalStorageCache();
  window.dispatchEvent(new Event('userLocationChanged'));
};

// Initialize cache management on app startup
export const initializeCacheManagement = () => {
  // Clear API cache on page load to ensure fresh data
  clearApiCache().catch(err => console.warn('Cache initialization failed:', err));
};
