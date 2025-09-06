import type { StorageProvider, StoredData, StorageOptions } from './StorageProvider.js';

// In-memory storage for testing and scenarios where persistence isn't needed
const memoryStorage = new Map<string, any>();

export class MemoryStorageProvider<T> implements StorageProvider<T> {
	private options: StorageOptions;

	constructor(options: StorageOptions = {}) {
		this.options = options;
	}

	async get(key: string): Promise<T | null> {
		try {
			const stored = memoryStorage.get(key);
			if (!stored) return null;

			const deserialize = this.options.deserialize ?? JSON.parse;
			const parsedData = deserialize(stored);

			// Handle wrapped format with timestamp
			if (this.isStoredData(parsedData)) {
				if (this.isDataExpired(parsedData.timestamp)) {
					// Data expired, remove it
					await this.remove(key);
					return null;
				}
				return parsedData.value;
			}

			// Legacy data format - treat as unexpired
			return parsedData;
		} catch (error) {
			console.warn(`Failed to load from memory storage for key "${key}":`, error);
			return null;
		}
	}

	async set(key: string, value: T): Promise<void> {
		try {
			const serialize = this.options.serialize ?? JSON.stringify;
			const dataToStore = this.wrapData(value);
			const serializedData = serialize(dataToStore);

			memoryStorage.set(key, serializedData);
		} catch (error) {
			console.warn(`Failed to save to memory storage for key "${key}":`, error);
		}
	}

	async remove(key: string): Promise<void> {
		memoryStorage.delete(key);
	}

	isLoading(): boolean {
		return false; // Memory operations are synchronous
	}

	// Memory storage doesn't support cross-tab sync (different process memory)
	setupSync?(key: string, callback: (value: T | null) => void): () => void {
		// Return empty cleanup function
		return () => {};
	}

	private wrapData(value: T): StoredData<T> {
		return {
			value,
			timestamp: Date.now()
		};
	}

	private isStoredData(data: unknown): data is StoredData<T> {
		return (
			!!data &&
			typeof data === 'object' &&
			'timestamp' in data &&
			'value' in data &&
			typeof data.timestamp === 'number'
		);
	}

	private isDataExpired(timestamp: number): boolean {
		if (!this.isTimeoutEnabled()) return false;
		const timeoutMs = this.options.timeoutMinutes! * 60 * 1000;
		return Date.now() - timestamp > timeoutMs;
	}

	private isTimeoutEnabled(): boolean {
		return this.options.timeoutMinutes != null && this.options.timeoutMinutes > 0;
	}

	// Static method to clear all memory storage (useful for testing)
	static clear(): void {
		memoryStorage.clear();
	}

	// Static method to get storage size (useful for debugging)
	static size(): number {
		return memoryStorage.size;
	}
}
