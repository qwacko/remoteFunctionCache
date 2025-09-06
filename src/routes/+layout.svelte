<script>
	import { page } from '$app/stores';
</script>

<nav>
	<h1>Remote Function Cache Demo</h1>
	<ul>
		<li><a href="/" class:active={$page.route.id === '/'}>Basic Usage</a></li>
		<li><a href="/advanced" class:active={$page.route.id === '/advanced'}>Advanced Features</a></li>
		<li>
			<a href="/storage-comparison" class:active={$page.route.id === '/storage-comparison'}
				>Storage Comparison</a
			>
		</li>
		<li><a href="/performance" class:active={$page.route.id === '/performance'}>Performance</a></li>
	</ul>
</nav>

<main>
	<slot />
</main>

<style>
	:global(body) {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		margin: 0;
		padding: 0;
		background: #f8fafc;
		color: #334155;
		line-height: 1.6;
	}

	:global(h1, h2, h3) {
		color: #1e293b;
		margin-top: 2rem;
		margin-bottom: 1rem;
	}

	:global(h1) {
		font-size: 2rem;
		font-weight: 700;
	}

	:global(h2) {
		font-size: 1.5rem;
		font-weight: 600;
	}

	:global(h3) {
		font-size: 1.25rem;
		font-weight: 500;
	}

	nav {
		background: #1e293b;
		color: white;
		padding: 1rem 2rem;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	nav h1 {
		margin: 0;
		font-size: 1.5rem;
		color: white;
	}

	nav ul {
		list-style: none;
		margin: 1rem 0 0 0;
		padding: 0;
		display: flex;
		gap: 2rem;
	}

	nav a {
		color: #94a3b8;
		text-decoration: none;
		transition: color 0.2s;
	}

	nav a:hover {
		color: white;
	}

	nav a.active {
		color: #60a5fa;
		font-weight: 500;
	}

	main {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
	}

	:global(.card) {
		background: white;
		border-radius: 8px;
		padding: 1.5rem;
		margin-bottom: 1.5rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		border: 1px solid #e2e8f0;
	}

	:global(.btn) {
		background: #3b82f6;
		color: white;
		border: none;
		padding: 0.5rem 1rem;
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.875rem;
		font-weight: 500;
		transition: all 0.2s;
		display: inline-block;
		text-decoration: none;
	}

	:global(.btn:hover) {
		background: #2563eb;
		transform: translateY(-1px);
	}

	:global(.btn:disabled) {
		background: #94a3b8;
		cursor: not-allowed;
		transform: none;
	}

	:global(.btn-secondary) {
		background: #6b7280;
	}

	:global(.btn-secondary:hover) {
		background: #4b5563;
	}

	:global(.btn-danger) {
		background: #ef4444;
	}

	:global(.btn-danger:hover) {
		background: #dc2626;
	}

	:global(.form-group) {
		margin-bottom: 1rem;
	}

	:global(label) {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
		color: #374151;
	}

	:global(input, textarea, select) {
		width: 100%;
		padding: 0.5rem;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		font-size: 0.875rem;
		transition:
			border-color 0.2s,
			box-shadow 0.2s;
	}

	:global(input:focus, textarea:focus, select:focus) {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	:global(.loading) {
		opacity: 0.6;
		position: relative;
	}

	:global(.loading::after) {
		content: '';
		position: absolute;
		top: 50%;
		left: 50%;
		width: 20px;
		height: 20px;
		margin: -10px 0 0 -10px;
		border: 2px solid #e5e7eb;
		border-top: 2px solid #3b82f6;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	:global(.status) {
		padding: 0.5rem 0.75rem;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	:global(.status-loading) {
		background: #fef3c7;
		color: #92400e;
	}

	:global(.status-refreshing) {
		background: #dbeafe;
		color: #1e40af;
	}

	:global(.status-error) {
		background: #fecaca;
		color: #b91c1c;
	}

	:global(.status-success) {
		background: #d1fae5;
		color: #065f46;
	}

	:global(.grid) {
		display: grid;
		gap: 1.5rem;
	}

	:global(.grid-cols-2) {
		grid-template-columns: repeat(2, 1fr);
	}

	:global(.grid-cols-3) {
		grid-template-columns: repeat(3, 1fr);
	}

	@media (max-width: 768px) {
		:global(.grid-cols-2),
		:global(.grid-cols-3) {
			grid-template-columns: 1fr;
		}
	}

	:global(.flex) {
		display: flex;
	}

	:global(.items-center) {
		align-items: center;
	}

	:global(.justify-between) {
		justify-content: space-between;
	}

	:global(.gap-2) {
		gap: 0.5rem;
	}

	:global(.gap-4) {
		gap: 1rem;
	}

	:global(.text-sm) {
		font-size: 0.875rem;
	}

	:global(.text-xs) {
		font-size: 0.75rem;
	}

	:global(.text-gray-500) {
		color: #6b7280;
	}

	:global(.text-gray-600) {
		color: #4b5563;
	}

	:global(.mb-4) {
		margin-bottom: 1rem;
	}

	:global(.mt-4) {
		margin-top: 1rem;
	}
</style>
