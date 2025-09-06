import { flushSync } from 'svelte';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CustomPersistedState } from './CustomPersistedState.svelte.js';
import type { StorageProvider } from './storage/StorageProvider.js';

// Mock storage provider
const createMockStorageProvider = (): StorageProvider<string> => ({
	get: vi.fn().mockResolvedValue(null),
	set: vi.fn().mockResolvedValue(undefined),
	remove: vi.fn().mockResolvedValue(undefined),
	isLoading: vi.fn().mockReturnValue(false),
	setupSync: vi.fn().mockReturnValue(() => {})
});

describe('CustomPersistedState with Svelte runes', () => {
	let mockProvider: StorageProvider<string>;

	beforeEach(() => {
		vi.clearAllMocks();
		mockProvider = createMockStorageProvider();
	});

	describe('basic functionality', () => {
		it('should initialize with initial value', () => {
			const cleanup = $effect.root(() => {
				const state = new CustomPersistedState('test-key', 'initial', mockProvider);

				flushSync();

				expect(state.current).toBe('initial');
			});

			cleanup();
		});

		it('should load from storage on initialization', async () => {
			mockProvider.get = vi.fn().mockResolvedValue('stored-value');

			const cleanup = $effect.root(() => {
				new CustomPersistedState('test-key', 'initial', mockProvider);

				flushSync();
			});

			// Wait for async storage load
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(mockProvider.get).toHaveBeenCalledWith('test-key');
			cleanup();
		});

		it('should save to storage when value changes', async () => {
			const cleanup = $effect.root(() => {
				const state = new CustomPersistedState('test-key', 'initial', mockProvider);

				flushSync();

				state.current = 'new-value';
				flushSync();

				expect(mockProvider.set).toHaveBeenCalledWith('test-key', 'new-value');
			});

			cleanup();
		});

		it('should not save when value is undefined', () => {
			const cleanup = $effect.root(() => {
				const state = new CustomPersistedState('test-key', 'initial', mockProvider);

				flushSync();
				vi.clearAllMocks();

				state.current = undefined;
				flushSync();

				expect(mockProvider.set).not.toHaveBeenCalled();
			});

			cleanup();
		});
	});

	describe('equality checking', () => {
		it('should not trigger save for same primitive values', () => {
			const cleanup = $effect.root(() => {
				const state = new CustomPersistedState('test-key', 'initial', mockProvider);

				flushSync();
				vi.clearAllMocks();

				// Set same value
				state.current = 'initial';
				flushSync();

				expect(mockProvider.set).not.toHaveBeenCalled();
			});

			cleanup();
		});

		it('should handle complex object equality', () => {
			const mockObjectProvider: StorageProvider<any> = {
				...createMockStorageProvider(),
				get: vi.fn().mockResolvedValue(null),
				set: vi.fn().mockResolvedValue(undefined)
			};

			const cleanup = $effect.root(() => {
				const state = new CustomPersistedState('test-key', { a: 1 }, mockObjectProvider);

				flushSync();
				vi.clearAllMocks();

				// Set equivalent object
				state.current = { a: 1 };
				flushSync();

				expect(mockObjectProvider.set).not.toHaveBeenCalled();
			});

			cleanup();
		});

		it('should save when object content changes', () => {
			const mockObjectProvider: StorageProvider<any> = {
				...createMockStorageProvider(),
				get: vi.fn().mockResolvedValue(null),
				set: vi.fn().mockResolvedValue(undefined)
			};

			const cleanup = $effect.root(() => {
				const state = new CustomPersistedState('test-key', { a: 1 }, mockObjectProvider);

				flushSync();
				vi.clearAllMocks();

				// Set different object
				state.current = { a: 2 };
				flushSync();

				expect(mockObjectProvider.set).toHaveBeenCalledWith('test-key', { a: 2 });
			});

			cleanup();
		});
	});

	describe('loading state', () => {
		it('should delegate loading state to storage provider', () => {
			mockProvider.isLoading = vi.fn().mockReturnValue(true);

			const cleanup = $effect.root(() => {
				const state = new CustomPersistedState('test-key', 'initial', mockProvider);

				flushSync();

				expect(state.isLoading).toBe(true);
				expect(mockProvider.isLoading).toHaveBeenCalled();
			});

			cleanup();
		});
	});

	describe('key management', () => {
		it('should use composite key with uniquekey option', async () => {
			const cleanup = $effect.root(() => {
				new CustomPersistedState('base-key', 'initial', mockProvider, {
					uniquekey: 'unique'
				});

				flushSync();
			});

			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(mockProvider.get).toHaveBeenCalledWith('base-key:unique');
			cleanup();
		});

		it('should handle newKey operation', async () => {
			const cleanup = $effect.root(() => {
				const state = new CustomPersistedState('old-key', 'initial', mockProvider);

				flushSync();
				vi.clearAllMocks();

				state.newKey('new-key', 'new-initial');
				flushSync();
			});

			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(mockProvider.get).toHaveBeenCalledWith('new-key');
			cleanup();
		});

		it('should retain value when requested in newKey', () => {
			const cleanup = $effect.root(() => {
				const state = new CustomPersistedState('old-key', 'initial', mockProvider);

				flushSync();
				state.current = 'current-value';
				flushSync();

				state.newKey('new-key', 'new-initial', true); // retain = true
				flushSync();

				// Should keep current value during transition
				expect(state.current).toBe('current-value');
			});

			cleanup();
		});
	});

	describe('reset functionality', () => {
		it('should reset to initial value and clear storage', async () => {
			const cleanup = $effect.root(() => {
				const state = new CustomPersistedState('test-key', 'initial', mockProvider);

				flushSync();
				state.current = 'changed';
				flushSync();

				// Test reset functionality
				state.reset().then(() => {
					expect(state.current).toBe('initial');
					expect(mockProvider.remove).toHaveBeenCalledWith('test-key');
				});
			});

			cleanup();
		});
	});

	describe('cross-tab synchronization', () => {
		it('should setup sync when provider supports it', () => {
			const cleanup = $effect.root(() => {
				new CustomPersistedState('test-key', 'initial', mockProvider);

				flushSync();

				expect(mockProvider.setupSync).toHaveBeenCalled();
			});

			cleanup();
		});

		it('should handle sync updates from other tabs', () => {
			let syncCallback: (value: string | null) => void;
			mockProvider.setupSync = vi.fn().mockImplementation((key, callback) => {
				syncCallback = callback;
				return () => {};
			});

			const cleanup = $effect.root(() => {
				const state = new CustomPersistedState('test-key', 'initial', mockProvider);

				flushSync();

				// Simulate sync from another tab
				syncCallback!('synced-value');
				flushSync();

				expect(state.current).toBe('synced-value');
			});

			cleanup();
		});

		it('should ignore null sync values', () => {
			let syncCallback: (value: string | null) => void;
			mockProvider.setupSync = vi.fn().mockImplementation((key, callback) => {
				syncCallback = callback;
				return () => {};
			});

			const cleanup = $effect.root(() => {
				const state = new CustomPersistedState('test-key', 'initial', mockProvider);

				flushSync();

				// Simulate sync with null value
				syncCallback!(null);
				flushSync();

				expect(state.current).toBe('initial'); // Should remain unchanged
			});

			cleanup();
		});
	});

	describe('cleanup', () => {
		it('should cleanup sync when destroyed', () => {
			const cleanupFn = vi.fn();
			mockProvider.setupSync = vi.fn().mockReturnValue(cleanupFn);

			const cleanup = $effect.root(() => {
				const state = new CustomPersistedState('test-key', 'initial', mockProvider);

				flushSync();

				state.destroy();
				flushSync();

				expect(cleanupFn).toHaveBeenCalled();
			});

			cleanup();
		});

		it('should handle multiple destroy calls gracefully', () => {
			const cleanupFn = vi.fn();
			mockProvider.setupSync = vi.fn().mockReturnValue(cleanupFn);

			const cleanup = $effect.root(() => {
				const state = new CustomPersistedState('test-key', 'initial', mockProvider);

				flushSync();

				state.destroy();
				state.destroy(); // Second call should not throw
				flushSync();

				expect(cleanupFn).toHaveBeenCalledTimes(1);
			});

			cleanup();
		});
	});
});
