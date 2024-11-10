import 'webext-dynamic-content-scripts';
import { globalCache } from 'webext-storage-cache'; // Also needed to regularly clear the cache
import { addOptionsContextMenu } from 'webext-tools';
import webextAlert from 'webext-alert';
import { handleMessages } from 'webext-msg';

import isDevelopmentVersion from './helpers/is-development-version.js';
import { styleHotfixes } from './helpers/hotfix.js';

const { version } = chrome.runtime.getManifest();

// Firefox/Safari polyfill
addOptionsContextMenu();

handleMessages({
	async openUrls(urls: string[], { tab }: chrome.runtime.MessageSender) {
		for (const [index, url] of urls.entries()) {
			void chrome.tabs.create({
				url,
				index: tab!.index + index + 1,
				active: false,
			});
		}
	},
	async closeTab(_: any, { tab }: chrome.runtime.MessageSender) {
		void chrome.tabs.remove(tab!.id!);
	},
	async fetchJSON(url: string) {
		const response = await fetch(url);
		return response.json();
	},
	async fetchText(url: string) {
		const response = await fetch(url);
		return response.text();
	},
	async openOptionsPage() {
		return chrome.runtime.openOptionsPage();
	},
	async getStyleHotfixes() {
		return styleHotfixes.get(version);
	},
});

chrome.runtime.onInstalled.addListener(async () => {
	if (isDevelopmentVersion()) {
		await globalCache.clear();
	}

	if (await chrome.permissions.contains({ origins: ['*://*/*'] })) {
		console.warn('GitHub Search Preview was granted access to all websites by the user and it’s now been removed.');
		await chrome.permissions.remove({
			origins: [
				'*://*/*',
			],
		});
	}
});

chrome.permissions.onAdded.addListener(async permissions => {
	if (permissions.origins?.includes('*://*/*')) {
		await chrome.permissions.remove({
			origins: [
				'*://*/*',
			],
		});
		await webextAlert('GitHub Search Preview is not meant to run on every website. If you’re looking to enable it on GitHub Enterprise, follow the instructions in the Options page.');
	}
});
