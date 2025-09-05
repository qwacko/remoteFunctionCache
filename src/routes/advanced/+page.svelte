<script>
	import { remoteFunctionCache } from '../../lib/index.js';
	import { searchPosts, getUsers } from '../data.remote.js';
	
	let searchQuery = $state('');
	let enableSync = $state(true);
	let storage1Type = $state('local');
	let storage2Type = $state('indexeddb');

	// Search cache with debouncing
	const searchCache = remoteFunctionCache(
		searchPosts, 
		() => searchQuery.trim() || undefined,
		{
			key: 'search-results',
			storage: 'indexeddb',
			syncTabs: true,
			timeoutMinutes: 10
		}
	);

	// Dual storage demo - same function, different storage
	const usersLocalCache = remoteFunctionCache(getUsers, () => undefined, {
		key: 'users-cache',
		storage: 'local',
		syncTabs: true,
		timeoutMinutes: 15
	});

	const usersIndexedDBCache = remoteFunctionCache(getUsers, () => undefined, {
		key: 'users-cache-idb',
		storage: 'indexeddb',
		syncTabs: true,
		timeoutMinutes: 15
	});

	// Multiple instances of same function with different keys
	const usersCacheInstance1 = remoteFunctionCache(getUsers, () => undefined, {
		key: 'users-instance-1',
		storage: 'local',
		syncTabs: true,
		timeoutMinutes: 5
	});

	const usersCacheInstance2 = remoteFunctionCache(getUsers, () => undefined, {
		key: 'users-instance-2',
		storage: 'local',
		syncTabs: true,
		timeoutMinutes: 5
	});

	// Manual cache management functions
	const clearSearchCache = () => {
		searchCache.setValue([]);
	};

	const setCustomData = () => {
		usersLocalCache.setValue([
			{ id: 999, name: 'Custom User', email: 'custom@example.com' }
		]);
	};
</script>

<h1>Advanced Features</h1>

<div class="card">
	<h2>Cross-tab Synchronization</h2>
	<p>
		Open this page in multiple browser tabs to see real-time synchronization in action. 
		Changes made in one tab will automatically appear in other tabs.
	</p>
	<div class="form-group">
		<label>
			<input type="checkbox" bind:checked={enableSync} />
			Enable Cross-tab Sync
		</label>
	</div>
</div>

<div class="card">
	<h3>Reactive Search Cache</h3>
	<p class="text-sm text-gray-600 mb-4">
		Type to search posts. Results are cached and the cache key changes with your query.
	</p>
	
	<div class="form-group">
		<input 
			bind:value={searchQuery}
			placeholder="Search posts..."
			class="text-lg"
		/>
	</div>

	<div class="flex items-center gap-4 mb-4">
		<span class="status" class:status-loading={searchCache.loading}>
			{searchCache.loading ? 'Searching...' : 'Ready'}
		</span>
		<span class="text-sm text-gray-600">
			Query: "{searchQuery || '(empty)'}"
		</span>
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

	<button class="btn mt-4" onclick={clearSearchCache}>
		Clear Search Cache
	</button>
</div>

<div class="card">
	<h3>Storage Type Comparison</h3>
	<p class="text-sm text-gray-600 mb-4">
		Same function cached in different storage types. Notice how they maintain independent state.
	</p>

	<div class="grid grid-cols-2">
		<div class="card">
			<h4>Storage Type 1</h4>
			<select bind:value={storage1Type} class="mb-4">
				<option value="local">localStorage</option>
				<option value="session">sessionStorage</option>
				<option value="indexeddb">IndexedDB</option>
			</select>

			<div class="flex items-center gap-2 mb-4">
				<span class="status" class:status-loading={usersLocalCache.loading}>
					{usersLocalCache.loading ? 'Loading' : 'Loaded'}
				</span>
				<button class="btn btn-secondary" onclick={() => usersLocalCache.refresh()}>
					Refresh
				</button>
			</div>

			{#if usersLocalCache.value?.current}
				<div class="text-sm">
					<strong>Users:</strong> {usersLocalCache.value.current.length}
					<br>
					<strong>Updated:</strong> {usersLocalCache.updateTime.toLocaleTimeString()}
				</div>
			{/if}
		</div>

		<div class="card">
			<h4>Storage Type 2</h4>
			<select bind:value={storage2Type} class="mb-4">
				<option value="local">localStorage</option>
				<option value="session">sessionStorage</option>
				<option value="indexeddb">IndexedDB</option>
			</select>

			<div class="flex items-center gap-2 mb-4">
				<span class="status" class:status-loading={usersIndexedDBCache.loading}>
					{usersIndexedDBCache.loading ? 'Loading' : 'Loaded'}
				</span>
				<button class="btn btn-secondary" onclick={() => usersIndexedDBCache.refresh()}>
					Refresh
				</button>
			</div>

			{#if usersIndexedDBCache.value?.current}
				<div class="text-sm">
					<strong>Users:</strong> {usersIndexedDBCache.value.current.length}
					<br>
					<strong>Updated:</strong> {usersIndexedDBCache.updateTime.toLocaleTimeString()}
				</div>
			{/if}
		</div>
	</div>
</div>

<div class="card">
	<h3>Multiple Cache Instances</h3>
	<p class="text-sm text-gray-600 mb-4">
		Multiple cache instances of the same function with different keys. Changes to one affect the others through cross-tab sync.
	</p>

	<div class="grid grid-cols-2">
		<div class="card">
			<h4>Instance 1</h4>
			<div class="flex items-center gap-2 mb-4">
				<span class="status" class:status-loading={usersCacheInstance1.loading}>
					Instance 1: {usersCacheInstance1.loading ? 'Loading' : 'Loaded'}
				</span>
				<button class="btn" onclick={() => usersCacheInstance1.refresh()}>
					Refresh
				</button>
			</div>

			{#if usersCacheInstance1.value?.current}
				<ul class="text-sm">
					{#each usersCacheInstance1.value.current as user}
						<li>{user.name} - {user.email}</li>
					{/each}
				</ul>
				<div class="text-xs text-gray-500 mt-2">
					Last updated: {usersCacheInstance1.updateTime.toLocaleTimeString()}
				</div>
			{/if}
		</div>

		<div class="card">
			<h4>Instance 2</h4>
			<div class="flex items-center gap-2 mb-4">
				<span class="status" class:status-loading={usersCacheInstance2.loading}>
					Instance 2: {usersCacheInstance2.loading ? 'Loading' : 'Loaded'}
				</span>
				<button class="btn" onclick={() => usersCacheInstance2.refresh()}>
					Refresh
				</button>
			</div>

			{#if usersCacheInstance2.value?.current}
				<ul class="text-sm">
					{#each usersCacheInstance2.value.current as user}
						<li>{user.name} - {user.email}</li>
					{/each}
				</ul>
				<div class="text-xs text-gray-500 mt-2">
					Last updated: {usersCacheInstance2.updateTime.toLocaleTimeString()}
				</div>
			{/if}
		</div>
	</div>
</div>

<div class="card">
	<h3>Manual Cache Management</h3>
	<p class="text-sm text-gray-600 mb-4">
		Programmatically manipulate cache values without making network requests.
	</p>

	<div class="flex gap-2">
		<button class="btn" onclick={setCustomData}>
			Set Custom User Data
		</button>
		<button class="btn btn-secondary" onclick={() => usersLocalCache.refresh()}>
			Reset to Server Data
		</button>
		<button class="btn btn-danger" onclick={() => usersLocalCache.setValue([])}>
			Clear Cache
		</button>
	</div>
</div>