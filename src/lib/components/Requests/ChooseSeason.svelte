<script lang="ts">
    import { writable, get } from 'svelte/store';
    import Button from '../Button.svelte';
    import Dialog from '../Dialog/Dialog.svelte';
    import Toggle from '../Toggle.svelte';
    import { modalStack } from '../Modal/modal.store';
    export let modalId: symbol;
    export let selectedSeason = writable<number | null>(null);
    export let seasons = writable<number[]>([]);
    export let onConfirm: (season: number) => void;

    function confirmSelection() {
        const season = $selectedSeason;
        if (season !== null) {
            onConfirm(season);
            modalStack.close(modalId);
        }
    }

    function cancelSelection() {
        selectedSeason.set(null);
        modalStack.close(modalId);
    }

    function toggleSeason(seasonNumber: number, isChecked: boolean) {
        if (isChecked) {
            selectedSeason.set(seasonNumber);
        } else {
            selectedSeason.set(null);
        }
    }
</script>

<Dialog>
    <div class="flex flex-col items-center justify-center space-y-6 w-full">
        <h1 class="text-2xl font-semibold">Select a Season</h1>

        {#each $seasons as season}
            <div class="flex items-center justify-between text-lg font-medium text-secondary-100 w-full">
                <label class="mr-2 flex-1" for="season-{season}">Season {season}</label>
                <Toggle
                    checked={$selectedSeason === season}
                    on:change={({ detail }) => toggleSeason(season, detail)}
                />
            </div>
        {/each}

        <div class="flex flex-col space-y-4 mt-4 w-full">
            <Button class="buttonRequest small-button w-full" type="primary-dark" on:clickOrSelect={confirmSelection}>
                Confirm
            </Button>
            <Button class="buttonRequest small-button w-full" type="primary-dark" on:clickOrSelect={cancelSelection}>
                Cancel
            </Button>
        </div>
    </div>
</Dialog>