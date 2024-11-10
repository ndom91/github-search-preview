import React from 'dom-chef';
import { CachedFunction } from 'webext-storage-cache';
import { isEnterprise } from 'github-url-detection';
import { any as concatenateTemplateLiteralTag } from 'code-tag';
import { base64ToString } from 'uint8array-extras';

import isDevelopmentVersion from './is-development-version.js';

async function fetchHotfix(path: string): Promise<string> {
	// The explicit endpoint is necessary because it shouldn't change on GHE
	// We can't use `https://raw.githubusercontent.com` because of permission issues https://github.com/refined-github/refined-github/pull/3530#issuecomment-691595925
	const request = await fetch(`https://api.github.com/repos/refined-github/yolo/contents/${path}`);
	const { content } = await request.json();

	// Rate-limit check
	if (content) {
		return base64ToString(content).trim();
	}

	return '';
}

export const styleHotfixes = new CachedFunction('style-hotfixes', {
	updater: async (version: string): Promise<string> => fetchHotfix(`style/${version}.css`),

	maxAge: { hours: 6 },
	staleWhileRevalidate: { days: 300 },
	cacheKey: () => '',
});

export async function applyStyleHotfixes(style: string): Promise<void> {
	if (isDevelopmentVersion() || isEnterprise() || !style) {
		return;
	}

	// Prepend to body because that's the only way to guarantee they come after the static file
	document.body.prepend(<style>{style}</style>);
}

let localStrings: Record<string, string> = {};
export function _(...arguments_: Parameters<typeof concatenateTemplateLiteralTag>): string {
	const original = concatenateTemplateLiteralTag(...arguments_);
	return localStrings[original] ?? original;
}

const localStringsHotfix = new CachedFunction('strings-hotfixes', {
	async updater(): Promise<Record<string, string>> {
		const json = await fetchHotfix('strings.json');
		return json ? JSON.parse(json) : {};
	},
	maxAge: { hours: 6 },
	staleWhileRevalidate: { days: 30 },
});

// Updates the local object from the storage to enable synchronous access
export async function preloadSyncLocalStrings(): Promise<void> {
	if (isDevelopmentVersion() || isEnterprise()) {
		return;
	}

	localStrings = await localStringsHotfix.get() ?? {};
}
