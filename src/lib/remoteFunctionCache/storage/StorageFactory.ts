import type { StorageProvider, StorageOptions } from './StorageProvider.js';
import { LocalStorageProvider } from './LocalStorageProvider.js';
import { SessionStorageProvider } from './SessionStorageProvider.js';
import { IndexedDBStorageProvider } from './IndexedDBStorageProvider.js';
import { MemoryStorageProvider } from './MemoryStorageProvider.js';

export type StorageType = 'local' | 'session' | 'indexeddb' | 'memory';

export function createStorageProvider<T>(
	storageType: StorageType,
	options: StorageOptions = {}
): StorageProvider<T> {
	switch (storageType) {
		case 'local':
			return new LocalStorageProvider<T>(options);
		case 'session':
			return new SessionStorageProvider<T>(options);
		case 'indexeddb':
			return new IndexedDBStorageProvider<T>(options);
		case 'memory':
			return new MemoryStorageProvider<T>(options);
		default:
			throw new Error(`Unsupported storage type: ${storageType}`);
	}
}
