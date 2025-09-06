import { describe, it, expect, vi } from 'vitest';
import { createStorageProvider, type StorageType } from './StorageFactory.js';
import { LocalStorageProvider } from './LocalStorageProvider.js';
import { SessionStorageProvider } from './SessionStorageProvider.js';
import { IndexedDBStorageProvider } from './IndexedDBStorageProvider.js';

// Mock the storage providers
vi.mock('./LocalStorageProvider.js', () => ({
	LocalStorageProvider: vi.fn()
}));

vi.mock('./SessionStorageProvider.js', () => ({
	SessionStorageProvider: vi.fn()
}));

vi.mock('./IndexedDBStorageProvider.js', () => ({
	IndexedDBStorageProvider: vi.fn()
}));

describe('StorageFactory', () => {
	describe('createStorageProvider', () => {
		it('should create LocalStorageProvider for "local" type', () => {
			const options = { timeoutMinutes: 30 };

			createStorageProvider('local', options);

			expect(LocalStorageProvider).toHaveBeenCalledWith(options);
		});

		it('should create SessionStorageProvider for "session" type', () => {
			const options = { timeoutMinutes: 15 };

			createStorageProvider('session', options);

			expect(SessionStorageProvider).toHaveBeenCalledWith(options);
		});

		it('should create IndexedDBStorageProvider for "indexeddb" type', () => {
			const options = { timeoutMinutes: 60 };

			createStorageProvider('indexeddb', options);

			expect(IndexedDBStorageProvider).toHaveBeenCalledWith(options);
		});

		it('should create provider with default empty options', () => {
			createStorageProvider('local');

			expect(LocalStorageProvider).toHaveBeenCalledWith({});
		});

		it('should throw error for unsupported storage type', () => {
			expect(() => {
				createStorageProvider('invalid' as StorageType);
			}).toThrow('Unsupported storage type: invalid');
		});

		it('should throw error for undefined storage type', () => {
			expect(() => {
				createStorageProvider(undefined as any);
			}).toThrow('Unsupported storage type: undefined');
		});

		it('should pass through all options correctly', () => {
			const complexOptions = {
				timeoutMinutes: 45,
				serialize: vi.fn(),
				deserialize: vi.fn()
			};

			createStorageProvider('indexeddb', complexOptions);

			expect(IndexedDBStorageProvider).toHaveBeenCalledWith(complexOptions);
		});
	});
});
