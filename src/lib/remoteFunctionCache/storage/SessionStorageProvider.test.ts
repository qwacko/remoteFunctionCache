import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionStorageProvider } from './SessionStorageProvider.js';

// Mock sessionStorage
const sessionStorageMock = {
	getItem: vi.fn(),
	setItem: vi.fn(),
	removeItem: vi.fn(),
	clear: vi.fn()
};

Object.defineProperty(globalThis, 'sessionStorage', {
	value: sessionStorageMock
});

describe('SessionStorageProvider', () => {
	let provider: SessionStorageProvider<string>;

	beforeEach(() => {
		vi.clearAllMocks();
		provider = new SessionStorageProvider({});
	});

	describe('set', () => {
		it('should store data with timestamp', async () => {
			const testData = 'test value';
			await provider.set('test-key', testData);

			expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
				'test-key',
				expect.stringContaining('"value":"test value"')
			);
			expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
				'test-key',
				expect.stringContaining('"timestamp":')
			);
		});
	});

	describe('get', () => {
		it('should return null when no data exists', async () => {
			sessionStorageMock.getItem.mockReturnValue(null);
			const result = await provider.get('test-key');
			expect(result).toBeNull();
		});

		it('should return stored data when valid', async () => {
			const storedData = {
				value: 'test value',
				timestamp: Date.now()
			};
			sessionStorageMock.getItem.mockReturnValue(JSON.stringify(storedData));

			const result = await provider.get('test-key');
			expect(result).toBe('test value');
		});

		it('should return null when data is expired', async () => {
			provider = new SessionStorageProvider({ timeoutMinutes: 1 });
			const storedData = {
				value: 'test value',
				timestamp: Date.now() - 2 * 60 * 1000 // 2 minutes ago
			};
			sessionStorageMock.getItem.mockReturnValue(JSON.stringify(storedData));

			const result = await provider.get('test-key');
			expect(result).toBeNull();
		});

		it('should return null when stored data is invalid', async () => {
			sessionStorageMock.getItem.mockReturnValue('invalid json');
			const result = await provider.get('test-key');
			expect(result).toBeNull();
		});
	});

	describe('remove', () => {
		it('should remove item from sessionStorage', async () => {
			await provider.remove('test-key');
			expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('test-key');
		});
	});
});
