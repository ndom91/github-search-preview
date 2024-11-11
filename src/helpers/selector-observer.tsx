import { signalFromPromise } from "abort-utils"
import { css } from "code-tag"
import React from "dom-chef"
import domLoaded from "dom-loaded"
import { ParseSelector } from "typed-query-selector/parser.js"

import delay from "../helpers/delay.js"
import onetime from "../helpers/onetime.js"
import getCallerID from "./caller-id.js"

// Reads from path like assets/features/NAME.js
export function parseFeatureNameFromStack(stack: string = new Error("stack").stack!): FeatureID | undefined {
  // The stack may show other features due to cross-feature imports, but we want the top-most caller so we need to reverse it
  const match = stack
    .split("\n")
    .toReversed()
    .join("\n")
    .match(/assets\/features\/(.+)\.js/)
  return match?.[1] as FeatureID | undefined
}

type ObserverListener<ExpectedElement extends Element> = (element: ExpectedElement, options: SignalAsOptions) => void

type Options = {
  stopOnDomReady?: boolean
  once?: boolean
  signal?: AbortSignal
}

const animation = "gsp-selector-observer"

const registerAnimation = onetime((): void => {
  document.head.append(<style>{`@keyframes ${animation} {}`}</style>)
})

export default function observe<
  Selector extends string,
  ExpectedElement extends ParseSelector<Selector, HTMLElement | SVGElement>,
>(
  selectors: Selector | readonly Selector[],
  listener: ObserverListener<ExpectedElement>,
  { signal, stopOnDomReady, once }: Options = {},
): void {
  if (signal?.aborted) {
    return
  }

  if (stopOnDomReady) {
    const delayedDomReady = signalFromPromise((async () => {
      await domLoaded
      await delay(100) // Allow the animation and events to complete; Also adds support for ajaxed pages
    })())

    signal = signal ? AbortSignal.any([signal, delayedDomReady]) : delayedDomReady
  }

  const selector = typeof selectors === "string" ? selectors : selectors.join(",\n")
  const seenMark = `gsp-seen-${getCallerID()}`

  registerAnimation()

  const rule = document.createElement("style")

  rule.textContent = css`
		:where(${String(selector)}):not(.${seenMark}) {
			animation: 1ms ${animation};
		}
	`
  document.body.prepend(rule)
  signal?.addEventListener("abort", () => {
    rule.remove()
  })

  globalThis.addEventListener("animationstart", (event: AnimationEvent) => {
    const target = event.target as ExpectedElement
    // The target can match a selector even if the animation actually happened on a ::before pseudo-element, so it needs an explicit exclusion here
    if (target.classList.contains(seenMark) || !target.matches(selector)) {
      return
    }

    // Removes this specific selector’s animation once it was seen
    target.classList.add(seenMark)

    listener(target, { signal })
  }, { once, signal })
}

// Untested
export async function waitForElement<
  Selector extends string,
  ExpectedElement extends ParseSelector<Selector, HTMLElement | SVGElement>,
>(
  selectors: Selector | readonly Selector[],
  { signal, stopOnDomReady }: Options = {},
): Promise<ExpectedElement | void> {
  const local = new AbortController()
  signal = signal ? AbortSignal.any([signal, local.signal]) : local.signal

  return new Promise<ExpectedElement | void>((resolve) => {
    observe<Selector, ExpectedElement>(selectors, (element) => {
      resolve(element)
      local.abort()
    }, { signal, stopOnDomReady, once: true })

    signal.addEventListener("abort", () => {
      resolve()
    })
  })
}
