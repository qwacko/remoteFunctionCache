<script>
	import { remoteFunctionCache } from '../../lib/index.js';
	import { searchPosts, getUsers } from '../data.remote.js';

	let searchQuery = $state('');

	// Demonstrate the new architecture with different storage types
	const searchCache = remoteFunctionCache(searchPosts, () => searchQuery.trim() || undefined, {
		key: 'search-demo',
		storage: 'indexeddb',
		syncTabs: true,
		timeoutMinutes: 10
	});

	// Show different storage providers working together
	const usersLocalCache = remoteFunctionCache(getUsers, () => undefined, {
		key: 'users-local',
		storage: 'local',
		syncTabs: true,
		timeoutMinutes: 15
	});

	const usersSessionCache = remoteFunctionCache(getUsers, () => undefined, {
		key: 'users-session',
		storage: 'session',
		syncTabs: false, // sessionStorage doesn't sync across tabs
		timeoutMinutes: 5
	});

	const usersIndexedDBCache = remoteFunctionCache(getUsers, () => undefined, {
		key: 'users-indexeddb',
		storage: 'indexeddb',
		syncTabs: true,
		timeoutMinutes: 20
	});
</script>

<h1>New Architecture Demo</h1>

<div class="card">
	<h2>✨ Clean Architecture with Storage Providers</h2>
	<p>
		The library now uses a clean architecture with dependency injection and dedicated storage
		providers. This makes it easier to debug, test, and extend with new storage types.
	</p>

	<div class="grid grid-cols-3">
		<div class="card">
			<h4>🗄️ Storage Providers</h4>
			<ul class="text-sm">
				<li><strong>LocalStorageProvider:</strong> Persistent, cross-tab sync</li>
				<li><strong>SessionStorageProvider:</strong> Session-only, no sync</li>
				<li><strong>IndexedDBStorageProvider:</strong> Async, large data, cross-tab sync</li>
			</ul>
		</div>
		<div class="card">
			<h4>🏗️ Clean Separation</h4>
			<ul class="text-sm">
				<li>Storage logic isolated</li>
				<li>Easy to add new providers</li>
				<li>Better error handling</li>
				<li>Testable components</li>
			</ul>
		</div>
		<div class="card">
			<h4>🐛 Better Debugging</h4>
			<ul class="text-sm">
				<li>Storage issues isolated</li>
				<li>Clear loading states</li>
				<li>Async handling improved</li>
				<li>Provider-specific logs</li>
			</ul>
		</div>
	</div>
</div>

<div class="card">
	<h2>Search Demo (IndexedDB Storage)</h2>
	<div class="form-group">
		<input bind:value={searchQuery} placeholder="Search posts..." class="text-lg" />
	</div>
	<p class="text-sm text-gray-600 mb-4">
		Using IndexedDB storage with cross-tab synchronization. Try searching for the same term multiple
		times.
	</p>

	<div class="mb-4">
		<strong>Loading:</strong>
		{searchCache.loading ? 'Yes' : 'No'}<br />
		<strong>Refreshing:</strong>
		{searchCache.refreshing ? 'Yes' : 'No'}<br />
		<strong>Error:</strong>
		{searchCache.error ? searchCache.error.message : 'None'}<br />
		<strong>Last Updated:</strong>
		{searchCache.updateTime.toLocaleTimeString()}
	</div>

	{#if searchQuery.trim() && !searchCache.loading}
		{#if searchCache.error}
			<div class="status status-error">
				Error: {searchCache.error.message}
			</div>
		{:else if searchCache.value?.current}
			<div class="grid">
				{#each searchCache.value.current as post}
					<div class="card">
						<h4>{post.title}</h4>
						<p class="text-sm">{post.content}</p>
						<span class="text-xs text-gray-500">❤️ {post.likes} likes</span>
					</div>
				{:else}
					<p class="text-gray-600">No posts found matching "{searchQuery}"</p>
				{/each}
			</div>
		{/if}
	{/if}

	<button class="btn mt-4" onclick={() => searchCache.refresh()}>Force Refresh</button>
</div>

<div class="card">
	<h2>Storage Provider Comparison</h2>
	<p class="text-sm text-gray-600 mb-4">
		Same data cached using different storage providers. Notice how they behave differently.
	</p>

	<div class="grid grid-cols-3">
		<div class="card">
			<h4>localStorage</h4>
			<div class="text-xs text-gray-600 mb-2">Persistent, cross-tab sync, 15min timeout</div>

			<div class="mb-4">
				<span class="status" class:status-loading={usersLocalCache.loading}>
					{usersLocalCache.loading ? 'Loading' : 'Loaded'}
				</span>
				<button class="btn btn-secondary ml-2" onclick={() => usersLocalCache.refresh()}>
					Refresh
				</button>
			</div>

			{#if usersLocalCache.value?.current}
				<div class="text-sm">
					<strong>Users:</strong>
					{usersLocalCache.value.current.length}<br />
					<strong>Updated:</strong>
					{usersLocalCache.updateTime.toLocaleTimeString()}
				</div>
			{/if}
		</div>

		<div class="card">
			<h4>sessionStorage</h4>
			<div class="text-xs text-gray-600 mb-2">Session-only, no sync, 5min timeout</div>

			<div class="mb-4">
				<span class="status" class:status-loading={usersSessionCache.loading}>
					{usersSessionCache.loading ? 'Loading' : 'Loaded'}
				</span>
				<button class="btn btn-secondary ml-2" onclick={() => usersSessionCache.refresh()}>
					Refresh
				</button>
			</div>

			{#if usersSessionCache.value?.current}
				<div class="text-sm">
					<strong>Users:</strong>
					{usersSessionCache.value.current.length}<br />
					<strong>Updated:</strong>
					{usersSessionCache.updateTime.toLocaleTimeString()}
				</div>
			{/if}
		</div>

		<div class="card">
			<h4>IndexedDB</h4>
			<div class="text-xs text-gray-600 mb-2">Async, large data, cross-tab sync, 20min timeout</div>

			<div class="mb-4">
				<span class="status" class:status-loading={usersIndexedDBCache.loading}>
					{usersIndexedDBCache.loading ? 'Loading' : 'Loaded'}
				</span>
				<button class="btn btn-secondary ml-2" onclick={() => usersIndexedDBCache.refresh()}>
					Refresh
				</button>
			</div>

			{#if usersIndexedDBCache.value?.current}
				<div class="text-sm">
					<strong>Users:</strong>
					{usersIndexedDBCache.value.current.length}<br />
					<strong>Updated:</strong>
					{usersIndexedDBCache.updateTime.toLocaleTimeString()}
				</div>
			{/if}
		</div>
	</div>
</div>

<div class="card">
	<h2>Key Benefits Achieved</h2>
	<div class="grid grid-cols-2">
		<div class="card">
			<h4>🔧 Developer Experience</h4>
			<ul class="text-sm">
				<li>
					<strong>Better debugging:</strong> Storage issues are isolated to specific providers
				</li>
				<li><strong>Cleaner code:</strong> Separation of concerns makes logic easier to follow</li>
				<li><strong>Easy testing:</strong> Each storage provider can be tested independently</li>
				<li><strong>Predictable behavior:</strong> Storage-specific logic is encapsulated</li>
			</ul>
		</div>

		<div class="card">
			<h4>🚀 Performance & Reliability</h4>
			<ul class="text-sm">
				<li><strong>Fixed IndexedDB loading:</strong> Async loading states properly managed</li>
				<li><strong>Optimized caching:</strong> Storage providers handle their own optimization</li>
				<li><strong>Better error handling:</strong> Storage-specific error messages</li>
				<li><strong>Consistent API:</strong> Same interface for all storage types</li>
			</ul>
		</div>
	</div>
</div>
