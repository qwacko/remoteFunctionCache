<script lang="ts">
	import { remoteFunctionCache } from '../../lib/index.js';
	import { getUsers } from '../data.remote.js';
	import { onMount } from 'svelte';

	let performanceData = $state<
		{ storage: string; writeTime: string; readTime: string; dataSize: number }[]
	>([]);
	let isRunningTest = $state(false);

	// Three identical caches with different storage types
	const localStorageCache = remoteFunctionCache(getUsers, () => undefined, {
		key: 'storage-test-local',
		storage: 'local',
		syncTabs: false,
		timeoutMinutes: null
	});

	const sessionStorageCache = remoteFunctionCache(getUsers, () => undefined, {
		key: 'storage-test-session',
		storage: 'session',
		syncTabs: false,
		timeoutMinutes: null
	});

	const indexedDBCache = remoteFunctionCache(getUsers, () => undefined, {
		key: 'storage-test-idb',
		storage: 'indexeddb',
		syncTabs: false,
		timeoutMinutes: null
	});

	const memoryCache = remoteFunctionCache(getUsers, () => undefined, {
		key: 'storage-test-memory',
		storage: 'memory',
		syncTabs: false,
		timeoutMinutes: null
	});

	const runPerformanceTest = async () => {
		isRunningTest = true;
		performanceData = [];

		const testData = Array.from({ length: 1000 }, (_, i) => ({
			id: i,
			name: `User ${i}`,
			email: `user${i}@example.com`,
			data: 'x'.repeat(100) // Add some bulk to each record
		}));

		const tests = [
			{ name: 'localStorage', cache: localStorageCache, storage: 'local' },
			{ name: 'sessionStorage', cache: sessionStorageCache, storage: 'session' },
			{ name: 'IndexedDB', cache: indexedDBCache, storage: 'indexeddb' },
			{ name: 'Memory', cache: memoryCache, storage: 'memory' }
		];

		for (const test of tests) {
			// Write test
			const writeStart = performance.now();
			test.cache.setValue(testData);
			await new Promise((resolve) => setTimeout(resolve, 100)); // Allow async operations to complete
			const writeEnd = performance.now();

			// Read test (measure cache access time)
			const readStart = performance.now();
			// Simply access the existing cache data instead of creating a new cache
			// Read cached data for performance measurement
			const cachedData = test.cache.value?.current;
			console.log('Cache read for', test.name, ':', !!cachedData);
			await new Promise((resolve) => setTimeout(resolve, 10)); // Minimal delay to simulate cache access
			const readEnd = performance.now();

			performanceData.push({
				storage: test.name,
				writeTime: (writeEnd - writeStart).toFixed(2),
				readTime: (readEnd - readStart).toFixed(2),
				dataSize: new Blob([JSON.stringify(testData)]).size
			});
		}

		performanceData = [...performanceData]; // Trigger reactivity
		isRunningTest = false;
	};

	const clearAllCaches = () => {
		localStorageCache.setValue([]);
		sessionStorageCache.setValue([]);
		indexedDBCache.setValue([]);
		memoryCache.setValue([]);
	};

	const populateAllCaches = () => {
		const sampleData = [
			{ id: 1, name: 'Alice', email: 'alice@example.com' },
			{ id: 2, name: 'Bob', email: 'bob@example.com' },
			{ id: 3, name: 'Charlie', email: 'charlie@example.com' }
		];

		localStorageCache.setValue(sampleData);
		sessionStorageCache.setValue(sampleData);
		indexedDBCache.setValue(sampleData);
		memoryCache.setValue(sampleData);
	};

	onMount(() => {
		// Pre-populate with sample data
		populateAllCaches();
	});
</script>

<h1>Storage Comparison</h1>

<div class="card">
	<h2>Storage Type Differences</h2>
	<div class="grid grid-cols-2 md:grid-cols-4">
		<div class="card">
			<h3>localStorage</h3>
			<ul class="text-sm">
				<li>✅ Persistent across sessions</li>
				<li>✅ Cross-tab synchronization</li>
				<li>⚠️ ~5-10MB limit</li>
				<li>⚠️ Synchronous API</li>
				<li>⚠️ Only strings (JSON serialization)</li>
			</ul>
		</div>
		<div class="card">
			<h3>sessionStorage</h3>
			<ul class="text-sm">
				<li>⚠️ Cleared when tab closes</li>
				<li>❌ No cross-tab sync</li>
				<li>⚠️ ~5-10MB limit</li>
				<li>⚠️ Synchronous API</li>
				<li>⚠️ Only strings (JSON serialization)</li>
			</ul>
		</div>
		<div class="card">
			<h3>IndexedDB</h3>
			<ul class="text-sm">
				<li>✅ Persistent across sessions</li>
				<li>✅ Cross-tab sync (BroadcastChannel)</li>
				<li>✅ Large storage capacity (~GB)</li>
				<li>✅ Asynchronous API</li>
				<li>✅ Rich data types</li>
			</ul>
		</div>
		<div class="card">
			<h3>Memory</h3>
			<ul class="text-sm">
				<li>⚠️ Lost on page reload</li>
				<li>❌ No cross-tab sync</li>
				<li>✅ No storage limit (RAM-based)</li>
				<li>✅ Fastest access (synchronous)</li>
				<li>✅ Rich data types (native JS)</li>
			</ul>
		</div>
	</div>
</div>

<div class="card">
	<h3>Live Storage Comparison</h3>
	<p class="text-sm text-gray-600 mb-4">
		Three identical caches using different storage backends. Changes to one won't affect others.
	</p>

	<div class="flex gap-2 mb-4">
		<button class="btn" onclick={populateAllCaches}> Populate All Caches </button>
		<button class="btn btn-secondary" onclick={clearAllCaches}> Clear All Caches </button>
	</div>

	<div class="grid grid-cols-2 md:grid-cols-4">
		<div class="card">
			<h4>localStorage Cache</h4>
			<div class="mb-4">
				<span class="status" class:status-loading={localStorageCache.loading}>
					{localStorageCache.loading ? 'Loading' : 'Loaded'}
				</span>
			</div>

			{#if localStorageCache.value?.current}
				<div class="text-sm mb-4">
					<strong>Records:</strong>
					{localStorageCache.value.current.length}
					<br />
					<strong>Updated:</strong>
					{localStorageCache.updateTime.toLocaleTimeString()}
				</div>

				<ul class="text-xs">
					{#each localStorageCache.value.current.slice(0, 3) as user (user.id)}
						<li>{user.name}</li>
					{/each}
					{#if localStorageCache.value.current.length > 3}
						<li class="text-gray-500">...and {localStorageCache.value.current.length - 3} more</li>
					{/if}
				</ul>
			{:else}
				<p class="text-gray-500 text-sm">No data</p>
			{/if}

			<button class="btn mt-4" onclick={() => localStorageCache.refresh()}>
				Refresh from Server
			</button>
		</div>

		<div class="card">
			<h4>sessionStorage Cache</h4>
			<div class="mb-4">
				<span class="status" class:status-loading={sessionStorageCache.loading}>
					{sessionStorageCache.loading ? 'Loading' : 'Loaded'}
				</span>
			</div>

			{#if sessionStorageCache.value?.current}
				<div class="text-sm mb-4">
					<strong>Records:</strong>
					{sessionStorageCache.value.current.length}
					<br />
					<strong>Updated:</strong>
					{sessionStorageCache.updateTime.toLocaleTimeString()}
				</div>

				<ul class="text-xs">
					{#each sessionStorageCache.value.current.slice(0, 3) as user (user.id)}
						<li>{user.name}</li>
					{/each}
					{#if sessionStorageCache.value.current.length > 3}
						<li class="text-gray-500">
							...and {sessionStorageCache.value.current.length - 3} more
						</li>
					{/if}
				</ul>
			{:else}
				<p class="text-gray-500 text-sm">No data</p>
			{/if}

			<button class="btn mt-4" onclick={() => sessionStorageCache.refresh()}>
				Refresh from Server
			</button>
		</div>

		<div class="card">
			<h4>IndexedDB Cache</h4>
			<div class="mb-4">
				<span class="status" class:status-loading={indexedDBCache.loading}>
					{indexedDBCache.loading ? 'Loading' : 'Loaded'}
				</span>
			</div>

			{#if indexedDBCache.value?.current}
				<div class="text-sm mb-4">
					<strong>Records:</strong>
					{indexedDBCache.value.current.length}
					<br />
					<strong>Updated:</strong>
					{indexedDBCache.updateTime.toLocaleTimeString()}
				</div>

				<ul class="text-xs">
					{#each indexedDBCache.value.current.slice(0, 3) as user (user.id)}
						<li>{user.name}</li>
					{/each}
					{#if indexedDBCache.value.current.length > 3}
						<li class="text-gray-500">...and {indexedDBCache.value.current.length - 3} more</li>
					{/if}
				</ul>
			{:else}
				<p class="text-gray-500 text-sm">No data</p>
			{/if}

			<button class="btn mt-4" onclick={() => indexedDBCache.refresh()}>
				Refresh from Server
			</button>
		</div>

		<div class="card">
			<h4>Memory Cache</h4>
			<div class="mb-4">
				<span class="status" class:status-loading={memoryCache.loading}>
					{memoryCache.loading ? 'Loading' : 'Loaded'}
				</span>
			</div>

			{#if memoryCache.value?.current}
				<div class="text-sm mb-4">
					<strong>Records:</strong>
					{memoryCache.value.current.length}
					<br />
					<strong>Updated:</strong>
					{memoryCache.updateTime.toLocaleTimeString()}
				</div>

				<ul class="text-xs">
					{#each memoryCache.value.current.slice(0, 3) as user (user.id)}
						<li>{user.name}</li>
					{/each}
					{#if memoryCache.value.current.length > 3}
						<li class="text-gray-500">...and {memoryCache.value.current.length - 3} more</li>
					{/if}
				</ul>
			{:else}
				<p class="text-gray-500 text-sm">No data</p>
			{/if}

			<button class="btn mt-4" onclick={() => memoryCache.refresh()}> Refresh from Server </button>
		</div>
	</div>
</div>

<div class="card">
	<h3>Performance Test</h3>
	<p class="text-sm text-gray-600 mb-4">
		Test write and read performance with 1000 user records across different storage types.
	</p>

	<button class="btn mb-4" onclick={runPerformanceTest} disabled={isRunningTest}>
		{isRunningTest ? 'Running Test...' : 'Run Performance Test'}
	</button>

	{#if performanceData.length > 0}
		<div class="card">
			<h4>Performance Results</h4>
			<table style="width: 100%; border-collapse: collapse;">
				<thead>
					<tr style="border-bottom: 1px solid #e2e8f0;">
						<th style="text-align: left; padding: 0.5rem;">Storage Type</th>
						<th style="text-align: left; padding: 0.5rem;">Write Time (ms)</th>
						<th style="text-align: left; padding: 0.5rem;">Read Time (ms)</th>
						<th style="text-align: left; padding: 0.5rem;">Data Size (bytes)</th>
					</tr>
				</thead>
				<tbody>
					{#each performanceData as result (result.storage)}
						<tr style="border-bottom: 1px solid #f1f5f9;">
							<td style="padding: 0.5rem; font-weight: 500;">{result.storage}</td>
							<td style="padding: 0.5rem;">{result.writeTime}</td>
							<td style="padding: 0.5rem;">{result.readTime}</td>
							<td style="padding: 0.5rem;">{result.dataSize.toLocaleString()}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<div class="card">
	<h3>Storage Inspection</h3>
	<p class="text-sm text-gray-600 mb-4">
		Open your browser's Developer Tools to inspect the stored data:
	</p>
	<ul class="text-sm">
		<li><strong>localStorage:</strong> Application → Storage → Local Storage</li>
		<li><strong>sessionStorage:</strong> Application → Storage → Session Storage</li>
		<li><strong>IndexedDB:</strong> Application → Storage → IndexedDB → CustomPersistedState</li>
		<li>
			<strong>Memory:</strong> Data exists only in JavaScript memory (not visible in DevTools storage)
		</li>
	</ul>
</div>
