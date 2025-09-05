import { query, command, form } from '$app/server';
import * as v from 'valibot';

// Simulated database for demo purposes
const posts = [
	{ id: 1, title: 'Getting Started with SvelteKit', content: 'SvelteKit is amazing...', likes: 5 },
	{ id: 2, title: 'Remote Functions Explained', content: 'Remote functions allow...', likes: 12 },
	{ id: 3, title: 'Caching Best Practices', content: 'When building apps...', likes: 8 }
];

const users = [
	{ id: 1, name: 'Alice', email: 'alice@example.com' },
	{ id: 2, name: 'Bob', email: 'bob@example.com' },
	{ id: 3, name: 'Charlie', email: 'charlie@example.com' }
];

// Simple delay helper for demo
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Query: Get all posts
export const getPosts = query(async () => {
	await delay(500); // Simulate network delay
	return posts.map((p) => ({ id: p.id, title: p.title, likes: p.likes }));
});

// Query: Get single post by ID
export const getPost = query(v.number(), async (id) => {
	await delay(300);
	if (typeof id !== 'number') {
		throw new Error('Invalid post ID');
	}
	const post = posts.find((p) => p.id === id);
	if (!post) {
		throw new Error('Post not found');
	}
	return post;
});

// Query: Search posts
export const searchPosts = query(v.string(), async (query) => {
	await delay(400);
	if (typeof query !== 'string') {
		return [];
	}
	return posts.filter(
		(p) =>
			p.title.toLowerCase().includes(query.toLowerCase()) ||
			p.content.toLowerCase().includes(query.toLowerCase())
	);
});

// Query: Get users (with caching demo)
export const getUsers = query(async () => {
	await delay(800); // Longer delay to demonstrate caching benefits
	return users;
});

// Form: Add like to post (triggers SvelteKit auto-invalidation)
export const addLike = form(async (data) => {
	await delay(200);
	const postIdString = data.get('postId');
	
	if (!postIdString || typeof postIdString !== 'string') {
		throw new Error('Invalid post ID');
	}
	
	const postId = parseInt(postIdString, 10);
	if (isNaN(postId)) {
		throw new Error('Invalid post ID format');
	}
	
	const post = posts.find((p) => p.id === postId);
	if (post) {
		post.likes++;
		return { success: true, likes: post.likes, postId };
	}
	throw new Error('Post not found');
});

// Form: Create new post
export const createPost = form(async (data) => {
	await delay(600);
	const title = data.get('title');
	const content = data.get('content');

	if (typeof title !== 'string' || typeof content !== 'string') {
		throw new Error('Title and content are required');
	}

	const newPost = {
		id: posts.length + 1,
		title,
		content,
		likes: 0
	};

	posts.push(newPost);
	return { success: true, post: newPost };
});

// Query: Get random number (for testing refresh)
export const getRandomNumber = query(async () => {
	await delay(300);
	return Math.floor(Math.random() * 1000);
});

// Query: Get current time (for testing cache expiry)
export const getCurrentTime = query(async () => {
	await delay(200);
	return {
		timestamp: Date.now(),
		formatted: new Date().toLocaleString()
	};
});
