<script lang="ts">
    import Container from '../../Container.svelte';
    import Button from '../components/Button.svelte';
    import classNames from 'classnames';
    import Tab from '../components/Tab/Tab.svelte';
    import DetachedPage from '../components/DetachedPage/DetachedPage.svelte';
    import { reiverrApi } from '../apis/reiverr/reiverr-api';
    import { writable, get } from 'svelte/store';
    import RequestContainer from "../components/Requests/RequestItem.svelte"
    import { useTabs } from '../components/Tab/Tab';
    import { generalSettings } from '../stores/generalSettings.store';
    import { user } from '../stores/user.store';

    enum Tabs {
        AllRequests,
        History
    }

    type Request = {
    id: number;
    user_id: string;
    media_id: number;
    status: 'Pending' | 'Approved' | 'Declined';
    created_at: string;
};

    export let id: string;

    const tab = useTabs(Tabs.AllRequests, { size: 'stretch' });
    let userId = writable('');
    let allRequests = writable<Request[]>([]);
    let isAdmin = writable(false);
    let delayInDays = writable(7);
    let defaultLimitMovies = writable(0);

    const getAllRequests = async () => {
        const response = await reiverrApi.getAllRequests();
        if (response) {
            allRequests.set(response.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
        }
    };

    const loadUser = async () => {
        const currentUser = get(user);
        if (currentUser) {
            isAdmin.set(currentUser.isAdmin);
            userId.set(currentUser.id);
        }

        // Fetch delayInDays and defaultLimitMovies from generalSettings store
        const settings = get(generalSettings)?.data?.requests;
        if (settings) {
            if (settings.delayInDays) {
                delayInDays.set(settings.delayInDays);  // Set delayInDays from the store
                console.log(`Loaded delayInDays from generalSettings: ${settings.delayInDays} days.`);
            }
            if (settings.defaultLimitMovies) {
                defaultLimitMovies.set(settings.defaultLimitMovies);  // Set defaultLimitMovies from the store
                console.log(`Loaded defaultLimitMovies from generalSettings: ${settings.defaultLimitMovies} requests.`);
            }
        }
    };

    getAllRequests();
    loadUser();
</script>

<DetachedPage class="pt-16 h-screen flex flex-col">
    <Container
        direction="horizontal"
        class="flex space-x-8 header3 pb-3 border-b-2 border-secondary-700 mb-8 mx-32"
    >
        <Container
            on:enter={() => tab.set(Tabs.AllRequests)}
            on:clickOrSelect={() => tab.set(Tabs.AllRequests)}
            let:hasFocus
            focusOnClick
        >
            <span
                class={classNames('cursor-pointer', {
                    'text-secondary-400': $tab !== Tabs.AllRequests,
                    'text-primary-500': hasFocus
                })}
            >
                {#if $isAdmin}
                    Active Requests
                {:else}
                    My Requests
                {/if}
            </span>
        </Container>

        <Container
            on:enter={() => tab.set(Tabs.History)}
            on:clickOrSelect={() => tab.set(Tabs.History)}
            let:hasFocus
            focusOnClick
        >
            <span
                class={classNames('cursor-pointer', {
                    'text-secondary-400': $tab !== Tabs.History,
                    'text-primary-500': hasFocus
                })}
            >
                History
            </span>
        </Container>
    </Container>

    <Container class="flex-1 grid w-full overflow-y-auto scrollbar-hide relative pb-16 px-32" direction="horizontal">
        <Tab {...tab} tab={Tabs.AllRequests} class="w-full">
            <div>
                {#if $allRequests.filter(request => request.status === 'Pending').length === 0}
                    <p class="text-secondary-400">No pending requests.</p>
                {:else}
                    {#each $allRequests.filter(request => request.status === 'Pending') as request}
                        <RequestContainer {request} requests={$allRequests} />
                    {/each}
                {/if}
            </div>
        </Tab>

        <Tab {...tab} tab={Tabs.History} class="w-full">
            <div>
                {#if $allRequests.filter(request => request.status === 'Approved' || request.status === 'Declined').length === 0}
                    <p class="text-secondary-400">No approuved or declined requests yet.</p>
                {:else}
                    {#each $allRequests.filter(request => request.status === 'Approved' || request.status === 'Declined') as request}
                        <RequestContainer {request} requests={$allRequests} />
                    {/each}
                {/if}
            </div>
        </Tab>
    </Container>
</DetachedPage>
