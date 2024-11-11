import { bundledLanguages, createHighlighter } from "shiki"
import { createJavaScriptRegexEngine } from "shiki/engine/javascript"
import githubDarkTheme from "shiki/themes/github-dark-default.mjs"
import githubLightTheme from "shiki/themes/github-light-default.mjs"

function getTheme(): string {
  const htmlTheme = document.documentElement.dataset.colorMode
  if (htmlTheme === "auto") {
    const isDarkMode = globalThis.matchMedia("(prefers-color-scheme: dark)").matches
    return isDarkMode ? "dark" : "light"
  }
  else if (htmlTheme && ["light", "dark"].includes(htmlTheme)) {
    return htmlTheme
  }

  return "light"
}

export default async function parseCode(fileContent: string, fileName: string): Promise<string> {
  const extension = fileName.split(".").pop()?.toLowerCase()

  const theme = getTheme()

  const highlighter = await createHighlighter({
    themes: [theme === "dark" ? githubDarkTheme : githubLightTheme],
    langs: Object.keys(bundledLanguages),
    engine: createJavaScriptRegexEngine(),
  })

  return highlighter.codeToHtml(fileContent, { lang: extension ?? "js", theme: `github-${theme}-default` })
}
