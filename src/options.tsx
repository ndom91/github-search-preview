import 'webext-base-css/webext-base.css';
import './options.css';
import { $, $optional } from 'select-dom/strict.js';
import { $$ } from 'select-dom';
import fitTextarea from 'fit-textarea';
import prettyBytes from 'pretty-bytes';
import { enableTabToIndent } from 'indent-textarea';
import delegate, { DelegateEvent } from 'delegate-it';
import { isChrome, isFirefox } from 'webext-detect';
import { SyncedForm } from 'webext-options-sync-per-domain';

import clearCacheHandler from './helpers/clear-cache-handler.js';
import getStorageBytesInUse from './helpers/used-storage.js';
import { perDomainOptions } from './options-storage.js';
import initTokenValidation from './options/token-validation.js';

const supportsFieldSizing = CSS.supports('field-sizing', 'content');

let syncedForm: SyncedForm | undefined;

const { version } = chrome.runtime.getManifest();

async function updateStorageUsage(area: 'sync' | 'local'): Promise<void> {
	const storage = chrome.storage[area];
	const used = await getStorageBytesInUse(area);
	const available = storage.QUOTA_BYTES - used;
	for (const output of $$(`.storage-${area}`)) {
		output.textContent = available < 1000
			? 'FULL!'
			: available < 100_000
				? `Only ${prettyBytes(available)} available`
				: `${prettyBytes(used)} used`;
	}
}

function focusFirstField({ delegateTarget: section }: DelegateEvent<Event, HTMLDetailsElement>): void {
	if (section.getBoundingClientRect().bottom > window.innerHeight) {
		section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
	}

	if (section.open) {
		const field = $optional('input, textarea', section);
		if (field) {
			field.focus({ preventScroll: true });
			if (!supportsFieldSizing && field instanceof HTMLTextAreaElement) {
				// #6404
				fitTextarea(field);
			}
		}
	}
}

function updateRateLink(): void {
	if (isChrome()) {
		return;
	}

	$('a#rate-link').href = isFirefox() ? 'https://addons.mozilla.org/en-US/firefox/addon/refined-github-' : 'https://apps.apple.com/app/id1519867270?action=write-review';
}

async function generateDom(): Promise<void> {
	// Update list from saved options
	syncedForm = await perDomainOptions.syncForm('form');

	// Only now the form is ready, we can show it
	$('#js-failed').remove();

	// Enable token validation
	void initTokenValidation(syncedForm);

	// Update rate link if necessary
	updateRateLink();

	// Update storage usage info
	void updateStorageUsage('local');
	void updateStorageUsage('sync');

	$('#version').textContent = version;
}

function addEventListeners(): void {
	// Update domain-dependent page content when the domain is changed
	syncedForm?.onChange(async domain => {
		// Point the link to the right domain
		$('a#personal-token-link').host = domain === 'default' ? 'github.com' : domain;
	});

	// Refresh page when permissions are changed (because the dropdown selector needs to be regenerated)
	chrome.permissions.onRemoved.addListener(() => {
		location.reload();
	});
	chrome.permissions.onAdded.addListener(() => {
		location.reload();
	});

	// Update storage usage info
	chrome.storage.onChanged.addListener((_, areaName) => {
		void updateStorageUsage(areaName as 'sync' | 'local');
	});

	// Improve textareas editing
	enableTabToIndent('textarea');
	if (!supportsFieldSizing) {
		fitTextarea.watch('textarea');
	}

	// Automatically focus field when a section is toggled open
	delegate('details', 'toggle', focusFirstField, { capture: true });

	// Add cache clearer
	$('#clear-cache').addEventListener('click', clearCacheHandler);
}

async function init(): Promise<void> {
	await generateDom();
	addEventListeners();
}

void init();
