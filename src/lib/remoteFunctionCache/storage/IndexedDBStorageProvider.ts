import type { StorageProvider, StoredData, StorageOptions } from './StorageProvider.js';

export class IndexedDBStorageProvider<T> implements StorageProvider<T> {
	private options: StorageOptions;
	private idbPromise?: Promise<IDBDatabase>;
	private broadcastChannel?: BroadcastChannel;
	private isLoadingData = false;
	private readonly DB_NAME = 'CustomPersistedState';
	private readonly STORE_NAME = 'keyValueStore';

	constructor(options: StorageOptions = {}) {
		this.options = options;
	}

	async get(key: string): Promise<T | null> {
		if (typeof window === 'undefined') return null;

		try {
			this.isLoadingData = true;
			const db = await this.getIDB();
			const transaction = db.transaction([this.STORE_NAME], 'readonly');
			const store = transaction.objectStore(this.STORE_NAME);

			return new Promise((resolve) => {
				const request = store.get(key);

				request.onsuccess = () => {
					this.isLoadingData = false;

					if (request.result === undefined) {
						resolve(null);
						return;
					}

					try {
						const deserialize = this.options.deserialize ?? JSON.parse;
						const parsedData = deserialize(request.result);

						// Handle wrapped format with timestamp
						if (this.isStoredData(parsedData)) {
							if (this.isDataExpired(parsedData.timestamp)) {
								// Data expired, remove it
								this.remove(key);
								resolve(null);
								return;
							}
							resolve(parsedData.value);
						} else {
							// Legacy data format - treat as unexpired
							resolve(parsedData);
						}
					} catch (error) {
						console.warn(`Failed to deserialize IndexedDB data for key "${key}":`, error);
						resolve(null);
					}
				};

				request.onerror = () => {
					this.isLoadingData = false;
					console.warn(`Failed to load from IndexedDB for key "${key}":`, request.error);
					resolve(null);
				};
			});
		} catch (error) {
			this.isLoadingData = false;
			console.warn(`Failed to access IndexedDB for key "${key}":`, error);
			return null;
		}
	}

	async set(key: string, value: T): Promise<void> {
		if (typeof window === 'undefined') return;

		try {
			const db = await this.getIDB();
			const transaction = db.transaction([this.STORE_NAME], 'readwrite');
			const store = transaction.objectStore(this.STORE_NAME);
			const serialize = this.options.serialize ?? JSON.stringify;

			const dataToStore = this.wrapData(value);
			const serializedData = serialize(dataToStore);

			return new Promise((resolve, reject) => {
				const request = store.put(serializedData, key);

				request.onsuccess = () => {
					// Broadcast changes for cross-tab sync
					if (this.broadcastChannel) {
						this.broadcastChannel.postMessage({
							key,
							value: serializedData
						});
					}
					resolve();
				};

				request.onerror = () => {
					console.warn(`Failed to save to IndexedDB for key "${key}":`, request.error);
					reject(request.error);
				};
			});
		} catch (error) {
			console.warn(`Failed to save to IndexedDB for key "${key}":`, error);
		}
	}

	async remove(key: string): Promise<void> {
		if (typeof window === 'undefined') return;

		try {
			const db = await this.getIDB();
			const transaction = db.transaction([this.STORE_NAME], 'readwrite');
			const store = transaction.objectStore(this.STORE_NAME);

			return new Promise((resolve) => {
				const request = store.delete(key);

				request.onsuccess = () => resolve();
				request.onerror = () => {
					console.warn(`Failed to remove from IndexedDB for key "${key}":`, request.error);
					resolve(); // Don't fail the operation
				};
			});
		} catch (error) {
			console.warn(`Failed to remove from IndexedDB for key "${key}":`, error);
		}
	}

	isLoading(): boolean {
		return this.isLoadingData;
	}

	setupSync(key: string, callback: (value: T | null) => void): () => void {
		if (typeof window === 'undefined') return () => {};

		// Clean up existing channel if any
		if (this.broadcastChannel) {
			this.broadcastChannel.close();
		}

		// Use BroadcastChannel for IndexedDB cross-tab sync
		const channelName = `CustomPersistedState-${key}`;
		this.broadcastChannel = new BroadcastChannel(channelName);

		const handler = (event: MessageEvent) => {
			if (event.data.key === key) {
				try {
					const deserialize = this.options.deserialize ?? JSON.parse;
					const parsedData = deserialize(event.data.value);

					if (this.isStoredData(parsedData)) {
						if (!this.isDataExpired(parsedData.timestamp)) {
							callback(parsedData.value);
						} else {
							callback(null);
						}
					} else {
						callback(parsedData);
					}
				} catch (error) {
					console.warn(`Failed to sync IndexedDB data for key "${key}":`, error);
				}
			}
		};

		this.broadcastChannel.onmessage = handler;

		return () => {
			if (this.broadcastChannel) {
				this.broadcastChannel.close();
				this.broadcastChannel = undefined;
			}
		};
	}

	private async getIDB(): Promise<IDBDatabase> {
		if (this.idbPromise) return this.idbPromise;

		this.idbPromise = new Promise((resolve, reject) => {
			const request = indexedDB.open(this.DB_NAME, 1);

			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve(request.result);

			request.onupgradeneeded = () => {
				const db = request.result;
				if (!db.objectStoreNames.contains(this.STORE_NAME)) {
					db.createObjectStore(this.STORE_NAME);
				}
			};
		});

		return this.idbPromise;
	}

	private wrapData(value: T): StoredData<T> {
		return {
			value,
			timestamp: Date.now()
		};
	}

	private isStoredData(data: any): data is StoredData<T> {
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
