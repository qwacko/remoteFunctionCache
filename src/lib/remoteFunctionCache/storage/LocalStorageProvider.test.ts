import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LocalStorageProvider } from './LocalStorageProvider.js';

// Mock localStorage
const localStorageMock = {
	getItem: vi.fn(),
	setItem: vi.fn(),
	removeItem: vi.fn(),
	clear: vi.fn()
};

Object.defineProperty(globalThis, 'localStorage', {
	value: localStorageMock
});

describe('LocalStorageProvider', () => {
	let provider: LocalStorageProvider<string>;

	beforeEach(() => {
		vi.clearAllMocks();
		provider = new LocalStorageProvider({});
	});

	describe('set', () => {
		it('should store data with timestamp', async () => {
			const testData = 'test value';
			await provider.set('test-key', testData);

			expect(localStorageMock.setItem).toHaveBeenCalledWith(
				'test-key',
				expect.stringContaining('"value":"test value"')
			);
			expect(localStorageMock.setItem).toHaveBeenCalledWith(
				'test-key',
				expect.stringContaining('"timestamp":')
			);
		});
	});

	describe('get', () => {
		it('should return null when no data exists', async () => {
			localStorageMock.getItem.mockReturnValue(null);
			const result = await provider.get('test-key');
			expect(result).toBeNull();
		});

		it('should return stored data when valid', async () => {
			const storedData = {
				value: 'test value',
				timestamp: Date.now()
			};
			localStorageMock.getItem.mockReturnValue(JSON.stringify(storedData));

			const result = await provider.get('test-key');
			expect(result).toBe('test value');
		});

		it('should return null when data is expired', async () => {
			provider = new LocalStorageProvider({ timeoutMinutes: 1 });
			const storedData = {
				value: 'test value',
				timestamp: Date.now() - 2 * 60 * 1000 // 2 minutes ago
			};
			localStorageMock.getItem.mockReturnValue(JSON.stringify(storedData));

			const result = await provider.get('test-key');
			expect(result).toBeNull();
		});

		it('should return null when stored data is invalid', async () => {
			localStorageMock.getItem.mockReturnValue('invalid json');
			const result = await provider.get('test-key');
			expect(result).toBeNull();
		});
	});

	describe('remove', () => {
		it('should remove item from localStorage', async () => {
			await provider.remove('test-key');
			expect(localStorageMock.removeItem).toHaveBeenCalledWith('test-key');
		});
	});
});
