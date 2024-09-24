<script lang="ts">
import { PLATFORM_TV } from '../../constants';
import classNames from 'classnames';
import { onDestroy } from 'svelte';
import { isFirefox } from '../../utils/browser-detection';
import YouTubeBackground from '../YouTubeBackground.svelte';

export let urls: Promise<{ trailerUrl: string; backdropUrl: string; }[]>;
export let index: number;
export let hasFocus = true;
export let hideInterface = false;

    let visibleIndex = -2;
    let visibleIndexTimeout: ReturnType<typeof setTimeout>;
    let backgroundUrl = '';
    let htmlElements: HTMLDivElement[] = [];

    $: urls.then(urlArray => {
        if (urlArray.length && index >= 0 && index < urlArray.length) {
            backgroundUrl = urlArray[index]?.backdropUrl || '';
        }
    });

    function updateVisibleIndex(index: number) {
        clearTimeout(visibleIndexTimeout);
        visibleIndexTimeout = setTimeout(() => (visibleIndex = index), visibleIndex === -2 ? 1000 : 500);
        visibleIndex = -1;
    }

    $: updateVisibleIndex(index);

    onDestroy(() => clearTimeout(visibleIndexTimeout));
</script>

<div class="fixed inset-0 -z-10">
    {#await urls then urlArray}
        {#if !isFirefox()}
            {#each urlArray as { trailerUrl, backdropUrl }, i}
                {#if i === index}
                    <YouTubeBackground videoId={trailerUrl} backgroundUrl={backdropUrl} />
                {/if}
            {/each}
        {:else}
            <div class={classNames('flex overflow-hidden h-full w-full transition-transform duration-500', { 'scale-110': !hasFocus })}
                 style="perspective: 1px; -webkit-perspective: 1px;">
                {#each urlArray as { backdropUrl }, i}
                    <div class="w-full h-full flex-shrink-0 relative"
                         style="transform-style: preserve-3d; -webkit-transform-style: preserve-3d; overflow: hidden;"
                         bind:this={htmlElements[i]}>
                        <div class="w-full h-full bg-center bg-cover absolute inset-0"
                             style={`background-image: url('${backdropUrl}'); ${
                                !PLATFORM_TV &&
                                'transform: translateZ(-5px) scale(6); -webkit-transform: translateZ(-5px) scale(6);'
                             }`}
                        />
                    </div>
                {/each}
            </div>
        {/if}
    {/await}
</div>

<div class={classNames('absolute inset-0 flex flex-col -z-10 transition-opacity', { 'opacity-0': hideInterface })}>
    <div class="h-screen bg-gradient-to-b from-transparent to-secondary-900" />
    <div class="flex-1 bg-secondary-900" />
</div>
