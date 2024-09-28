<script lang="ts">
    import { tmdbApi } from '../../apis/tmdb/tmdb-api';
    import { generalSettings } from '../../stores/generalSettings.store';
    import { user } from '../../stores/user.store';
    import Button from '../Button.svelte';
    import SelectField from '../SelectField.svelte';
    import TmdbIntegrationConnectDialog from './TmdbIntegrationConnectDialog.svelte';
    import { Trash } from 'radix-icons-svelte';
    import { createModal } from '../Modal/modal.store';
    import { derived, get } from 'svelte/store';
    import classNames from 'classnames';

    const tmdbSettings = derived(generalSettings, (settings) => settings?.data?.integrations?.tmdb);
    const isAdmin = get(user)?.isAdmin;

    let connectedTmdbAccount = null;
    let userTmdbConnected = false;
    let tmdbAccountName = '';

    async function fetchTmdbAccountDetails() {
        const adminSessionId = $tmdbSettings?.sessionId;
        const userSessionId = get(user)?.settings.tmdb?.sessionId;

        if (isAdmin) {
            try {
                const account = await tmdbApi.getAccountDetails();
                tmdbAccountName = account?.username || 'Admin TMDb Account';
                connectedTmdbAccount = account;
            } catch (error) {
                connectedTmdbAccount = null;
            }
        } else if (userSessionId) {
            userTmdbConnected = true;
            try {
                const account = await tmdbApi.getAccountDetails();
                tmdbAccountName = account?.username || 'User TMDb Account';
                connectedTmdbAccount = account;
            } catch (error) {
                connectedTmdbAccount = null;
            }
        } else if (adminSessionId) {
            try {
                const account = await tmdbApi.getAccountDetails();
                tmdbAccountName = 'Admin TMDb Account';
                connectedTmdbAccount = account;
            } catch (error) {
                connectedTmdbAccount = null;
            }
            userTmdbConnected = false;
        } else {
            connectedTmdbAccount = null;
            userTmdbConnected = false;
        }
    }

    $: fetchTmdbAccountDetails();

    async function handleDisconnectTmdb() {
        if (isAdmin) {
            await generalSettings.updateSettings((prev) => ({
                ...prev,
                integrations: {
                    ...prev.integrations,
                    tmdb: {
                        userId: '',
                        sessionId: ''
                    }
                }
            }));
        } else {
            await user.updateUser((prev) => ({
                ...prev,
                settings: {
                    ...prev.settings,
                    tmdb: {
                        userId: '',
                        sessionId: ''
                    }
                }
            }));
        }
        connectedTmdbAccount = null; // Assurez-vous que la variable est mise à jour
    }

    function handleConnectTmdb() {
        createModal(TmdbIntegrationConnectDialog, {
            onConnected: () => {
                fetchTmdbAccountDetails();
            }
        });
    }
</script>

<!-- Admin TMDb Account Management -->
{#if isAdmin}
    <h1 class="mb-4 header1">Default TMDb Account</h1>
    <p class="mb-4 text-yellow-500">
        By default, all user TMDb accounts will use this admin account unless the user has connected their own TMDb account.
    </p>
    {#if connectedTmdbAccount}
        <SelectField value={connectedTmdbAccount.username || ''} action={handleDisconnectTmdb}>
            Connected as
            <Trash slot="icon" let:size let:iconClass {size} class={classNames(iconClass, '')} />
        </SelectField>
    {:else}
        <p class="mb-4 text-red-500">Not connected to TMDb.</p>
        <Button type="primary-dark" on:clickOrSelect={handleConnectTmdb}>
            Connect a TMDb Account
        </Button>
    {/if}

<!-- Non-Admin User TMDb Account Management -->
{:else}
    <h1 class="mb-4 header1">User TMDb Account</h1>
    {#if userTmdbConnected}
        <SelectField value={tmdbAccountName || ''} action={handleDisconnectTmdb}>
            Connected as user account :
            <Trash slot="icon" let:size let:iconClass {size} class={classNames(iconClass, '')} />
        </SelectField>
    {:else if $tmdbSettings?.sessionId}
        <p class="mb-4 text-yellow-500">
            You are using the admin TMDb account because you have not connected your own account.
        </p>
        <Button type="primary-dark" on:clickOrSelect={handleConnectTmdb}>
            Connect your own TMDb account
        </Button>
    {:else}
        <p class="mb-4 text-red-500">No default TMDb account is currently connected. Some features will be limited.</p>
        <Button type="primary-dark" on:clickOrSelect={handleConnectTmdb}>
            Connect a TMDb account
        </Button>
    {/if}
{/if}

<slot connected={!!connectedTmdbAccount} />
