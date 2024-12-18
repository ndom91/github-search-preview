import * as pageDetect from "github-url-detection"
import { elementExists } from "select-dom"
import stripIndent from "strip-indent"
import { Promisable } from "type-fest"
import { isFirefox, isWebPage } from "webext-detect"

import optionsStorage, { GSPOptions } from "../options-storage.js"
import asyncForEach from "./async-for-each.js"
import { catchErrors } from "./errors.js"
import ArrayMap from "./map-of-arrays.js"
import waitFor from "./wait-for.js"

type PromisableBooleanFunction = () => Promisable<boolean>
export type RunConditions = {
  /** Every condition must be true */
  asLongAs?: PromisableBooleanFunction[]
  /** At least one condition must be true */
  include?: PromisableBooleanFunction[]
  /** No conditions must be true */
  exclude?: PromisableBooleanFunction[]
}

type FeatureInitResult = void | false
type FeatureInit = (signal: AbortSignal) => Promisable<FeatureInitResult>

type FeatureLoader = {
  /** This only adds the shortcut to the help screen, it doesn't enable it. @default {} */
  shortcuts?: Record<string, string>

  /** Whether to wait for DOM ready before running `init`. By default, it runs `init` as soon as `body` is found. @default false */
  awaitDomReady?: true

  /**
  When pressing the back button, DOM changes and listeners are still there. Using a selector here would use the integrated deduplication logic, but it cannot be used with `delegate` and it shouldn't use `has-rgh` and `has-rgh-inner` anymore. #5871 #
  @deprecated
  @default false
  */
  deduplicate?: string

  init: Arrayable<FeatureInit> // Repeated here because this interface is Partial<>
} & Partial<InternalRunConfig>

type InternalRunConfig = RunConditions & {
  init: Arrayable<FeatureInit>
  shortcuts: Record<string, string>
}

const currentFeatureControllers = new ArrayMap<FeatureID, AbortController>()
const shortcutMap = new Map<string, string>()
const getFeatureID = (url: string): FeatureID => url.split("/").pop()!.split(".")[0] as FeatureID

// eslint-disable-next-line no-async-promise-executor
const globalReady = new Promise<GSPOptions>(async (resolve) => {
  // This file may be imported in the options
  if (!isWebPage()) {
    return
  }

  const [options] = await Promise.all([
    optionsStorage.getAll(),
  ])

  await waitFor(() => document.body)

  if (pageDetect.is500() || pageDetect.isPasswordConfirmation()) {
    return
  }

  if (elementExists("[github-search-preview]")) {
    console.warn(stripIndent(`
      GitHub Search Preview has been loaded twice. This may be because:

      • You loaded the developer version, or
      • The extension just updated

      If you see this at every load, please open an issue mentioning the browser you're using and the URL where this appears.
    `))
    return
  }

  document.documentElement.setAttribute("github-search-preview", "")

  if (!isFirefox()) {
    // Create logging function
    if (!options.logging) {
      console.log = () => { /* No logging */ }
    }

    if (!options.logHTTP) {
      console.log = () => { /* No logging */ }
    }
  }

  if (elementExists("body.logged-out")) {
    console.warn("GitHub Search Preview is only expected to work when you’re logged in to GitHub. Errors will not be shown.")
  }
  else {
    catchErrors()
  }

  // Detect unload via two events to catch both clicks and history navigation
  document.addEventListener("turbo:before-fetch-request", unloadAll) // Clicks
  document.addEventListener("turbo:visit", unloadAll) // Back/forward button

  resolve(options)
})

function castArray<Item>(value: Arrayable<Item>): Item[] {
  return Array.isArray(value) ? value : [value]
}

async function setupPageLoad(id: FeatureID, config: InternalRunConfig): Promise<void> {
  // const { asLongAs, include, exclude, init, shortcuts } = config;
  const { init, shortcuts } = config

  const featureController = new AbortController()
  currentFeatureControllers.append(id, featureController)

  await asyncForEach(castArray(init), async (init) => {
    const result = await init(featureController.signal)
    // Features can return `false` when they decide not to run on the current page
    if (result !== false) {
      // Register feature shortcuts
      for (const [hotkey, description] of Object.entries(shortcuts)) {
        shortcutMap.set(hotkey, description)
      }
    }
  })
}

async function add(url: string, ...loaders: FeatureLoader[]): Promise<void> {
  const id = getFeatureID(url)
  /* Feature filtering and running */
  await globalReady

  for (const loader of loaders) {
    // Input defaults and validation
    const {
      shortcuts = {},
      asLongAs,
      include,
      exclude,
      init,
      deduplicate = false,
    } = loader

    if (include?.length === 0) {
      throw new Error(`${id}: \`include\` cannot be an empty array, it means "run nowhere"`)
    }

    // 404 pages should only run 404-only features
    if (pageDetect.is404() && !include?.includes(pageDetect.is404) && !asLongAs?.includes(pageDetect.is404)) {
      continue
    }

    const details = {
      asLongAs,
      include,
      exclude,
      init,
      shortcuts,
    }

    void setupPageLoad(id, details)

    document.addEventListener("turbo:render", () => {
      if (!deduplicate || !elementExists(deduplicate)) {
        void setupPageLoad(id, details)
      }
    })
  }
}

function unloadAll(): void {
  for (const feature of currentFeatureControllers.values()) {
    for (const controller of feature) {
      controller.abort()
    }
  }

  currentFeatureControllers.clear()
}

export { add }
