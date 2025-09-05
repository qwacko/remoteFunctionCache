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
		timeoutMinutes
	}: {
		initialValue?: TReturn | undefined;
		key?: string;
		storage?: StorageType;
		syncTabs?: boolean;
		timeoutMinutes?: number | null;
	} = {}
) {
	const functionKey = key || fn.name || 'anonymous';

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

	const refresh = (callFunction: boolean = false) => {
		const latestArgs = arg();

		refreshingInternal = true;
		// Clear any previous error at the start of a new request
		error = undefined;
		// Only show loading initially if we don't have current data
		loadingInternal = state.current === undefined;

		const executeFunction = async () => {
			try {
				// If using async storage (IndexedDB), wait for loading to complete
				if (state.isLoading) {
					await new Promise<void>(resolve => {
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
					// Force refresh the remote function cache first
					const queryPromise = latestArgs === undefined ? fn() : fn(latestArgs);
					await queryPromise.refresh();
					result = await queryPromise;
				} else {
					result = latestArgs === undefined ? await fn() : await fn(latestArgs);
				}
				state.current = result;
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
		refresh: () => refresh(true),
		setValue: (val: TReturn) => {
			state.current = val;
		}
	};
}