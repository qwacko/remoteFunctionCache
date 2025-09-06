import type { StorageProvider, StoredData, StorageOptions } from './StorageProvider.js';

export class SessionStorageProvider<T> implements StorageProvider<T> {
	private options: StorageOptions;

	constructor(options: StorageOptions = {}) {
		this.options = options;
	}

	async get(key: string): Promise<T | null> {
		if (typeof window === 'undefined') return null;

		try {
			const stored = sessionStorage.getItem(key);
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
			console.warn(`Failed to load from sessionStorage for key "${key}":`, error);
			return null;
		}
	}

	async set(key: string, value: T): Promise<void> {
		if (typeof window === 'undefined') return;

		try {
			const serialize = this.options.serialize ?? JSON.stringify;
			const dataToStore = this.wrapData(value);
			sessionStorage.setItem(key, serialize(dataToStore));
		} catch (error) {
			console.warn(`Failed to save to sessionStorage for key "${key}":`, error);
		}
	}

	async remove(key: string): Promise<void> {
		if (typeof window === 'undefined') return;
		sessionStorage.removeItem(key);
	}

	isLoading(): boolean {
		return false; // sessionStorage is synchronous
	}

	// SessionStorage doesn't support cross-tab synchronization
	setupSync(): () => void {
		return () => {}; // No-op cleanup function
	}

	private wrapData(value: T): StoredData<T> {
		return {
			value,
			timestamp: Date.now()
		};
	}

	private isStoredData(data: unknown): data is StoredData<T> {
		return (
			data &&
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
}
