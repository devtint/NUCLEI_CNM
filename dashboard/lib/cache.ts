// Simple in-memory cache with TTL (Time To Live)
interface CacheEntry<T> {
    data: T;
    expires: number;
}

class SimpleCache {
    private cache = new Map<string, CacheEntry<any>>();
    private maxSize = 100; // Maximum cache entries

    get<T>(key: string): T | null {
        const entry = this.cache.get(key);

        if (!entry) {
            return null;
        }

        // Check if expired
        if (entry.expires < Date.now()) {
            this.cache.delete(key);
            return null;
        }

        return entry.data as T;
    }

    set<T>(key: string, data: T, ttlMs: number): void {
        // Prevent cache from growing too large
        if (this.cache.size >= this.maxSize) {
            // Remove oldest entry
            const firstKey = this.cache.keys().next().value;
            if (firstKey) {
                this.cache.delete(firstKey);
            }
        }

        this.cache.set(key, {
            data,
            expires: Date.now() + ttlMs
        });
    }

    invalidate(key: string): void {
        this.cache.delete(key);
    }

    invalidatePattern(pattern: string): void {
        // Invalidate all keys matching pattern
        for (const key of this.cache.keys()) {
            if (key.includes(pattern)) {
                this.cache.delete(key);
            }
        }
    }

    clear(): void {
        this.cache.clear();
    }

    size(): number {
        return this.cache.size;
    }
}

// Export singleton instance
export const cache = new SimpleCache();

// Helper function for cached API calls
export function withCache<T>(
    key: string,
    ttlMs: number,
    fetcher: () => T
): T {
    const cached = cache.get<T>(key);
    if (cached !== null) {
        return cached;
    }

    const data = fetcher();
    cache.set(key, data, ttlMs);
    return data;
}
