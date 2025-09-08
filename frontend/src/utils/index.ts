import { type Note } from '../types';

export const sortNotes = (arr: Note[]): Note[] =>
	[...arr].sort((a, b) => {
		const au = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
		const bu = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
		if (bu !== au) return bu - au;
		const ac = a.createdAt ? new Date(a.createdAt).getTime() : 0;
		const bc = b.createdAt ? new Date(b.createdAt).getTime() : 0;
		return bc - ac;
	});

export const upsertNote = (list: Note[], item: Note): Note[] => {
	const idx = list.findIndex((n) => n.id === item.id);
	if (idx === -1) return sortNotes([item, ...list]);
	const next = list.slice();
	next[idx] = { ...next[idx], ...item };
	return sortNotes(next);
};

export const ensureArray = <T>(value: T[] | null | undefined): T[] => {
	return value || [];
};

export const formatDate = (dateString: string): string => {
	return new Date(dateString).toLocaleDateString(undefined, {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
};

export const fuzzySearch = (query: string, text: string): boolean => {
	if (!query) return true;
	
	const queryLower = query.toLowerCase();
	const textLower = text.toLowerCase();
	
	// Simple fuzzy matching: all query characters must appear in order
	let queryIndex = 0;
	for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
		if (textLower[i] === queryLower[queryIndex]) {
			queryIndex++;
		}
	}
	return queryIndex === queryLower.length;
};