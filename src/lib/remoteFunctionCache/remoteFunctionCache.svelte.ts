// src/lib/remoteCache.svelte.ts
import type { RemoteQueryFunction } from '@sveltejs/kit';
import * as devalue from 'devalue';
import { untrack } from 'svelte';

import { CustomPersistedState } from './CustomPersistedState.svelte';

const globalCache = new WeakMap<Function, Map<string, any>>();

const argToKey = (arg: any) => JSON.stringify(arg);

export function remoteFunctionCache<TArg, TReturn>(
	fn: RemoteQueryFunction<TArg, TReturn>,
	arg: () => TArg | undefined,
	{
		initialValue,
		key,
		storage = 'indexeddb',
		syncTabs = true,
		timeoutMinutes // Default to 60 minutes
	}: {
		initialValue?: TReturn | undefined;
		key?: string;
		storage?: 'local' | 'session' | 'indexeddb';
		syncTabs?: boolean;
		timeoutMinutes?: number | null;
	} = {}
) {
	const functionKey = key || fn.name || 'anonymous';

	// Force localStorage when syncTabs is enabled and storage is sessionStorage (since sessionStorage doesn't support cross-tab sync)
	const effectiveStorage = syncTabs && storage === 'session' ? 'local' : storage;

	let state = new CustomPersistedState<TReturn | undefined>(
		`${functionKey}-${argToKey(arg())}`,
		initialValue,
		{
			deserialize: (val) => devalue.parse(val) as TReturn,
			serialize: (val) => devalue.stringify(val),
			storage: effectiveStorage,
			syncTabs,
			timeoutMinutes
		}
	);


	let loadingInternal = $state(true);
	let refreshingInternal = $state(true);
	let error = $state<any>();
	let updateTime = $state<Date>(new Date());
	let prevArgToKey = $state<string | undefined>(null as any); // Use null to ensure first comparison always triggers

	const refresh = (callFunction: boolean = false) => {
		const latestArgs = arg();

		refreshingInternal = true;
		// Only show loading initially if we don't have current data
		// The executeFunction will handle IndexedDB loading and network requests appropriately
		loadingInternal = state.current === undefined;

		const executeFunction = async () => {
			try {
				// If using IndexedDB, wait for the async load to complete
				if (state.isLoading) {
					await new Promise(resolve => {
						const checkLoading = () => {
							if (!state.isLoading) {
								resolve(undefined);
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

	//Handle Args Being Updated (including initial load)
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
