const fineGrainedTokenSuggestion = 'Please use a GitHub App, OAuth App, or a personal access token with fine-grained permissions.';
const preferredMessage = 'Refined GitHub does not support per-organization fine-grained tokens. https://github.com/refined-github/refined-github/wiki/Security';

const { version } = chrome.runtime.getManifest();

export function parseFeatureNameFromStack(stack: string = new Error('stack').stack!): FeatureID | undefined {
	// The stack may show other features due to cross-feature imports, but we want the top-most caller so we need to reverse it
	const match = stack
		.split('\n')
		.toReversed()
		.join('\n')
		.match(/assets\/features\/(.+)\.js/);
	return match?.[1] as FeatureID | undefined;
}

export function logError(error: Error): void {
	const { message, stack } = error;


	const id = parseFeatureNameFromStack(stack!);

	if (message.endsWith(fineGrainedTokenSuggestion)) {
		console.log('ℹ️', id, '→', message.replace(fineGrainedTokenSuggestion, preferredMessage));
		return;
	}

	if (message.includes('token')) {
		console.log('ℹ️ Refined GitHub →', message, '→', id);
		return;
	}

	const searchIssueUrl = new URL('https://github.com/refined-github/refined-github/issues');
	searchIssueUrl.searchParams.set('q', `is:issue is:open label:bug ${id ?? message}`);

	const newIssueUrl = new URL('https://github.com/refined-github/refined-github/issues/new');
	newIssueUrl.searchParams.set('template', '1_bug_report.yml');
	newIssueUrl.searchParams.set('title', id ? `\`${id}\`: ${message}` : message);
	newIssueUrl.searchParams.set('repro', location.href);
	newIssueUrl.searchParams.set('description', [
		'```',
		String(error instanceof Error ? error.stack! : error).trim(),
		'```',
	].join('\n'));

	// Don't change this to `throw Error` because Firefox doesn't show extensions' errors in the console
	console.group(`❌ Refined GitHub: ${id ?? 'global'}`); // Safari supports only one parameter
	console.log(`📕 ${version} →`, error); // One parameter improves Safari formatting
	console.log('🔍 Search issue', searchIssueUrl.href);
	console.log('🚨 Report issue', newIssueUrl.href);
	console.groupEnd();
}

export function catchErrors(): void {
	globalThis.addEventListener('error', event => {
		const { error } = event; // Access only once
		// Don't use `assertError` or it'll loop
		if (error) {
			logError(error);
			event.preventDefault();
		}
	});

	addEventListener('unhandledrejection', event => {
		const error = event.reason; // Access only once
		// Don't use `assertError` or it'll loop
		if (error) {
			logError(error);
			event.preventDefault();
		}
	});
}
