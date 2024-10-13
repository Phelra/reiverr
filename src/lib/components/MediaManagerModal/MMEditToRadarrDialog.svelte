<script lang="ts">
    import Dialog from '../Dialog/Dialog.svelte';
    import { TMDB_BACKDROP_SMALL } from '../../constants';
    import { type BackEvent, scrollIntoView, type Selectable } from '../../selectable';
    import { createLocalStorageStore } from '../../stores/localstorage.store';
    import {
        movieAvailabilities,
        type MovieAvailability,
        radarrApi
    } from '../../apis/radarr/radarr-api';
    import { modalStack } from '../Modal/modal.store';
    import classNames from 'classnames';
    import { fade } from 'svelte/transition';
    import Container from '../../../Container.svelte';
    import { capitalize, formatSize } from '../../utils';
    import { ArrowRight, Check, Pencil2 } from 'radix-icons-svelte';
    import Button from '../Button.svelte';

    type AddOptionsStore = {
        rootFolderPath: string | null;
        qualityProfileId: number | null;
        minimumAvailability: MovieAvailability | null;
    };

    export let backdropUri: string;
    export let tmdbId: number;
    export let title: string;
    export let radarrItem: any;
    export let onComplete: () => void = () => {};

    export let modalId: symbol;
    $: backgroundUrl = TMDB_BACKDROP_SMALL + backdropUri;
    console.log("Background URL set to:", backgroundUrl);

    let tab: 'add-to-radarr' | 'root-folders' | 'quality-profiles' | 'monitor-settings' =
        'add-to-radarr';
    console.log("Initial tab set to:", tab);

    let addToSonarrTab: Selectable;
    let rootFoldersTab: Selectable;
    let qualityProfilesTab: Selectable;
    let monitorSettingsTab: Selectable;

    $: {
        console.log("Reactive tab change detected. Current tab:", tab);
        if (tab === 'add-to-radarr' && addToSonarrTab) {
            console.log("Focusing on addToSonarrTab");
            addToSonarrTab.focus();
        }
        if (tab === 'root-folders' && rootFoldersTab) {
            console.log("Focusing on rootFoldersTab");
            rootFoldersTab.focus();
        }
        if (tab === 'quality-profiles' && qualityProfilesTab) {
            console.log("Focusing on qualityProfilesTab");
            qualityProfilesTab.focus();
        }
        if (tab === 'monitor-settings' && monitorSettingsTab) {
            console.log("Focusing on monitorSettingsTab");
            monitorSettingsTab.focus();
        }
    }

    console.log("radarrItem received:", radarrItem);

    const addOptionsStore = createLocalStorageStore<AddOptionsStore>('add-to-radarr-options', {
        rootFolderPath: radarrItem?.rootFolderPath || null,
        qualityProfileId: radarrItem?.qualityProfileId || null,
        minimumAvailability: radarrItem?.minimumAvailability || 'released'
    });

    console.log("Initial addOptionsStore values:");
    console.log("rootFolderPath:", addOptionsStore.get().rootFolderPath);
    console.log("qualityProfileId:", addOptionsStore.get().qualityProfileId);
    console.log("minimumAvailability:", addOptionsStore.get().minimumAvailability);

    const radarrOptions = Promise.all([
        radarrApi.getRootFolders(),
        radarrApi.getQualityProfiles()
    ]).then(([rootFolders, qualityProfiles]) => ({ rootFolders, qualityProfiles }));

    radarrOptions.then((s) => {
        console.log("Fetched radarr options:");
        console.log("Root Folders:", s.rootFolders);
        console.log("Quality Profiles:", s.qualityProfiles);

        addOptionsStore.update((prev) => {
            console.log("Updating addOptionsStore with fetched options.");
            return {
                rootFolderPath: prev.rootFolderPath || s.rootFolders[0]?.path || null,
                qualityProfileId: prev.qualityProfileId || s.qualityProfiles[0]?.id || null,
                minimumAvailability: prev.minimumAvailability || 'released'
            };
        });

        console.log("Updated addOptionsStore values:");
        console.log("rootFolderPath:", addOptionsStore.get().rootFolderPath);
        console.log("qualityProfileId:", addOptionsStore.get().qualityProfileId);
        console.log("minimumAvailability:", addOptionsStore.get().minimumAvailability);
    });

    addOptionsStore.subscribe((value) => {
        console.log("addOptionsStore updated:", value);
        tab = 'add-to-radarr';
    });

    function handleAddToSonarr() {
        console.log("Attempting to add movie to Radarr with options:", $addOptionsStore);
        return radarrApi
            .addMovieToRadarr(tmdbId, {
                rootFolderPath: $addOptionsStore.rootFolderPath || undefined,
                qualityProfileId: $addOptionsStore.qualityProfileId || undefined,
                minimumAvailability: $addOptionsStore.minimumAvailability || undefined
            })
            .then((success) => {
                if (success) {
                    console.log("Successfully added to Radarr.");
                    modalStack.close(modalId);
                    onComplete();
                } else {
                    console.log("Failed to add to Radarr.");
                }
            })
            .catch((error) => {
                console.error("Error adding to Radarr:", error);
            });
    }

    function handleBack(e: BackEvent) {
        console.log("Handling back event:", e);
        if (tab !== 'add-to-radarr') {
            tab = 'add-to-radarr';
            e.detail.stopPropagation();
        }
    }

    const tabClasses = (active: boolean, secondary: boolean = false) => {
        const classes = classNames('flex flex-col transition-all', {
            'opacity-0 pointer-events-none': !active,
            '-translate-x-10': !active && !secondary,
            'translate-x-10': !active && secondary,
            'absolute inset-0': secondary
        });
        console.log("Computed tabClasses for active =", active, ", secondary =", secondary, ": ", classes);
        return classes;
    };

    const listItemClass = `flex items-center justify-between bg-primary-900 rounded-xl px-6 py-2.5 mb-4 font-medium
        border-2 border-transparent focus:border-primary-500 hover:border-primary-500 cursor-pointer group`;

    const scaledArrowClass = (hasFocus: boolean) => {
        const classes = classNames('transition-transform', {
            'text-primary-500 translate-x-0.5 scale-110': hasFocus,
            'group-hover:text-primary-500 group-hover:translate-x-0.5 group-hover:scale-110': true
        });
        console.log("Computed scaledArrowClass for hasFocus =", hasFocus, ": ", classes);
        return classes;
    };
</script>

<Dialog>
    {#if backgroundUrl && tab === 'add-to-radarr'}
        <div
            transition:fade={{ duration: 200 }}
            class="absolute inset-0 bg-cover bg-center h-52"
            style="background-image: url({backgroundUrl}); -webkit-mask-image: radial-gradient(at 90% 10%, hsla(0,0%,0%,1) 0px, transparent 70%);"
        />
        {#if backgroundUrl}
            <script>console.log("Background image URL:", backgroundUrl);</script>
        {/if}
    {/if}

    {#await radarrOptions then { qualityProfiles, rootFolders }}
        <script>
            console.log("radarrOptions resolved.");
            console.log("Quality Profiles:", qualityProfiles);
            console.log("Root Folders:", rootFolders);
        </script>

        {@const selectedRootFolder = rootFolders.find(
            (f) => f.path === $addOptionsStore.rootFolderPath
        )}
        <script>console.log("Selected Root Folder:", selectedRootFolder);</script>

        {@const selectedQualityProfile = qualityProfiles.find(
            (f) => f.id === $addOptionsStore.qualityProfileId
        )}
        <script>console.log("Selected Quality Profile:", selectedQualityProfile);</script>

        <Container on:back={handleBack} class="relative">
            <Container
                trapFocus
                bind:selectable={addToSonarrTab}
                class={tabClasses(tab === 'add-to-radarr')}
            >
                <div class="z-10 mb-8">
                    <div class="h-24" />
                    <h1 class="header2 mb-8">Edit {title}</h1>
                    <Container
                        class={listItemClass}
                        on:clickOrSelect={() => {
                            console.log("Clicked on Root Folder option");
                            tab = 'root-folders';
                        }}
                        let:hasFocus
                    >
                        <div>
                            <h1 class="text-secondary-300 font-semibold tracking-wide text-sm">Root Folder</h1>
                            {selectedRootFolder?.path}
                            ({formatSize(selectedRootFolder?.freeSpace || 0)} left)
                        </div>
                        <ArrowRight class={scaledArrowClass(hasFocus)} size={24} />
                    </Container>

                    <Container
                        class={listItemClass}
                        on:clickOrSelect={() => {
                            console.log("Clicked on Quality Profile option");
                            tab = 'quality-profiles';
                        }}
                        let:hasFocus
                    >
                        <div>
                            <h1 class="text-secondary-300 font-semibold tracking-wide text-sm">
                                Quality Profile
                            </h1>
                            <span>
                                {selectedQualityProfile?.name}
                            </span>
                        </div>
                        <ArrowRight class={scaledArrowClass(hasFocus)} size={24} />
                    </Container>

                    <Container
                        class={listItemClass}
                        on:clickOrSelect={() => {
                            console.log("Clicked on Minimum Availability option");
                            tab = 'monitor-settings';
                        }}
                        let:hasFocus
                    >
                        <div>
                            <h1 class="text-secondary-300 font-semibold tracking-wide text-sm">
                                Minimum Availability
                            </h1>
                            <span>
                                {capitalize($addOptionsStore.minimumAvailability || 'released')}
                            </span>
                        </div>
                        <ArrowRight class={scaledArrowClass(hasFocus)} size={24} />
                    </Container>

                </div>
                <Container class="flex flex-col space-y-4">
                    <Button type="primary-dark" action={handleAddToSonarr} focusOnMount>
                        <Pencil2 size={19} slot="icon" />
                        Edit
                    </Button>
                    <Button type="primary-dark" on:clickOrSelect={() => {
                        console.log("Clicked on Cancel button");
                        modalStack.close(modalId);
                    }}>
                        Cancel
                    </Button>
                </Container>
            </Container>

            <!-- Root Folders Tab -->
            <Container
                trapFocus
                class={tabClasses(tab === 'root-folders', true)}
                bind:selectable={rootFoldersTab}
            >
                <h1 class="text-xl text-secondary-100 font-medium mb-4">Root Folder</h1>
                <div class="min-h-0 overflow-y-auto scrollbar-hide">
                    {#each rootFolders as rootFolder}
                        <Container
                            class={listItemClass}
                            on:enter={scrollIntoView({ vertical: 64 })}
                            on:clickOrSelect={() => {
                                console.log("Selected Root Folder:", rootFolder);
                                addOptionsStore.update((prev) => ({ ...prev, rootFolderPath: rootFolder.path }));
                                console.log("Updated addOptionsStore rootFolderPath to:", rootFolder.path);
                            }}
                            focusOnClick
                            focusOnMount={$addOptionsStore.rootFolderPath === rootFolder.path}
                        >
                            <div>
                                {rootFolder.path} ({formatSize(rootFolder.freeSpace || 0)} left)
                            </div>
                            {#if $addOptionsStore.rootFolderPath === rootFolder.path}
                                <Check size={24} />
                            {/if}
                        </Container>
                    {/each}
                </div>
            </Container>

            <!-- Quality Profiles Tab -->
            <Container
                trapFocus
                class={tabClasses(tab === 'quality-profiles', true)}
                bind:selectable={qualityProfilesTab}
            >
                <h1 class="text-xl text-secondary-100 font-medium mb-4">Quality Profile</h1>
                <div class="min-h-0 overflow-y-auto scrollbar-hide">
                    {#each qualityProfiles as qualityProfile}
                        <Container
                            class={listItemClass}
                            on:enter={scrollIntoView({ vertical: 64 })}
                            on:clickOrSelect={() => {
                                console.log("Selected Quality Profile:", qualityProfile);
                                addOptionsStore.update((prev) => ({
                                    ...prev,
                                    qualityProfileId: qualityProfile.id
                                }));
                                console.log("Updated addOptionsStore qualityProfileId to:", qualityProfile.id);
                            }}
                            focusOnClick
                            focusOnMount={$addOptionsStore.qualityProfileId === qualityProfile.id}
                        >
                            <div>{qualityProfile.name}</div>
                            {#if $addOptionsStore.qualityProfileId === qualityProfile.id}
                                <Check size={24} />
                            {/if}
                        </Container>
                    {/each}
                </div>
            </Container>

            <!-- Monitor Settings Tab -->
            <Container
                trapFocus
                class={tabClasses(tab === 'monitor-settings', true)}
                bind:selectable={monitorSettingsTab}
            >
                <h1 class="text-xl text-secondary-100 font-medium mb-4">Minimum Availability</h1>
                <div class="min-h-0 overflow-y-auto scrollbar-hide">
                    {#each movieAvailabilities as availability}
                        <Container
                            class={listItemClass}
                            on:enter={scrollIntoView({ vertical: 64 })}
                            on:clickOrSelect={() => {
                                console.log("Selected Minimum Availability:", availability);
                                addOptionsStore.update((prev) => ({ ...prev, minimumAvailability: availability }));
                                console.log("Updated addOptionsStore minimumAvailability to:", availability);
                            }}
                            focusOnClick
                            focusOnMount={$addOptionsStore.minimumAvailability === availability}
                        >
                            <div>{capitalize(availability)}</div>
                            {#if $addOptionsStore.minimumAvailability === availability}
                                <Check size={24} />
                            {/if}
                        </Container>
                    {/each}
                </div>
            </Container>
        </Container>
    {:catch error}
        <script>console.error("Error fetching radarr options:", error);</script>
    {/await}
</Dialog>
