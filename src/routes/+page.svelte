<script lang="ts">
	import { remoteFunctionCache } from '../lib/index.js';
	import { getPosts, getPost, addLike, getCurrentTime, getRandomNumber } from './data.remote.js';

	let selectedPostId = $state(1);
	let cacheKey = $state('demo-posts');
	let timeoutMinutes = $state(5);
	let storageType = $state('local');

	// Basic cached posts query with auto-sync enabled
	const postsCache = remoteFunctionCache(getPosts, () => undefined, {
		key: 'posts-list',
		storage: 'local',
		timeoutMinutes: 10,
		autoSync: true, // ✨ Enable SvelteKit auto-invalidation sync
		debug: false // Set to true to enable debug logging
	});

	// Cached single post query with arguments and auto-sync
	const postCache = remoteFunctionCache(getPost, () => selectedPostId, {
		key: 'single-post',
		storage: 'local',
		timeoutMinutes: 10,
		autoSync: true, // ✨ Enable SvelteKit auto-invalidation sync
		debug: false // Set to true to enable debug logging
	});

	// Time cache for demonstrating expiry
	const timeCache = remoteFunctionCache(getCurrentTime, () => undefined, {
		key: 'current-time',
		timeoutMinutes: 1 // 1 minute expiry
	});

	// Random number for demonstrating refresh
	const randomCache = remoteFunctionCache(getRandomNumber, () => undefined, {
		key: 'random-number',
		timeoutMinutes: null // No expiry
	});

</script>

<h1>Remote Function Cache - Basic Usage</h1>

<div class="card">
	<h2>What is Remote Function Cache?</h2>
	<p>
		This library provides intelligent caching for SvelteKit's remote functions. It automatically:
	</p>
	<ul>
		<li>Caches function results in localStorage, sessionStorage, or IndexedDB</li>
		<li>Provides loading and error states</li>
		<li>Supports cache expiration</li>
		<li>Enables cross-tab synchronization</li>
		<li>Handles reactive argument changes</li>
		<li>
			🆕 <strong>Auto-syncs with SvelteKit mutations</strong> - when you update data via remote functions,
			all caches automatically refresh!
		</li>
		<li>
			🐛 <strong>Optional debug logging</strong> - set <code>debug: true</code> in cache options to see internal operations
		</li>
	</ul>

	<div class="card mt-4" style="background-color: #f0f9ff; border-left: 4px solid #0ea5e9;">
		<h4>🎉 Auto-Sync Demo</h4>
		<p class="text-sm">
			Try clicking the "Like" buttons below. Notice how <strong>both</strong> the posts list and
			single post automatically update without any manual refresh calls - that's SvelteKit's form
			auto-invalidation working with our cache system! The `addLike` function is a <code>form</code>
			action, which triggers automatic invalidation of all <code>query</code> functions.
		</p>
	</div>
</div>

<div class="grid grid-cols-2">
	<div class="card">
		<h3>Cache Configuration</h3>
		<div class="form-group">
			<label for="cache-key">Cache Key:</label>
			<input id="cache-key" bind:value={cacheKey} />
		</div>
		<div class="form-group">
			<label for="storage-type">Storage Type:</label>
			<select id="storage-type" bind:value={storageType}>
				<option value="local">localStorage</option>
				<option value="session">sessionStorage</option>
				<option value="indexeddb">IndexedDB</option>
			</select>
		</div>
		<div class="form-group">
			<label for="timeout">Timeout (minutes):</label>
			<input id="timeout" type="number" bind:value={timeoutMinutes} min="1" />
		</div>
	</div>

	<div class="card">
		<h3>Cache Status</h3>
		<div class="flex items-center gap-4 mb-4">
			<span class="status" class:status-loading={postsCache.loading}>
				Posts: {postsCache.loading ? 'Loading' : 'Loaded'}
			</span>
			<span class="status" class:status-refreshing={postsCache.refreshing && !postsCache.loading}>
				{postsCache.refreshing && !postsCache.loading ? 'Refreshing' : 'Idle'}
			</span>
			{#if postsCache.autoSync}
				<span class="status" style="background-color: #10b981; color: white;"> Auto-Sync ✓ </span>
			{/if}
		</div>
		<div class="text-sm text-gray-600">
			<strong>Last updated:</strong>
			{postsCache.updateTime.toLocaleTimeString()}<br />
			<strong>Auto-sync:</strong>
			{postsCache.autoSync ? 'Enabled - automatically syncs with SvelteKit mutations' : 'Disabled'}
		</div>
		<button class="btn mt-4" onclick={() => postsCache.refresh()}> Force Refresh Posts </button>
	</div>
</div>

<div class="card">
	<h3>Cached Posts List</h3>
	{#if postsCache.loading}
		<div class="loading" style="height: 100px;">Loading posts...</div>
	{:else if postsCache.error}
		<div class="status status-error">
			Error: {postsCache.error.message}
		</div>
	{:else if postsCache.value?.current}
		<div class="grid">
			{#each postsCache.value.current as post}
				<div class="card">
					<h4>{post.title}</h4>
					<div class="flex justify-between items-center">
						<span class="text-sm text-gray-600">❤️ {post.likes} likes</span>
						<div class="flex gap-2">
							<button class="btn" onclick={() => (selectedPostId = post.id)}> Select </button>
							<form {...addLike} style="display: inline;">
								<input type="hidden" name="postId" value={post.id} />
								<button class="btn btn-secondary" type="submit"> Like </button>
							</form>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<div class="card">
	<h3>Single Post Cache (ID: {selectedPostId})</h3>
	<div class="mb-4">
		<label for="post-select">Select Post ID:</label>
		<select id="post-select" bind:value={selectedPostId}>
			<option value={1}>Post 1</option>
			<option value={2}>Post 2</option>
			<option value={3}>Post 3</option>
		</select>
	</div>

	{#if postCache.loading}
		<div class="loading" style="height: 80px;">Loading post...</div>
	{:else if postCache.error}
		<div class="status status-error">
			Error: {postCache.error.message}
		</div>
	{:else if postCache.value?.current}
		<div class="card">
			<h4>{postCache.value.current.title}</h4>
			<p>{postCache.value.current.content}</p>
			<div class="flex justify-between items-center">
				<span class="text-sm text-gray-600">❤️ {postCache.value.current.likes} likes</span>
				<div class="flex gap-2">
					<button class="btn" onclick={() => postCache.refresh()}> Refresh </button>
					<form {...addLike} style="display: inline;">
						<input type="hidden" name="postId" value={postCache.value.current.id} />
						<button class="btn btn-secondary" type="submit"> Like </button>
					</form>
				</div>
			</div>
		</div>
	{/if}
</div>

<div class="grid grid-cols-2">
	<div class="card">
		<h3>Auto-Expiring Cache (1 minute)</h3>
		<p class="text-sm text-gray-600 mb-4">
			This cache automatically expires after 1 minute to demonstrate timeout functionality.
		</p>

		{#if timeCache.loading}
			<div class="loading" style="height: 60px;">Loading time...</div>
		{:else if timeCache.value?.current}
			<div>
				<strong>Cached Time:</strong><br />
				{timeCache.value.current.formatted}
			</div>
			<button class="btn mt-4" onclick={() => timeCache.refresh()}> Refresh Time </button>
		{/if}
	</div>

	<div class="card">
		<h3>Manual Refresh Demo</h3>
		<p class="text-sm text-gray-600 mb-4">
			This random number is cached indefinitely until manually refreshed.
		</p>

		{#if randomCache.loading}
			<div class="loading" style="height: 60px;">Loading...</div>
		{:else if randomCache.value?.current}
			<div class="text-2xl font-bold mb-4">
				{randomCache.value.current}
			</div>
			<button class="btn" onclick={() => randomCache.refresh()}> Get New Random Number </button>
		{/if}
	</div>
</div>
