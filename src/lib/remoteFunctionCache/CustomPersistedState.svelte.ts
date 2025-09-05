// Global registry to track instances by key
const instanceRegistry = new Map<string, Set<CustomPersistedState<any>>>();

interface StoredData<T> {
	value: T;
	timestamp: number;
}

export class CustomPersistedState<DataType extends any> {
	#current = $state<DataType>();
	private isUpdating = false;
	private storageEventHandler?: (e: StorageEvent) => void;
	private broadcastChannel?: BroadcastChannel;
	private idbPromise?: Promise<IDBDatabase>;
	private isLoadingFromIndexedDB = false;

	constructor(
		private key: string,
		private initialValue: DataType,
		private options: {
			storage: 'local' | 'session' | 'indexeddb';
			syncTabs: boolean;
			serialize?: (value: DataType) => string;
			deserialize?: (value: string) => DataType;
			uniquekey?: string;
			timeoutMinutes?: number | null;
		} = {
			storage: 'local',
			syncTabs: false,
			uniquekey: 'CPS-'
		}
	) {
		this.#current = this.loadFromStorage();
		this.registerInstance();
		this.setupStorageSync();
	}

	get current(): DataType {
		return this.#current;
	}

	set current(value: DataType) {
		if (value !== this.#current && !this.isUpdating) {
			this.#current = value;
			this.saveToStorage(value);
			this.syncOtherInstances(value);
		} else {
			this.#current = value;
		}
	}

	get isLoading(): boolean {
		return this.isLoadingFromIndexedDB;
	}

	private get storage(): Storage | null {
		if (typeof window === 'undefined') return null;
		if (this.options.storage === 'indexeddb') return null;
		return this.options.storage === 'local' ? window.localStorage : window.sessionStorage;
	}

	private async getIDB(): Promise<IDBDatabase> {
		if (this.idbPromise) return this.idbPromise;

		this.idbPromise = new Promise((resolve, reject) => {
			const request = indexedDB.open('CustomPersistedState', 1);

			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve(request.result);

			request.onupgradeneeded = () => {
				const db = request.result;
				if (!db.objectStoreNames.contains('keyValueStore')) {
					db.createObjectStore('keyValueStore');
				}
			};
		});

		return this.idbPromise;
	}

	private getCompositeKey(): string {
		return this.options.uniquekey ? `${this.key}:${this.options.uniquekey}` : this.key;
	}

	private isTimeoutEnabled(): boolean {
		return this.options.timeoutMinutes != null && this.options.timeoutMinutes > 0;
	}

	private isDataExpired(timestamp: number): boolean {
		if (!this.isTimeoutEnabled()) return false;
		const timeoutMs = this.options.timeoutMinutes! * 60 * 1000;
		return Date.now() - timestamp > timeoutMs;
	}

	private wrapData(value: DataType): StoredData<DataType> {
		return {
			value,
			timestamp: Date.now()
		};
	}

	private unwrapData(storedData: StoredData<DataType>): DataType | null {
		if (this.isDataExpired(storedData.timestamp)) {
			return null; // Data is expired
		}
		return storedData.value;
	}

	private registerInstance(): void {
		if (!instanceRegistry.has(this.key)) {
			instanceRegistry.set(this.key, new Set());
		}
		instanceRegistry.get(this.key)!.add(this);
	}

	private unregisterInstance(): void {
		const instances = instanceRegistry.get(this.key);
		if (instances) {
			instances.delete(this);
			if (instances.size === 0) {
				instanceRegistry.delete(this.key);
			}
		}
	}

	private syncOtherInstances(value: DataType): void {
		const instances = instanceRegistry.get(this.key);
		if (instances) {
			instances.forEach((instance) => {
				if (instance !== this && !instance.isUpdating) {
					instance.isUpdating = true;
					instance.current = value;
					instance.isUpdating = false;
				}
			});
		}
	}

	private loadFromStorage(): DataType {
		if (this.options.storage === 'indexeddb') {
			// For IndexedDB, we'll load asynchronously and update current later
			this.isLoadingFromIndexedDB = true;
			this.loadFromIndexedDB();
			return this.initialValue;
		}

		try {
			const compositeKey = this.getCompositeKey();
			const stored = this.storage?.getItem(compositeKey);
			if (stored) {
				const deserialize = this.options.deserialize ?? JSON.parse;
				const parsedData = deserialize(stored);

				// Expect wrapped format with timestamp
				if (
					parsedData &&
					typeof parsedData === 'object' &&
					'timestamp' in parsedData &&
					'value' in parsedData
				) {
					const unwrapped = this.unwrapData(parsedData as StoredData<DataType>);
					if (unwrapped !== null) {
						return unwrapped;
					}
					// Data expired, remove it
					this.storage?.removeItem(compositeKey);
				}
				// If data is not in expected format, ignore it (treat as invalid)
			}
		} catch (error) {
			console.warn(`Failed to load persisted state for key "${this.getCompositeKey()}":`, error);
		}
		return this.initialValue;
	}

	private async loadFromIndexedDB(): Promise<void> {
		if (typeof window === 'undefined') return;

		try {
			const db = await this.getIDB();
			const transaction = db.transaction(['keyValueStore'], 'readonly');
			const store = transaction.objectStore('keyValueStore');
			const compositeKey = this.getCompositeKey();

			const request = store.get(compositeKey);
			request.onsuccess = () => {
				this.isLoadingFromIndexedDB = false;
				if (request.result !== undefined) {
					const deserialize = this.options.deserialize ?? JSON.parse;
					const parsedData = deserialize(request.result);

					// Expect wrapped format with timestamp
					if (
						parsedData &&
						typeof parsedData === 'object' &&
						'timestamp' in parsedData &&
						'value' in parsedData
					) {
						const finalValue = this.unwrapData(parsedData as StoredData<DataType>);
						if (finalValue !== null) {
							this.isUpdating = true;
							this.#current = finalValue;
							this.isUpdating = false;
						} else {
							// Data expired, remove it
							this.removeFromIndexedDB(compositeKey);
						}
					}
					// If data is not in expected format, ignore it (treat as invalid)
				}
			};
			request.onerror = () => {
				this.isLoadingFromIndexedDB = false;
			};
		} catch (error) {
			console.warn(`Failed to load from IndexedDB for key "${this.getCompositeKey()}":`, error);
		}
	}

	private saveToStorage(value: DataType): void {
		if (this.options.storage === 'indexeddb') {
			this.saveToIndexedDB(value);
			return;
		}

		try {
			const serialize = this.options.serialize ?? JSON.stringify;
			const compositeKey = this.getCompositeKey();

			// Always wrap with timestamp for consistent storage format
			const dataToStore = this.wrapData(value);
			this.storage?.setItem(compositeKey, serialize(dataToStore));
		} catch (error) {
			console.warn(`Failed to save persisted state for key "${this.getCompositeKey()}":`, error);
		}
	}

	private async saveToIndexedDB(value: DataType): Promise<void> {
		if (typeof window === 'undefined') return;

		try {
			const db = await this.getIDB();
			const transaction = db.transaction(['keyValueStore'], 'readwrite');
			const store = transaction.objectStore('keyValueStore');
			const serialize = this.options.serialize ?? JSON.stringify;
			const compositeKey = this.getCompositeKey();

			// Always wrap with timestamp for consistent storage format
			const dataToStore = this.wrapData(value);
			const serializedData = serialize(dataToStore);

			store.put(serializedData, compositeKey);

			// Broadcast changes to other tabs if syncTabs is enabled
			if (this.options.syncTabs && this.broadcastChannel) {
				this.broadcastChannel.postMessage({
					key: compositeKey,
					value: serializedData
				});
			}
		} catch (error) {
			console.warn(`Failed to save to IndexedDB for key "${this.getCompositeKey()}":`, error);
		}
	}

	private setupStorageSync(): void {
		if (typeof window === 'undefined') return;

		// Set up cross-tab synchronization if enabled
		if (this.options.syncTabs) {
			if (this.options.storage === 'local') {
				// Use storage event for localStorage
				this.storageEventHandler = (e: StorageEvent) => {
					const compositeKey = this.getCompositeKey();
					if (e.key === compositeKey && e.newValue && !this.isUpdating) {
						try {
							const deserialize = this.options.deserialize ?? JSON.parse;
							const parsedData = deserialize(e.newValue);

							// Expect wrapped format with timestamp
							if (
								parsedData &&
								typeof parsedData === 'object' &&
								'timestamp' in parsedData &&
								'value' in parsedData
							) {
								const finalValue = this.unwrapData(parsedData as StoredData<DataType>);
								if (finalValue !== null) {
									this.isUpdating = true;
									this.#current = finalValue;
									this.isUpdating = false;
									this.syncOtherInstances(finalValue);
								}
							}
							// If data is not in expected format, ignore it (treat as invalid)
						} catch (error) {
							console.warn(`Failed to sync state from storage for key "${compositeKey}":`, error);
						}
					}
				};
				window.addEventListener('storage', this.storageEventHandler);
			} else if (this.options.storage === 'indexeddb') {
				// Use BroadcastChannel for IndexedDB
				const compositeKey = this.getCompositeKey();
				this.broadcastChannel = new BroadcastChannel(`CustomPersistedState-${compositeKey}`);
				this.broadcastChannel.onmessage = (event) => {
					if (event.data.key === compositeKey && !this.isUpdating) {
						try {
							const deserialize = this.options.deserialize ?? JSON.parse;
							const parsedData = deserialize(event.data.value);

							// Expect wrapped format with timestamp
							if (
								parsedData &&
								typeof parsedData === 'object' &&
								'timestamp' in parsedData &&
								'value' in parsedData
							) {
								const finalValue = this.unwrapData(parsedData as StoredData<DataType>);
								if (finalValue !== null) {
									this.isUpdating = true;
									this.#current = finalValue;
									this.isUpdating = false;
									this.syncOtherInstances(finalValue);
								}
							}
							// If data is not in expected format, ignore it (treat as invalid)
						} catch (error) {
							console.warn(`Failed to sync state from broadcast for key "${compositeKey}":`, error);
						}
					}
				};
			}
		}
	}

	newKey(key: string, newInitialValue?: DataType): void {
		// Unregister from current key
		this.unregisterInstance();

		// Update key and initial value
		this.key = key;
		if (newInitialValue !== undefined) {
			this.initialValue = newInitialValue;
		}

		// Load value from new key or use initial value
		this.#current = this.loadFromStorage();

		// Register with new key
		this.registerInstance();

		// Sync other instances with the same new key
		this.syncOtherInstances(this.current);
	}

	reset(): void {
		this.#current = this.initialValue;
		const compositeKey = this.getCompositeKey();

		if (this.options.storage === 'indexeddb') {
			this.removeFromIndexedDB(compositeKey);
		} else {
			this.storage?.removeItem(compositeKey);
		}

		this.syncOtherInstances(this.initialValue);
	}

	private async removeFromIndexedDB(compositeKey: string): Promise<void> {
		if (typeof window === 'undefined') return;

		try {
			const db = await this.getIDB();
			const transaction = db.transaction(['keyValueStore'], 'readwrite');
			const store = transaction.objectStore('keyValueStore');
			store.delete(compositeKey);
		} catch (error) {
			console.warn(`Failed to remove from IndexedDB for key "${compositeKey}":`, error);
		}
	}

	destroy(): void {
		this.unregisterInstance();

		// Clean up storage event listener
		if (this.storageEventHandler) {
			window.removeEventListener('storage', this.storageEventHandler);
			this.storageEventHandler = undefined;
		}

		// Clean up broadcast channel
		if (this.broadcastChannel) {
			this.broadcastChannel.close();
			this.broadcastChannel = undefined;
		}
	}
}
