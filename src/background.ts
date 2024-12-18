import webextAlert from "webext-alert";
import { handleMessages } from "webext-msg"
import { StorageItem } from 'webext-storage';
import { globalCache } from "webext-storage-cache"

import { addOptionsContextMenu } from "webext-tools"

import isDevelopmentVersion from "./helpers/is-development-version.js"
import optionsStorage, { hasToken } from './options-storage.js';
import "webext-dynamic-content-scripts"

// Firefox/Safari polyfill
addOptionsContextMenu()

const doesBrowserActionOpenOptions = !globalThis.chrome?.contextMenus || navigator.platform === 'iPhone' || navigator.platform === 'iPad';

const welcomeShown = new StorageItem('welcomed', { defaultValue: false });

handleMessages({
  async openUrls(urls: string[], { tab }: chrome.runtime.MessageSender) {
    for (const [index, url] of urls.entries()) {
      void chrome.tabs.create({
        url,
        index: tab!.index + index + 1,
        active: false,
      })
    }
  },
  async closeTab(_: any, { tab }: chrome.runtime.MessageSender) {
    void chrome.tabs.remove(tab!.id!)
  },
  async fetchJSON(url: string) {
    const response = await fetch(url)
    return response.json()
  },
  async fetchText(url: string) {
    const response = await fetch(url)
    return response.text()
  },
  async openOptionsPage() {
    return chrome.runtime.openOptionsPage()
  },
})

chrome.action.onClicked.addListener(async tab => {
  if (doesBrowserActionOpenOptions) {
    void chrome.runtime.openOptionsPage();
    return;
  }

  const { actionUrl } = await optionsStorage.getAll();
  if (!actionUrl) {
    // Default to options page if unset
    void chrome.runtime.openOptionsPage();
    return;
  }

  await chrome.tabs.create({
    openerTabId: tab.id,
    url: actionUrl,
  });
});

async function showWelcomePage(): Promise<void> {
  if (await welcomeShown.get()) {
    return;
  }

  const [token, permissions] = await Promise.all([
    hasToken(), // We can't handle an invalid token on a "Welcome" page, so just check whether the user has ever set one
    chrome.permissions.contains({ origins: ['https://github.com/*'] }),
  ]);

  try {
    if (token && permissions) {
      // Mark as welcomed
      return;
    }

    const url = chrome.runtime.getURL('assets/welcome.html');
    await chrome.tabs.create({ url });
  } finally {
    // Make sure it's always set to true even in case of errors
    await welcomeShown.set(true);
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  if (isDevelopmentVersion()) {
    await globalCache.clear()
  }

  if (await chrome.permissions.contains({ origins: ["*://*/*"] })) {
    console.warn("GitHub Search Preview was granted access to all websites by the user and it’s now been removed.")
    await chrome.permissions.remove({
      origins: [
        "*://*/*",
      ],
    })
  }

  // Call after the reset above just in case we nuked Safari's base permissions
  await showWelcomePage();
})

chrome.permissions.onAdded.addListener(async (permissions) => {
  if (permissions.origins?.includes("*://*/*")) {
    await chrome.permissions.remove({
      origins: [
        "*://*/*",
      ],
    })
    await webextAlert("GitHub Search Preview is not meant to run on every website. If you’re looking to enable it on GitHub Enterprise, follow the instructions in the Options page.")
  }
})
