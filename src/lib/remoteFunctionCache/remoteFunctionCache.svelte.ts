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
	let prevArgToKey = $state<string | undefined>();

	const refresh = (callFunction: boolean = false) => {
		const latestArgs = arg();
		if (latestArgs === undefined) {
			state.current = undefined;
			loadingInternal = false;
			refreshingInternal = false;
			return;
		}

		refreshingInternal = true;
		if (state.current === undefined) {
			loadingInternal = true;
		} else {
			loadingInternal = false;
		}

		const executeFunction = async () => {
			try {
				let result;
				if (callFunction) {
					// Force refresh the remote function cache first
					await fn(latestArgs).refresh();
					result = await fn(latestArgs);
				} else {
					result = await fn(latestArgs);
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

	//Handle Args Being Updated
	$effect(() => {
		arg();
		untrack(() => {
			if (prevArgToKey !== argToKey(arg())) {
				prevArgToKey = argToKey(arg());
				state.newKey(`${functionKey}-${argToKey(arg())}`, initialValue);
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
