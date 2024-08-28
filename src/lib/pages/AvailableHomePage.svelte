<script lang="ts">
    import Container from '../../Container.svelte';
    import JellyfinHeroCarousel from '../components/HeroShowcase/JellyfinHeroShowcase.svelte';
    import { scrollIntoView } from '../selectable';
    import { jellyfinApi } from '../apis/jellyfin/jellyfin-api';
    import JellyfinCard from '../components/Card/JellyfinCard.svelte';
    import { navigate } from '../components/StackRouter/StackRouter';
    import DetachedPage from '../components/DetachedPage/DetachedPage.svelte';
    import Carousel from '../components/Carousel/Carousel.svelte';

    const MAX_ITEMS = 15;

    let heroCarouselLoaded = false;

    let heroMovies = jellyfinApi.getLibraryItems().then(items => {
        heroCarouselLoaded = true;
        return items.filter(item => item.Type === 'Movie' && item.CommunityRating >= 6);
    });

    const continueWatching = jellyfinApi.getContinueWatching('movie').then(items => {
        console.log('Continue Watching items loaded:', items);
        return items.slice(0, MAX_ITEMS);
    });

    const recentlyAddedPromise = jellyfinApi.getRecentlyAdded('movie').then(items => items.slice(0, MAX_ITEMS));
    const popularMoviesPromise = jellyfinApi.getLibraryItems().then(items => {
        return items.filter(item => item.Type === 'Movie').sort((a, b) => b.CommunityRating - a.CommunityRating).slice(0, MAX_ITEMS);
    });
    const latestReleasesPromise = jellyfinApi.getLibraryItems().then(items => {
        return items.filter(item => item.Type === 'Movie').sort((a, b) => new Date(b.PremiereDate).getTime() - new Date(a.PremiereDate).getTime()).slice(0, MAX_ITEMS);
    });
    const topRatedMoviesPromise = jellyfinApi.getLibraryItems().then(items => {
        return items.filter(item => item.Type === 'Movie').sort((a, b) => b.CommunityRating - a.CommunityRating).slice(0, MAX_ITEMS);
    });

    function fetchMoviesByGenre(genre) {
        return jellyfinApi.getLibraryItems().then(items => {
            return items.filter(item => item.Type === 'Movie' && item.Genres.includes(genre)).slice(0, MAX_ITEMS);
        });
    }

    const showGenres = ["Horreur", "Drame", "Histoire"];
    const genreMoviesPromises = showGenres.map(genre => {
        return {
            genre,
            promise: fetchMoviesByGenre(genre)
        };
    });
</script>

<DetachedPage class="flex flex-col relative">
    <div class="h-[calc(100vh-12rem)] flex px-32">
        <JellyfinHeroCarousel
            items={heroMovies}
            on:enter={scrollIntoView({ top: 0 })}
            on:select={({ detail }) => navigate(`/movie/${detail?.Id}`)}
        />
    </div>

    {#if heroCarouselLoaded}
        <div class="my-16 space-y-8">
            {#await continueWatching then continueWatching}
                {#if continueWatching?.length}
                    <Carousel scrollClass="px-32" on:enter={scrollIntoView({ vertical: 128 })}>
                        <span slot="header">Continue Watching</span>
                        {#each continueWatching as item (item.Id)}
                            <JellyfinCard on:enter={scrollIntoView({ horizontal: 128 })} size="lg" {item} />
                        {/each}
                    </Carousel>
                {/if}
            {/await}

            {#await recentlyAddedPromise then recentlyAdded}
                {#if recentlyAdded?.length}
                    <Carousel scrollClass="px-32" on:enter={scrollIntoView({ vertical: 128 })}>
                        <span slot="header">Recently Added</span>
                        {#each recentlyAdded as item (item.Id)}
                            <JellyfinCard on:enter={scrollIntoView({ horizontal: 128 })} size="lg" {item} />
                        {/each} 
                    </Carousel>
                {/if}
            {/await}

            {#await popularMoviesPromise then popularMovies}
                {#if popularMovies?.length}
                    <Carousel scrollClass="px-32" on:enter={scrollIntoView({ vertical: 128 })}>
                        <span slot="header">Popular Movies</span>
                        {#each popularMovies as item}
                            <JellyfinCard on:enter={scrollIntoView({ horizontal: 128 })} size="lg" {item} />
                        {/each}
                    </Carousel>
                {/if}
            {/await}

            {#await latestReleasesPromise then releases}
                {#if releases?.length}
                    <Carousel scrollClass="px-32" on:enter={scrollIntoView({ vertical: 128 })}>
                        <span slot="header">Latest Releases</span>
                        {#each releases as item}
                            <JellyfinCard on:enter={scrollIntoView({ horizontal: 128 })} size="lg" {item} />
                        {/each}
                    </Carousel>
                {/if}
            {/await}

            {#await topRatedMoviesPromise then topRated}
                {#if topRated?.length}
                    <Carousel scrollClass="px-32" on:enter={scrollIntoView({ vertical: 128 })}>
                        <span slot="header">Top Rated Movies</span>
                        {#each topRated as item}
                            <JellyfinCard on:enter={scrollIntoView({ horizontal: 128 })} size="lg" {item} />
                        {/each}
                    </Carousel>
                {/if}
            {/await}

            {#each genreMoviesPromises as {genre, promise}}
                {#await promise then movies}
                    {#if movies?.length}
                        <Carousel scrollClass="px-32" on:enter={scrollIntoView({ vertical: 128 })}>
                            <span slot="header">{genre} Movies</span>
                            {#each movies as item (item.Id)}
                                <JellyfinCard on:enter={scrollIntoView({ horizontal: 128 })} size="lg" {item} />
                            {/each}
                        </Carousel>
                    {/if}
                {/await}
            {/each}
        </div>
    {/if}
</DetachedPage>
