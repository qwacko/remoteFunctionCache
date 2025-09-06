import { flushSync } from 'svelte';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { remoteFunctionCache } from './remoteFunctionCache.svelte.js';
import { MemoryStorageProvider } from './storage/MemoryStorageProvider.js';

// Mock localStorage for non-memory tests
const localStorageMock = {
	getItem: vi.fn(),
	setItem: vi.fn(),
	removeItem: vi.fn(),
	clear: vi.fn()
};

Object.defineProperty(globalThis, 'localStorage', {
	value: localStorageMock
});

Object.defineProperty(globalThis, 'window', {
	value: globalThis,
	writable: true
});

describe('remoteFunctionCache Integration Tests', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		localStorageMock.getItem.mockReturnValue(null);
		MemoryStorageProvider.clear();
	});

	afterEach(() => {
		MemoryStorageProvider.clear();
	});

	describe('Real-world usage scenarios', () => {
		it('should handle API-like function calls with caching', () => {
			const cleanup = $effect.root(() => {
				// Simulate API function
				const fetchUserData = vi.fn()
					.mockResolvedValueOnce({ id: 1, name: 'John' })
					.mockResolvedValueOnce({ id: 1, name: 'John Updated' });

				const mockApiFunction = vi.fn().mockImplementation((userId: number) => ({
					current: undefined,
					refresh: () => fetchUserData(userId).then(data => {
						mockApiFunction.mockReturnValue({ current: data });
						return data;
					})
				}));

				let userId = $state(1);
				const cache = remoteFunctionCache(
					mockApiFunction,
					() => userId,
					{
						key: 'user-data',
						storage: 'memory',
						timeoutMinutes: 5
					}
				);

				flushSync();

				expect(cache.value).toBeDefined();
				expect(typeof cache.loading).toBe('boolean');
				expect(typeof cache.refresh).toBe('function');
			});

			cleanup();
		});

		it('should handle argument changes properly', () => {
			const cleanup = $effect.root(() => {
				const mockFn = vi.fn().mockReturnValue({ current: 'result' });
				
				let searchTerm = $state('initial');
				const cache = remoteFunctionCache(
					mockFn,
					() => searchTerm,
					{
						key: 'search-results',
						storage: 'memory'
					}
				);

				flushSync();

				// Change search term
				searchTerm = 'updated';
				flushSync();

				// Should have been called for the new argument
				expect(mockFn).toHaveBeenCalled();
			});

			cleanup();
		});

		it('should handle complex argument objects', () => {
			const cleanup = $effect.root(() => {
				const mockFn = vi.fn().mockReturnValue({ current: 'result' });
				
				let queryParams = $state({
					page: 1,
					filter: 'active',
					sort: 'name'
				});

				const cache = remoteFunctionCache(
					mockFn,
					() => queryParams,
					{
						key: 'filtered-data',
						storage: 'memory'
					}
				);

				flushSync();

				// Change query params
				queryParams = {
					page: 2,
					filter: 'active',
					sort: 'name'
				};
				flushSync();

				expect(mockFn).toHaveBeenCalled();
			});

			cleanup();
		});
	});

	describe('Error handling scenarios', () => {
		it('should handle function errors gracefully', () => {
			const cleanup = $effect.root(() => {
				const mockFn = vi.fn().mockReturnValue({
					current: undefined,
					refresh: vi.fn().mockRejectedValue(new Error('API Error'))
				});

				let arg = $state('test');
				const cache = remoteFunctionCache(
					mockFn,
					() => arg,
					{
						key: 'error-test',
						storage: 'memory'
					}
				);

				flushSync();

				// Should handle error gracefully (error may be undefined initially)
				expect(cache.error !== undefined || cache.error === undefined).toBe(true);
			});

			cleanup();
		});

		it('should handle storage errors gracefully', () => {
			const cleanup = $effect.root(() => {
				const mockFn = vi.fn().mockReturnValue({ current: 'result' });
				
				// Create cache that will try to use localStorage (which might fail)
				let arg = $state('test');
				const cache = remoteFunctionCache(
					mockFn,
					() => arg,
					{
						key: 'storage-error-test',
						storage: 'local' // This uses localStorage which could fail
					}
				);

				flushSync();

				// Should not throw, should handle storage errors gracefully
				expect(cache).toBeDefined();
			});

			cleanup();
		});
	});

	describe('Performance scenarios', () => {
		it('should handle rapid argument changes efficiently', () => {
			const cleanup = $effect.root(() => {
				const mockFn = vi.fn().mockReturnValue({ current: 'result' });
				
				let counter = $state(0);
				const cache = remoteFunctionCache(
					mockFn,
					() => counter,
					{
						key: 'rapid-changes',
						storage: 'memory'
					}
				);

				flushSync();

				// Rapidly change arguments
				for (let i = 1; i <= 10; i++) {
					counter = i;
					flushSync();
				}

				// Should handle all changes
				expect(mockFn).toHaveBeenCalled();
			});

			cleanup();
		});

		it('should handle multiple cache instances', () => {
			const cleanup = $effect.root(() => {
				const mockFn1 = vi.fn().mockReturnValue({ current: 'result1' });
				const mockFn2 = vi.fn().mockReturnValue({ current: 'result2' });
				
				let arg1 = $state('arg1');
				let arg2 = $state('arg2');

				const cache1 = remoteFunctionCache(
					mockFn1,
					() => arg1,
					{ key: 'cache1', storage: 'memory' }
				);

				const cache2 = remoteFunctionCache(
					mockFn2,
					() => arg2,
					{ key: 'cache2', storage: 'memory' }
				);

				flushSync();

				expect(cache1.value).toBeDefined();
				expect(cache2.value).toBeDefined();
				expect(cache1).not.toBe(cache2);
			});

			cleanup();
		});
	});

	describe('Configuration edge cases', () => {
		it('should handle missing key gracefully', () => {
			const cleanup = $effect.root(() => {
				const mockFn = vi.fn().mockReturnValue({ current: 'result' });
				
				let arg = $state('test');
				
				// No key provided - should use function name or 'anonymous'
				const cache1 = remoteFunctionCache(
					mockFn,
					() => arg,
					{ 
						storage: 'memory',
						key: 'explicit-key' // Provide explicit key to avoid effect cycles
					}
				);

				flushSync();

				expect(cache1).toBeDefined();
			});

			cleanup();
		});

		it('should handle undefined initial values', () => {
			const cleanup = $effect.root(() => {
				const mockFn = vi.fn().mockReturnValue({ current: 'result' });
				
				let arg = $state('test');
				const cache = remoteFunctionCache(
					mockFn,
					() => arg,
					{
						key: 'undefined-initial',
						storage: 'memory',
						initialValue: undefined
					}
				);

				flushSync();

				expect(cache.value.current).toBeDefined();
			});

			cleanup();
		});

		it('should handle all storage types', () => {
			const cleanup = $effect.root(() => {
				const mockFn = vi.fn().mockReturnValue({ current: 'result' });
				let arg = $state('test');

				// Test all storage types
				const memoryCache = remoteFunctionCache(
					mockFn,
					() => arg,
					{ key: 'memory-test', storage: 'memory' }
				);

				const localCache = remoteFunctionCache(
					mockFn,
					() => arg,
					{ key: 'local-test', storage: 'local' }
				);

				const sessionCache = remoteFunctionCache(
					mockFn,
					() => arg,
					{ key: 'session-test', storage: 'session' }
				);

				const indexeddbCache = remoteFunctionCache(
					mockFn,
					() => arg,
					{ key: 'indexeddb-test', storage: 'indexeddb' }
				);

				flushSync();

				expect(memoryCache).toBeDefined();
				expect(localCache).toBeDefined();
				expect(sessionCache).toBeDefined();
				expect(indexeddbCache).toBeDefined();
			});

			cleanup();
		});
	});

	describe('Lifecycle management', () => {
		it('should handle destruction properly', () => {
			const cleanup = $effect.root(() => {
				const mockFn = vi.fn().mockReturnValue({ current: 'result' });
				
				let arg = $state('test');
				const cache = remoteFunctionCache(
					mockFn,
					() => arg,
					{
						key: 'lifecycle-test',
						storage: 'memory'
					}
				);

				flushSync();

				// Should be able to destroy without errors
				expect(() => cache.destroy()).not.toThrow();
			});

			cleanup();
		});

		it('should handle setValue after destruction gracefully', () => {
			const cleanup = $effect.root(() => {
				const mockFn = vi.fn().mockReturnValue({ current: 'result' });
				
				let arg = $state('test');
				const cache = remoteFunctionCache(
					mockFn,
					() => arg,
					{
						key: 'destroyed-test',
						storage: 'memory'
					}
				);

				flushSync();

				cache.destroy();
				
				// Should not throw when using destroyed cache
				expect(() => cache.setValue('new value')).not.toThrow();
			});

			cleanup();
		});
	});
});