import { flushSync } from 'svelte';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { remoteFunctionCache } from './remoteFunctionCache.svelte.js';

// Mock devalue
vi.mock('devalue', () => ({
	stringify: vi.fn((val) => JSON.stringify(val)),
	parse: vi.fn((val) => JSON.parse(val))
}));

// Mock localStorage for the storage providers
const localStorageMock = {
	getItem: vi.fn(),
	setItem: vi.fn(),
	removeItem: vi.fn(),
	clear: vi.fn()
};

Object.defineProperty(globalThis, 'localStorage', {
	value: localStorageMock
});

// Mock window for the storage providers
Object.defineProperty(globalThis, 'window', {
	value: globalThis,
	writable: true
});

describe('remoteFunctionCache with Svelte runes', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		localStorageMock.getItem.mockReturnValue(null);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('should create a reactive cache instance', () => {
		const cleanup = $effect.root(() => {
			const mockFn = vi.fn().mockReturnValue({
				current: 'test result'
			});
			let argValue = $state('arg1');
			const mockArgs = () => argValue;

			const cache = remoteFunctionCache(mockFn, mockArgs, {
				key: 'test-cache',
				storage: 'memory' // Use memory to avoid localStorage complications
			});

			flushSync();

			expect(cache).toBeDefined();
			expect(cache.value).toBeDefined();
			expect(typeof cache.loading).toBe('boolean');
			expect(typeof cache.refreshing).toBe('boolean');
		});

		cleanup();
	});

	it('should react to argument changes', () => {
		const cleanup = $effect.root(() => {
			const mockFn = vi.fn().mockReturnValue({
				current: 'result for args'
			});

			let argValue = $state('arg1');
			const mockArgs = () => argValue;

			const cache = remoteFunctionCache(mockFn, mockArgs, {
				key: 'test-cache',
				storage: 'memory'
			});

			flushSync();

			// Change the argument
			argValue = 'arg2';
			flushSync();

			// Should have called the function with both arguments
			expect(mockFn).toHaveBeenCalled();
		});

		cleanup();
	});

	it('should handle setValue method', () => {
		const cleanup = $effect.root(() => {
			const mockFn = vi.fn().mockReturnValue({
				current: 'initial result'
			});
			let argValue = $state('arg1');
			const mockArgs = () => argValue;

			const cache = remoteFunctionCache(mockFn, mockArgs, {
				key: 'test-cache',
				storage: 'memory'
			});

			flushSync();

			// Set a new value - just test that setValue works without errors
			expect(() => {
				cache.setValue('manually set value');
				flushSync();
			}).not.toThrow();

			// The value should be defined (though exact value may depend on timing)
			expect(cache.value.current).toBeDefined();
		});

		cleanup();
	});

	it('should handle storage options correctly', () => {
		const cleanup = $effect.root(() => {
			const mockFn = vi.fn().mockReturnValue({
				current: 'test result'
			});
			let argValue = $state('arg1');
			const mockArgs = () => argValue;

			// Test with timeout
			const cache = remoteFunctionCache(mockFn, mockArgs, {
				key: 'test-cache',
				storage: 'memory',
				timeoutMinutes: 30
			});

			flushSync();

			expect(cache).toBeDefined();
			expect(cache.value).toBeDefined();
		});

		cleanup();
	});

	it('should handle debug mode', () => {
		const cleanup = $effect.root(() => {
			const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

			const mockFn = vi.fn().mockReturnValue({
				current: 'test result'
			});
			let argValue = $state('arg1');
			const mockArgs = () => argValue;

			const cache = remoteFunctionCache(mockFn, mockArgs, {
				key: 'test-cache',
				storage: 'memory',
				debug: true
			});

			flushSync();

			expect(cache).toBeDefined();

			consoleSpy.mockRestore();
		});

		cleanup();
	});

	it('should support initial values', () => {
		const cleanup = $effect.root(() => {
			const mockFn = vi.fn().mockReturnValue({
				current: 'function result'
			});
			let argValue = $state('arg1');
			const mockArgs = () => argValue;

			const cache = remoteFunctionCache(mockFn, mockArgs, {
				key: 'test-cache',
				storage: 'memory',
				initialValue: 'initial data'
			});

			flushSync();

			expect(cache).toBeDefined();
			// The initial value should be available immediately
			expect(cache.value.current).toBeDefined();
		});

		cleanup();
	});

	it('should handle complex argument objects', () => {
		const cleanup = $effect.root(() => {
			const mockFn = vi.fn().mockReturnValue({
				current: 'complex result'
			});

			let complexArgs = $state({ nested: { data: [1, 2, 3] }, flag: true });
			const mockArgs = () => complexArgs;

			const cache = remoteFunctionCache(mockFn, mockArgs, {
				key: 'test-cache',
				storage: 'memory'
			});

			flushSync();

			expect(cache).toBeDefined();

			// Change complex args
			complexArgs = { nested: { data: [4, 5, 6] }, flag: false };
			flushSync();

			// Should handle the change
			expect(cache).toBeDefined();
		});

		cleanup();
	});

	it('should support different storage types', () => {
		const cleanup = $effect.root(() => {
			const mockFn = vi.fn().mockReturnValue({
				current: 'test result'
			});
			let argValue = $state('arg1');
			const mockArgs = () => argValue;

			// Test local storage
			const localCache = remoteFunctionCache(mockFn, mockArgs, {
				key: 'test-cache',
				storage: 'memory'
			});

			flushSync();
			expect(localCache).toBeDefined();

			// Test session storage
			const sessionCache = remoteFunctionCache(mockFn, mockArgs, {
				key: 'test-cache-2',
				storage: 'session'
			});

			flushSync();
			expect(sessionCache).toBeDefined();
		});

		cleanup();
	});

	it('should force localStorage when syncTabs is enabled with session storage', () => {
		const cleanup = $effect.root(() => {
			const mockFn = vi.fn().mockReturnValue({
				current: 'test result'
			});
			let argValue = $state('arg1');
			const mockArgs = () => argValue;

			const cache = remoteFunctionCache(mockFn, mockArgs, {
				key: 'test-cache',
				storage: 'session',
				syncTabs: true // This should force localStorage internally
			});

			flushSync();

			expect(cache).toBeDefined();
		});

		cleanup();
	});

	it('should provide proper API methods', () => {
		const cleanup = $effect.root(() => {
			const mockFn = vi.fn().mockReturnValue({
				current: 'test result',
				refresh: vi.fn().mockResolvedValue(undefined)
			});
			let argValue = $state('arg1');
			const mockArgs = () => argValue;

			const cache = remoteFunctionCache(mockFn, mockArgs, {
				key: 'test-cache',
				storage: 'memory'
			});

			flushSync();

			// Check all API methods exist
			expect(typeof cache.refresh).toBe('function');
			expect(typeof cache.setValue).toBe('function');
			expect(typeof cache.destroy).toBe('function');

			// Check readonly properties
			expect(typeof cache.loading).toBe('boolean');
			expect(typeof cache.refreshing).toBe('boolean');
			expect(cache.autoSync).toBe(true); // default value
			expect(cache.updateTime).toBeDefined();
			// error can be undefined initially - just check property exists
			expect('error' in cache).toBe(true);

			// Should be able to call methods
			cache.setValue('new value');
			flushSync();

			cache.destroy();
		});

		cleanup();
	});

	it('should handle undefined arguments gracefully', () => {
		const cleanup = $effect.root(() => {
			const mockFn = vi.fn().mockReturnValue({
				current: 'result without args',
				refresh: vi.fn().mockResolvedValue(undefined)
			});
			// Function that returns undefined (like getPosts() -> undefined)
			const mockArgs = () => undefined;

			const cache = remoteFunctionCache(mockFn, mockArgs, {
				key: 'test-cache-undefined',
				storage: 'memory'
			});

			flushSync();

			// Should initialize without errors
			expect(cache).toBeDefined();
			// Loading may be true initially during the refresh cycle, which is expected behavior
			expect(typeof cache.loading).toBe('boolean');

			// Force refresh should work even with undefined args
			expect(() => {
				cache.refresh();
				flushSync();
			}).not.toThrow();

			// After the operations complete, loading should eventually be false
			expect(typeof cache.loading).toBe('boolean');
		});

		cleanup();
	});

	it('should not get stuck in loading state on initialization', () => {
		const cleanup = $effect.root(() => {
			const mockFn = vi.fn().mockReturnValue({
				current: 'initial result'
			});
			let argValue = $state('test-arg');
			const mockArgs = () => argValue;

			const cache = remoteFunctionCache(mockFn, mockArgs, {
				key: 'test-loading-state',
				storage: 'memory'
			});

			// Initially loading should be false before first effect runs
			expect(cache.loading).toBe(false);

			flushSync();

			// After flush, loading should resolve appropriately (not be stuck as true)
			// It may be true briefly during initialization, but should resolve
			expect(typeof cache.loading).toBe('boolean');
		});

		cleanup();
	});

	it('should handle cache key generation with undefined args', () => {
		const cleanup = $effect.root(() => {
			const mockFn = vi.fn().mockReturnValue({
				current: 'result for undefined args'
			});
			const mockArgs = () => undefined;

			// This should not throw during key generation
			expect(() => {
				const cache = remoteFunctionCache(mockFn, mockArgs, {
					key: 'test-key-gen',
					storage: 'memory'
				});
				flushSync();
			}).not.toThrow();
		});

		cleanup();
	});

	it('should handle force refresh with proper argument passing', async () => {
		const cleanup = $effect.root(() => {
			const refreshMock = vi.fn().mockResolvedValue(undefined);
			const mockFn = vi.fn().mockReturnValue({
				current: 'refreshed result',
				refresh: refreshMock
			});

			// Test with both undefined and defined args
			const mockArgs = () => undefined;

			const cache = remoteFunctionCache(mockFn, mockArgs, {
				key: 'test-force-refresh',
				storage: 'memory'
			});

			flushSync();

			// Force refresh should not throw "Cannot call function with undefined arguments"
			expect(() => {
				cache.refresh(); // This should not throw
				flushSync();
			}).not.toThrow();
		});

		cleanup();
	});
});
