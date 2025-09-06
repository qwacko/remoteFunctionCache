import type { RemoteQueryFunction } from '@sveltejs/kit';
import * as devalue from 'devalue';
import { untrack } from 'svelte';

import { CustomPersistedState } from './CustomPersistedState.svelte.js';
import { createStorageProvider, type StorageType } from './storage/StorageFactory.js';

const argToKey = (arg: any) => JSON.stringify(arg);

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
	const debugLog = (message: string, ...args: any[]) => {
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

	let state = new CustomPersistedState<TReturn | undefined>(
		`${functionKey}-${argToKey(arg())}`,
		initialValue,
		storageProvider
	);

	let loadingInternal = $state(true);
	let refreshingInternal = $state(true);
	let error = $state<any>();
	let updateTime = $state<Date>(new Date());
	let prevArgToKey = $state<string | undefined>(null as any);

	// Monitor remote function directly using SvelteKit's reactive system
	const monitorRemote = $derived(fn(arg() as TArg));
	const monitorRemoteValue = $derived(monitorRemote.current);

	const refresh = (callFunction: boolean = false) => {
		const latestArgs = arg();

		debugLog(`refresh() called with callFunction=${callFunction}, args:`, latestArgs);

		refreshingInternal = true;
		// Clear any previous error at the start of a new request
		error = undefined;
		// Only show loading initially if we don't have current data
		loadingInternal = state.current === undefined;

		const executeFunction = async () => {
			try {
				// If using async storage (IndexedDB), wait for loading to complete
				if (state.isLoading) {
					await new Promise<void>((resolve) => {
						const checkLoading = () => {
							if (!state.isLoading) {
								resolve();
							} else {
								setTimeout(checkLoading, 10);
							}
						};
						checkLoading();
					});
				}

				// If we now have data from cache, don't make a network request unless forced
				if (state.current !== undefined && !callFunction) {
					refreshingInternal = false;
					loadingInternal = false;
					return;
				}

				// Only set loading to true if we actually need to make a network request
				if (state.current === undefined) {
					loadingInternal = true;
				}

				let result;
				if (callFunction) {
					debugLog('Calling function with forced refresh');
					// Force refresh the remote function cache first
					const queryPromise = latestArgs === undefined ? fn() : fn(latestArgs);
					await queryPromise.refresh();
					result = await queryPromise;
				} else {
					debugLog('Calling function normally');
					const queryPromise = latestArgs === undefined ? fn() : fn(latestArgs);
					result = await queryPromise;
				}
				debugLog('Function result:', result);
				state.current = result;
				debugLog('State updated to:', state.current);
				error = undefined;
			} catch (err) {
				error = err;
			} finally {
				updateTime = new Date();
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
				state.newKey(`${functionKey}-${currentKey}`, initialValue);
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
			const remoteValueString = JSON.stringify(currentRemoteValue);
			const cacheValueString = JSON.stringify(currentCacheValue);

			if (remoteValueString !== cacheValueString) {
				debugLog('Auto-sync: Updating cache with fresh data from SvelteKit');
				debugLog('Cached:', currentCacheValue);
				debugLog('Remote:', currentRemoteValue);

				// Update our cache with the fresh data from SvelteKit
				state.current = currentRemoteValue;
				updateTime = new Date();
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
			updateTime = new Date();
		}
	};
}
