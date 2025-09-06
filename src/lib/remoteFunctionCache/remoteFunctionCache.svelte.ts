import type { RemoteQueryFunction } from '@sveltejs/kit';
import * as devalue from 'devalue';
import { untrack } from 'svelte';

import { CustomPersistedState } from './CustomPersistedState.svelte.js';
import { createStorageProvider, type StorageType } from './storage/StorageFactory.js';
import { SvelteDate } from 'svelte/reactivity';

const argToKey = (arg: unknown) => JSON.stringify(arg);

export function remoteFunctionCache<TArg, TReturn>(
	fn: RemoteQueryFunction<TArg, TReturn>,
	arg: () => TArg | undefined,
	{
		initialValue,
		key,
		storage = 'local',
		syncTabs = true,
		timeoutMinutes,
		autoSync = true,
		debug = false
	}: {
		initialValue?: TReturn | undefined;
		key?: string;
		storage?: StorageType;
		syncTabs?: boolean;
		timeoutMinutes?: number | null;
		autoSync?: boolean;
		debug?: boolean;
	} = {}
) {
	const functionKey = key || fn.name || 'anonymous';

	// Debug logging helper
	const debugLog = (message: string, ...args: unknown[]) => {
		if (debug) {
			console.log(`[${functionKey}] ${message}`, ...args);
		}
	};

	// Force localStorage when syncTabs is enabled and storage is sessionStorage
	const effectiveStorage: StorageType = syncTabs && storage === 'session' ? 'local' : storage;

	// Create the storage provider with proper serialization
	const storageProvider = createStorageProvider<TReturn | undefined>(effectiveStorage, {
		timeoutMinutes,
		serialize: (val) => devalue.stringify(val),
		deserialize: (val) => devalue.parse(val) as TReturn
	});

	const state = new CustomPersistedState<TReturn | undefined>(
		`${functionKey}-${argToKey(arg())}`,
		initialValue,
		storageProvider
	);

	// Unified state management
	let loadingInternal = $state(true);
	let refreshingInternal = $state(false);
	let error = $state<Error | undefined>();
	let updateTime = new SvelteDate();
	let prevArgToKey = $state<string | undefined>(undefined);

	// Monitor remote function directly using SvelteKit's reactive system
	const monitorRemote = $derived(fn(arg() as TArg));
	const monitorRemoteValue = $derived(monitorRemote.current);

	const refresh = (callFunction: boolean = false) => {
		const latestArgs = arg();

		debugLog(`refresh() called with callFunction=${callFunction}, args:`, latestArgs);

		// Set loading states based on current cache status
		const hasCache = state.current !== undefined;
		refreshingInternal = true;
		loadingInternal = !hasCache; // Only show loading spinner if no cached data

		// Clear any previous error at the start of a new request
		error = undefined;

		const executeFunction = async () => {
			try {
				// If using async storage (IndexedDB), wait for loading to complete
				while (state.isLoading) {
					await new Promise((resolve) => setTimeout(resolve, 10));
				}

				// If we now have data from cache, don't make a network request unless forced
				if (state.current !== undefined && !callFunction) {
					refreshingInternal = false;
					loadingInternal = false;
					return;
				}

				let result;
				let queryPromise;
				if (latestArgs !== undefined) {
					queryPromise = fn(latestArgs);
				} else {
					// When args are undefined, we need to handle this case properly
					// Since the function signature expects TArg, we pass the current arg value
					const currentArg = arg();
					if (currentArg !== undefined) {
						queryPromise = fn(currentArg);
					} else {
						// This shouldn't happen in normal usage, but handle gracefully
						throw new Error('Cannot call function with undefined arguments');
					}
				}

				if (callFunction) {
					debugLog('Calling function with forced refresh');
					// Force refresh the remote function cache first
					await queryPromise.refresh();
					result = await queryPromise;
				} else {
					debugLog('Calling function normally');
					result = await queryPromise;
				}
				debugLog('Function result:', result);
				state.current = result;
				debugLog('State updated to:', state.current);
				error = undefined;
			} catch (err) {
				error = err instanceof Error ? err : new Error(String(err));
			} finally {
				updateTime = new SvelteDate();
				refreshingInternal = false;
				loadingInternal = false;
			}
		};

		executeFunction();
	};

	// Handle Args Being Updated (including initial load)
	$effect(() => {
		arg();
		untrack(() => {
			const currentKey = argToKey(arg());
			if (prevArgToKey !== currentKey) {
				prevArgToKey = currentKey;
				// Retain the previous value to avoid flashing during cache load
				const shouldRetainValue = state.current !== undefined;
				state.newKey(`${functionKey}-${currentKey}`, initialValue, shouldRetainValue);

				// Use a proper coordination mechanism instead of setTimeout
				refresh();
			}
		});
	});

	// Auto-sync: Monitor remote function for SvelteKit invalidation changes
	$effect(() => {
		if (!autoSync) {
			debugLog('Auto-sync disabled');
			return;
		}

		// This reactive effect will trigger whenever SvelteKit invalidates the remote function
		const currentRemoteValue = monitorRemoteValue;
		debugLog('Remote function value changed:', currentRemoteValue);

		// Only update cache if we have a value and it's different from our current cache
		if (currentRemoteValue !== undefined) {
			const currentCacheValue = state.current;
			// Avoid proxy equality issues by using JSON comparison for Svelte 5 compatibility
			const remoteString = JSON.stringify(currentRemoteValue);
			const cacheString = JSON.stringify(currentCacheValue);

			if (remoteString !== cacheString) {
				debugLog('Auto-sync: Updating cache with fresh data from SvelteKit');
				debugLog('Cached:', currentCacheValue);
				debugLog('Remote:', currentRemoteValue);

				// Update our cache with the fresh data from SvelteKit
				state.current = currentRemoteValue;
				updateTime = new SvelteDate();
				error = undefined;

				debugLog('Auto-sync: Cache updated successfully');
			} else {
				debugLog('Auto-sync: Remote value same as cache, no update needed');
			}
		}
	});

	return {
		get loading() {
			return loadingInternal;
		},
		get refreshing() {
			return refreshingInternal;
		},
		get error() {
			return error;
		},
		get value() {
			return state;
		},
		get updateTime() {
			return updateTime;
		},
		get autoSync() {
			return autoSync;
		},
		refresh: () => refresh(true),
		setValue: (val: TReturn) => {
			state.current = val;
			updateTime = new SvelteDate();
		},
		destroy: () => {
			debugLog('Destroying remoteFunctionCache instance');
			state.destroy();
		}
	};
}
