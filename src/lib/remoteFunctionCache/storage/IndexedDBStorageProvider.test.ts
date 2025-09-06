import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { IndexedDBStorageProvider } from './IndexedDBStorageProvider.js';

// Mock IndexedDB
const mockRequest = {
	result: undefined as any,
	error: null,
	onsuccess: null as ((this: IDBRequest) => void) | null,
	onerror: null as ((this: IDBRequest) => void) | null,
	readyState: 'pending' as IDBRequestReadyState,
	source: null,
	transaction: null
};

const mockStore = {
	get: vi.fn(() => ({ ...mockRequest })),
	put: vi.fn(() => ({ ...mockRequest })),
	delete: vi.fn(() => ({ ...mockRequest }))
};

const mockTransaction = {
	objectStore: vi.fn(() => mockStore)
};

const mockDatabase = {
	transaction: vi.fn(() => mockTransaction),
	objectStoreNames: {
		contains: vi.fn(() => true)
	},
	createObjectStore: vi.fn()
};

const mockOpenRequest = {
	result: mockDatabase,
	error: null,
	onsuccess: null as ((this: IDBOpenDBRequest) => void) | null,
	onerror: null as ((this: IDBOpenDBRequest) => void) | null,
	onupgradeneeded: null as ((this: IDBVersionChangeEvent) => void) | null,
	readyState: 'pending' as IDBRequestReadyState,
	source: null,
	transaction: null
};

const mockIndexedDB = {
	open: vi.fn(() => mockOpenRequest)
};

// Mock BroadcastChannel
const mockBroadcastChannel = {
	postMessage: vi.fn(),
	close: vi.fn(),
	onmessage: null as ((event: MessageEvent) => void) | null
};

Object.defineProperty(globalThis, 'indexedDB', {
	value: mockIndexedDB,
	writable: true
});

Object.defineProperty(globalThis, 'BroadcastChannel', {
	value: vi.fn(() => mockBroadcastChannel),
	writable: true
});

describe('IndexedDBStorageProvider', () => {
	let provider: IndexedDBStorageProvider<string>;

	beforeEach(() => {
		vi.clearAllMocks();
		provider = new IndexedDBStorageProvider({});
		
		// Reset mock request state
		mockRequest.result = undefined;
		mockRequest.error = null;
		mockRequest.onsuccess = null;
		mockRequest.onerror = null;
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('get', () => {
		it('should return null when no data exists', async () => {
			// Setup: simulate successful DB open
			setTimeout(() => {
				if (mockOpenRequest.onsuccess) {
					mockOpenRequest.onsuccess.call(mockOpenRequest);
				}
			}, 0);

			// Setup: simulate get request returning undefined (no data)
			const getRequest = { ...mockRequest };
			mockStore.get.mockReturnValue(getRequest);

			setTimeout(() => {
				getRequest.result = undefined;
				if (getRequest.onsuccess) {
					getRequest.onsuccess.call(getRequest);
				}
			}, 0);

			const result = await provider.get('test-key');
			expect(result).toBeNull();
			expect(mockStore.get).toHaveBeenCalledWith('test-key');
		});

		it('should return stored data when valid', async () => {
			const storedData = {
				value: 'test value',
				timestamp: Date.now()
			};

			// Setup: simulate successful DB open
			setTimeout(() => {
				if (mockOpenRequest.onsuccess) {
					mockOpenRequest.onsuccess.call(mockOpenRequest);
				}
			}, 0);

			// Setup: simulate get request returning stored data
			const getRequest = { ...mockRequest };
			mockStore.get.mockReturnValue(getRequest);

			setTimeout(() => {
				getRequest.result = JSON.stringify(storedData);
				if (getRequest.onsuccess) {
					getRequest.onsuccess.call(getRequest);
				}
			}, 0);

			const result = await provider.get('test-key');
			expect(result).toBe('test value');
		});

		it('should return null when data is expired', async () => {
			provider = new IndexedDBStorageProvider({ timeoutMinutes: 1 });
			const expiredData = {
				value: 'test value',
				timestamp: Date.now() - (2 * 60 * 1000) // 2 minutes ago
			};

			// Setup: simulate successful DB open
			setTimeout(() => {
				if (mockOpenRequest.onsuccess) {
					mockOpenRequest.onsuccess.call(mockOpenRequest);
				}
			}, 0);

			// Setup: simulate get request returning expired data
			const getRequest = { ...mockRequest };
			mockStore.get.mockReturnValue(getRequest);

			setTimeout(() => {
				getRequest.result = JSON.stringify(expiredData);
				if (getRequest.onsuccess) {
					getRequest.onsuccess.call(getRequest);
				}
			}, 0);

			const result = await provider.get('test-key');
			expect(result).toBeNull();
		});

		it('should handle database errors gracefully', async () => {
			// Setup: simulate DB open error
			setTimeout(() => {
				mockOpenRequest.error = new Error('DB Error');
				if (mockOpenRequest.onerror) {
					mockOpenRequest.onerror.call(mockOpenRequest);
				}
			}, 0);

			const result = await provider.get('test-key');
			expect(result).toBeNull();
		});
	});

	describe('set', () => {
		it('should store data with timestamp', async () => {
			// Setup: simulate successful DB open
			setTimeout(() => {
				if (mockOpenRequest.onsuccess) {
					mockOpenRequest.onsuccess.call(mockOpenRequest);
				}
			}, 0);

			// Setup: simulate successful put operation
			const putRequest = { ...mockRequest };
			mockStore.put.mockReturnValue(putRequest);

			setTimeout(() => {
				if (putRequest.onsuccess) {
					putRequest.onsuccess.call(putRequest);
				}
			}, 0);

			await provider.set('test-key', 'test value');

			expect(mockStore.put).toHaveBeenCalled();
			const [serializedData, key] = mockStore.put.mock.calls[0];
			expect(key).toBe('test-key');
			
			const storedData = JSON.parse(serializedData);
			expect(storedData.value).toBe('test value');
			expect(storedData.timestamp).toBeTypeOf('number');
		});

		it('should broadcast changes when BroadcastChannel is available', async () => {
			// Setup cross-tab sync first
			const cleanup = provider.setupSync('test-key', () => {});

			// Setup: simulate successful DB open
			setTimeout(() => {
				if (mockOpenRequest.onsuccess) {
					mockOpenRequest.onsuccess.call(mockOpenRequest);
				}
			}, 0);

			// Setup: simulate successful put operation
			const putRequest = { ...mockRequest };
			mockStore.put.mockReturnValue(putRequest);

			setTimeout(() => {
				if (putRequest.onsuccess) {
					putRequest.onsuccess.call(putRequest);
				}
			}, 0);

			await provider.set('test-key', 'test value');

			expect(mockBroadcastChannel.postMessage).toHaveBeenCalled();
			
			cleanup();
		});
	});

	describe('remove', () => {
		it('should remove item from IndexedDB', async () => {
			// Setup: simulate successful DB open
			setTimeout(() => {
				if (mockOpenRequest.onsuccess) {
					mockOpenRequest.onsuccess.call(mockOpenRequest);
				}
			}, 0);

			// Setup: simulate successful delete operation
			const deleteRequest = { ...mockRequest };
			mockStore.delete.mockReturnValue(deleteRequest);

			setTimeout(() => {
				if (deleteRequest.onsuccess) {
					deleteRequest.onsuccess.call(deleteRequest);
				}
			}, 0);

			await provider.remove('test-key');

			expect(mockStore.delete).toHaveBeenCalledWith('test-key');
		});
	});

	describe('isLoading', () => {
		it('should return loading state', () => {
			expect(provider.isLoading()).toBe(false);
		});
	});

	describe('setupSync', () => {
		it('should setup BroadcastChannel for cross-tab sync', () => {
			const callback = vi.fn();
			const cleanup = provider.setupSync('test-key', callback);

			expect(globalThis.BroadcastChannel).toHaveBeenCalledWith('CustomPersistedState-test-key');
			expect(mockBroadcastChannel.onmessage).toBeDefined();

			cleanup();
			expect(mockBroadcastChannel.close).toHaveBeenCalled();
		});

		it('should handle sync messages correctly', () => {
			const callback = vi.fn();
			provider.setupSync('test-key', callback);

			const syncData = {
				value: 'synced value',
				timestamp: Date.now()
			};

			// Simulate receiving a broadcast message
			const event = {
				data: {
					key: 'test-key',
					value: JSON.stringify(syncData)
				}
			} as MessageEvent;

			if (mockBroadcastChannel.onmessage) {
				mockBroadcastChannel.onmessage(event);
			}

			expect(callback).toHaveBeenCalledWith('synced value');
		});
	});
});