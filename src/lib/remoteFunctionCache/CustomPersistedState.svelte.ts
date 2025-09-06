import type { StorageProvider } from './storage/StorageProvider.js';

// Efficient equality check that handles complex objects and circular references
function isEqual<T>(a: T, b: T): boolean {
	// Fast path for primitive values and same reference
	if (a === b) return true;
	if (a == null || b == null) return a === b;
	if (typeof a !== 'object' || typeof b !== 'object') return false;
	
	// For objects, use JSON comparison as fallback (could be optimized further)
	try {
		return JSON.stringify(a) === JSON.stringify(b);
	} catch {
		// Fallback for circular references or non-serializable objects
		return false;
	}
}

// Global registry to track instances by key for same-tab synchronization
const instanceRegistry = new Map<string, Set<CustomPersistedState<any>>>();

export class CustomPersistedState<DataType extends any> {
	#current = $state<DataType | undefined>();
	private isUpdating = false;
	private storageCleanup?: () => void;
	private key: string;
	private initialValue: DataType;
	private uniquekey?: string;

	constructor(
		key: string,
		initialValue: DataType,
		private storageProvider: StorageProvider<DataType>,
		options: { uniquekey?: string } = {}
	) {
		this.key = key;
		this.initialValue = initialValue;
		this.uniquekey = options.uniquekey;

		this.#current = initialValue;
		this.registerInstance();
		this.setupSync();
		this.loadFromStorage();
	}

	get current(): DataType | undefined {
		return this.#current;
	}

	set current(value: DataType | undefined) {
		// Efficient equality check with fast path for primitives
		const hasChanged = !this.isUpdating && !isEqual(value, this.#current);
		
		if (hasChanged) {
			this.#current = value;
			if (value !== undefined) {
				this.saveToStorage(value);
				this.syncOtherInstances(value);
			}
		} else {
			this.#current = value;
		}
	}

	get isLoading(): boolean {
		return this.storageProvider.isLoading();
	}

	private getCompositeKey(): string {
		return this.uniquekey ? `${this.key}:${this.uniquekey}` : this.key;
	}

	private registerInstance(): void {
		const compositeKey = this.getCompositeKey();
		if (!instanceRegistry.has(compositeKey)) {
			instanceRegistry.set(compositeKey, new Set());
		}
		instanceRegistry.get(compositeKey)!.add(this);
	}

	private unregisterInstance(): void {
		const compositeKey = this.getCompositeKey();
		const instances = instanceRegistry.get(compositeKey);
		if (instances) {
			instances.delete(this);
			if (instances.size === 0) {
				instanceRegistry.delete(compositeKey);
			}
		}
	}

	private syncOtherInstances(value: DataType): void {
		const compositeKey = this.getCompositeKey();
		const instances = instanceRegistry.get(compositeKey);
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

	private async loadFromStorage(): Promise<void> {
		const compositeKey = this.getCompositeKey();
		const value = await this.storageProvider.get(compositeKey);
		
		if (value !== null) {
			this.isUpdating = true;
			this.#current = value;
			this.isUpdating = false;
		}
	}

	private async saveToStorage(value: DataType): Promise<void> {
		const compositeKey = this.getCompositeKey();
		await this.storageProvider.set(compositeKey, value);
	}

	private setupSync(): void {
		const compositeKey = this.getCompositeKey();
		
		// Set up cross-tab synchronization if supported by the provider
		if (this.storageProvider.setupSync) {
			const cleanup = this.storageProvider.setupSync(compositeKey, (value) => {
				if (!this.isUpdating && value !== null) {
					this.isUpdating = true;
					this.#current = value;
					this.isUpdating = false;
					this.syncOtherInstances(value);
				}
			});
			if (cleanup) {
				this.storageCleanup = cleanup;
			}
		}
	}

	newKey(key: string, newInitialValue?: DataType, retainValue: boolean = false): void {
		// Store current value if we want to retain it
		const valueToRetain = retainValue ? this.#current : undefined;
		
		// Clean up current setup
		this.unregisterInstance();
		if (this.storageCleanup) {
			this.storageCleanup();
		}

		// Update key and initial value
		this.key = key;
		if (newInitialValue !== undefined) {
			this.initialValue = newInitialValue;
		}

		// Setup with new key - retain previous value if requested
		if (retainValue && valueToRetain !== undefined) {
			// Keep the current value while we load from storage
			// loadFromStorage will overwrite if cache data exists
		} else {
			this.#current = this.initialValue;
		}
		
		this.registerInstance();
		this.setupSync();
		this.loadFromStorage();

		// Sync other instances with the same new key
		if (this.current !== undefined) {
			this.syncOtherInstances(this.current);
		}
	}

	async reset(): Promise<void> {
		this.#current = this.initialValue;
		const compositeKey = this.getCompositeKey();
		await this.storageProvider.remove(compositeKey);
		this.syncOtherInstances(this.initialValue);
	}

	destroy(): void {
		this.unregisterInstance();
		if (this.storageCleanup) {
			this.storageCleanup();
			this.storageCleanup = undefined;
		}
	}
}