// Base interface for all storage providers
export interface StorageProvider<T> {
	/**
	 * Get a value from storage
	 * @param key - The storage key
	 * @returns Promise that resolves to the stored value or null if not found/expired
	 */
	get(key: string): Promise<T | null>;

	/**
	 * Set a value in storage
	 * @param key - The storage key
	 * @param value - The value to store
	 * @returns Promise that resolves when the value is stored
	 */
	set(key: string, value: T): Promise<void>;

	/**
	 * Remove a value from storage
	 * @param key - The storage key
	 * @returns Promise that resolves when the value is removed
	 */
	remove(key: string): Promise<void>;

	/**
	 * Check if the provider is currently loading data asynchronously
	 * This is primarily for IndexedDB which loads asynchronously
	 */
	isLoading(): boolean;

	/**
	 * Setup cross-tab synchronization if supported
	 * @param key - The storage key to sync
	 * @param callback - Called when the value changes in another tab
	 * @returns Cleanup function
	 */
	setupSync?(key: string, callback: (value: T | null) => void): (() => void) | void;
}

export interface StoredData<T> {
	value: T;
	timestamp: number;
}

export interface StorageOptions {
	timeoutMinutes?: number | null;
	serialize?: (value: unknown) => string;
	deserialize?: (value: string) => unknown;
}
