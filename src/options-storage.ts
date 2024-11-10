import OptionsSyncPerDomain from 'webext-options-sync-per-domain';

export type RGHOptions = typeof defaults;

const defaults = Object.assign({
	actionUrl: 'https://github.com/',
	customCSS: '',
	personalToken: '',
	logging: false,
	logHTTP: false,
}, {
	id: 'github-search-preview'
});


export const perDomainOptions = new OptionsSyncPerDomain({ defaults });
const optionsStorage = perDomainOptions.getOptionsForOrigin();
export default optionsStorage;

const cachedSettings = optionsStorage.getAll();

export async function getToken(): Promise<string | undefined> {
	const { personalToken } = await cachedSettings;
	return personalToken as string;
}

export async function hasToken(): Promise<boolean> {
	return Boolean(await getToken());
}
