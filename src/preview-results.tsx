import React from "dom-chef"
import * as pageDetect from "github-url-detection"
import mem from "memoize"
import CodeSquare from "octicons-plain-react/CodeSquare"
import Copy from "octicons-plain-react/Copy"
import NewTab from "octicons-plain-react/LinkExternal"
import Close from "octicons-plain-react/XCircle"
import { messageRuntime } from "webext-msg"

import { add } from "./helpers/init-helpers.js"
import parseCode from "./helpers/parse-file-language.js"
import observe from "./helpers/selector-observer.js"
import { searchResultFileName } from "./selectors.js"

import "./preview-results.css"

// Fetch via background.js due to CORB policies. Also memoize to avoid multiple requests.
const fetchFile = mem(
  async (url: string): Promise<string> =>
    messageRuntime({ fetchText: url }),
)

function openInBackground(url: string): void {
  messageRuntime({
    openUrls: [url],
  })
}

function init(signal: AbortSignal): void {
  let originalUrl = ""

  const dialogElement = (
    <dialog className="gh-search-preview--dialog" onClick={onClickOutside}>
      <div className="gh-search-preview--dialog__header">
        <div id="refined-preview-search-result-filename"></div>
        <div className="gh-search-preview--dialog__headerActions">
          <Copy
            title="Copy Contents to Clipboard"
            className="gh-search-preview--dialog__copyBtn"
            onClick={() => copyToClipboard()}
          />
          <NewTab
            title="Open in Background Tab"
            className="gh-search-preview--dialog__newTabBtn"
            onClick={() => openInBackground(originalUrl)}
          />
          <Close
            title="Close Preview"
            className="gh-search-preview--dialog__closeBtn"
            onClick={() => dialogElement.close()}
          />
        </div>
      </div>
      <div id="refined-preview-search-result-pre-content"></div>
    </dialog>
  ) as unknown as HTMLDialogElement

  dialogElement.addEventListener("close", () => {
    setTimeout(() => {
      document.body.style.overflow = "unset"
    }, 500)
  })

  function onClickOutside(event: React.MouseEvent<HTMLDialogElement>): void {
    if (event.target === dialogElement) {
      dialogElement.close()
    }
  }

  function copyToClipboard(): void {
    navigator.clipboard.writeText(dialogElement.textContent)
      .catch((error) => {
        console.error("Failed to copy text:", error)
      })
  }

  document.body.append(dialogElement)

  observe(searchResultFileName, (link: HTMLAnchorElement) => {
    link.parentNode?.prepend(
      <a
        href="#"
        title="Preview File"
        className="self-end px-2 searchPreview-preview-btn"
        onClick={async (event) => {
          event.preventDefault()
          originalUrl = link.href
          const url = new URL(link.href)
          const urlWithoutParameters = `${url.origin}${url.pathname.replace("blob", "raw")}`
          const fileBody = await fetchFile(new URL(urlWithoutParameters).toString())
          const fileName = link.textContent

          const dialogPreElement = document.querySelector("#refined-preview-search-result-pre-content")
          if (dialogPreElement) {
            // Remove all children from dialogPreElement
            dialogPreElement.innerHTML = ""
            dialogPreElement.innerHTML = await parseCode(fileBody, fileName)
          }

          // Set dialog header file name
          const dialogFilename = document.querySelector("#refined-preview-search-result-filename")
          if (dialogFilename) {
            dialogFilename.textContent = link.textContent
          }

          dialogElement.showModal()
          document.body.style.overflow = "hidden"
        }}
      >
        <CodeSquare />
      </a>,
    )
  }, { signal })
}

void add(import.meta.url, {
  include: [
    pageDetect.isGlobalSearchResults,
  ],
  init,
})
