# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

### Development
- `pnpm dev` - Start development server with hot reload
- `pnpm build` - Build library for production and run prepack
- `pnpm preview` - Preview production build

### Code Quality
- `pnpm check` - Run Svelte type checking
- `pnpm check:watch` - Run type checking in watch mode
- `pnpm lint` - Check formatting and linting (Prettier + ESLint)
- `pnpm format` - Format code with Prettier

### Testing
- `pnpm test` - Run all tests once
- `pnpm test:watch` - Run tests in watch mode

### Packaging
- `pnpm prepack` - Prepare package for distribution (sync + package + publint)

## Architecture

This is a SvelteKit library that provides intelligent caching for remote functions. The architecture follows a modular design with dependency injection.

### Core Components

**Main API (`src/lib/remoteFunctionCache/remoteFunctionCache.svelte.ts`)**
- Primary entry point that creates cached versions of SvelteKit remote functions
- Integrates with SvelteKit's reactive system using `$effect` and `$derived`
- Handles automatic synchronization with SvelteKit invalidations when `autoSync: true`
- Uses `devalue` for serialization to handle complex objects and circular references

**State Management (`src/lib/remoteFunctionCache/CustomPersistedState.svelte.ts`)**
- Reactive state container using Svelte 5's `$state` runes
- Implements same-tab synchronization through a global registry (`SvelteMap`/`SvelteSet`)
- Handles cross-tab synchronization via storage provider events
- Efficient equality checking for optimal reactivity

**Storage System (`src/lib/remoteFunctionCache/storage/`)**
- Factory pattern (`StorageFactory.ts`) for creating storage providers
- Four storage backends: localStorage, sessionStorage, IndexedDB, memory
- Each provider implements the `StorageProvider` interface with optional cross-tab sync
- IndexedDB provider uses `BroadcastChannel` for cross-tab communication

### Key Features

**SvelteKit Integration**
- Requires `remoteFunctions: true` in svelte.config.js
- Auto-syncs with SvelteKit's built-in invalidation system
- Monitors remote function changes through reactive derivations

**Caching Strategy**
- Key-based caching with function name + serialized arguments
- Configurable expiration via `timeoutMinutes`
- Automatic cache invalidation and refresh capabilities

**Cross-tab Synchronization**
- Supported by localStorage and IndexedDB storage types
- sessionStorage automatically upgrades to localStorage when `syncTabs: true`
- Memory storage does not support cross-tab sync

## Important Implementation Notes

- Uses Svelte 5 runes (`$state`, `$effect`, `$derived`) throughout
- SvelteKit remote functions must be imported from `.remote.js` files
- The library handles `undefined` arguments gracefully for functions that don't require parameters
- Debug logging is available via the `debug: true` option
- Storage providers use async loading patterns, especially IndexedDB

## File Structure

- `src/lib/index.ts` - Main exports
- `src/lib/remoteFunctionCache/` - Core library code
- `src/routes/` - Demo pages and examples
- Tests use Vitest with browser mode and jsdom