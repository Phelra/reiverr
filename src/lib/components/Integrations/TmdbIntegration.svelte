<script lang="ts">
	import { tmdbApi } from '../../apis/tmdb/tmdb-api';
	import { generalSettings } from '../../stores/generalSettings.store';
	import SelectField from '../SelectField.svelte';
	import { Trash } from 'radix-icons-svelte';
	import { derived, get } from 'svelte/store';
	import classNames from 'classnames';

	const tmdbSettings = derived(generalSettings, (settings) => settings?.data?.integrations?.tmdb);

	let connectedTmdbAccount;
	$: {
		const userId = $tmdbSettings?.userId;
		if (userId) {
			connectedTmdbAccount = tmdbApi.getAccountDetails();
		} else {
			connectedTmdbAccount = null;
		}
	}

	async function handleDisconnectTmdb() {
		await generalSettings.updateSettings((prev) => ({
			...prev,
			integrations: {
				...prev.integrations,
				tmdb: {
					...prev.integrations.tmdb,
					userId: '',
					sessionId: ''
				}
			}
		}));
	connectedTmdbAccount = null;
	}
</script>

{#await connectedTmdbAccount then tmdbAccount}
	{#if tmdbAccount}
		<SelectField value={tmdbAccount.username || ''} action={handleDisconnectTmdb}>
			Connected to
			<Trash slot="icon" let:size let:iconClass {size} class={classNames(iconClass, '')} />
		</SelectField>
	{:else}
		<p>Not connected to TMDb.</p>
	{/if}
	<slot connected={!!tmdbAccount} />
{/await}
