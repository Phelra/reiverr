<script lang="ts">
	import { type Readable } from 'svelte/store';
	import {
		tmdbApi,
		type TmdbEpisode,
		type TmdbSeasonEpisode,
		type TmdbSeriesFull2
	} from '../../apis/tmdb/tmdb-api';
	import Container from '../../../Container.svelte';
	import { useDependantRequest } from '../../stores/data.store';
	import type { JellyfinItem } from '../../apis/jellyfin/jellyfin-api';
	import TmdbEpisodeCard from '../EpisodeCard/TmdbEpisodeCard.svelte';
	import { scrollIntoView, Selectable } from '../../selectable';
	import { playerState } from '../VideoPlayer/VideoPlayer';
	import CardGrid from '../CardGrid.svelte';
	import UICarousel from '../Carousel/UICarousel.svelte';
	import classNames from 'classnames';
	import ScrollHelper from '../ScrollHelper.svelte';
	import ManageSeasonCard from './ManageSeasonCard.svelte';
	import { TMDB_BACKDROP_SMALL } from '../../constants';
	import { navigate } from '../StackRouter/StackRouter';

	export let id: number;
	export let tmdbSeries: Readable<TmdbSeriesFull2 | undefined>;
	export let jellyfinEpisodes: Promise<JellyfinItem[]>;
	export let currentJellyfinEpisode: Promise<JellyfinItem | undefined>;
	export let handleRequestSeason: (season: number) => Promise<any>;

	let awaitedJellyfinEpisodes: JellyfinItem[] = [];
	jellyfinEpisodes.then((episodes) => {
		awaitedJellyfinEpisodes = episodes;
	});

	let seasonIndex = 0;
	let scrollTop: number;
	$: translateUp = scrollTop < 140;

	const { data: tmdbSeasons } = useDependantRequest(
		(seasons: number) => tmdbApi.getTmdbSeriesSeasons(id, seasons),
		tmdbSeries,
		(series) => (series?.seasons?.length ? ([series.seasons.length] as const) : undefined)
	);

	function handleOpenEpisodePage(episode: TmdbSeasonEpisode) {
		navigate(`/series/${id}/season/${episode.season_number}/episode/${episode.episode_number}`);
	}

	function handleMountSeasonButton(s: Selectable, seasonNumber: number) {
		currentJellyfinEpisode.then((currentEpisode) => {
			if (currentEpisode?.ParentIndexNumber === seasonNumber) {
				seasonIndex = currentEpisode?.ParentIndexNumber
					? currentEpisode?.ParentIndexNumber - 1
					: seasonIndex;

				s.focus({ setFocusedElement: false, propagate: false });
			}
		});
	}

	function handleMountCard(s: Selectable, episode: TmdbEpisode) {
		// currentJellyfinEpisode.then((currentEpisode) => {
		// 	if (
		// 		currentEpisode?.IndexNumber === episode.episode_number &&
		// 		currentEpisode?.ParentIndexNumber === episode.season_number
		// 	) {
		// 		s.focus({ setFocusedElement: false, propagate: false });
		// 	}
		// });
	}
</script>

<ScrollHelper bind:scrollTop />

<Container
	on:enter
	class={classNames('transition-transform mx-32', {
		'-translate-y-16': translateUp
	})}
>
	<UICarousel
		class={classNames('flex transition-opacity mb-8', {
			'opacity-0': translateUp
		})}
		on:enter={scrollIntoView({ horizontal: 64 })}
	>
		{#each $tmdbSeasons || [] as season, i}
			<Container
				on:mount={(e) => handleMountSeasonButton(e.detail, season?.season_number || 0)}
				let:hasFocus
				on:enter={(event) => {
					scrollIntoView({ horizontal: 64 })(event);
					seasonIndex = i;
				}}
				focusOnClick
			>
				<div
					class={classNames(
						'font-semibold text-2xl',
						'px-3 py-1 cursor-pointer whitespace-nowrap rounded-lg',
						'hover:text-white',
						{
							'bg-primary-500 text-black': hasFocus,
							//'bg-stone-800/50': hasFocus,
							'text-zinc-400': !(seasonIndex === i),
							'text-white': seasonIndex === i && !hasFocus
						}
					)}
				>
					Season {season.season_number}
				</div>
			</Container>
		{/each}
	</UICarousel>
	<CardGrid type="landscape" on:mount>
		{#if $tmdbSeasons?.[seasonIndex]?.episodes?.length}
			{#each $tmdbSeasons?.[seasonIndex]?.episodes || [] as episode}
				{@const jellyfinEpisode = awaitedJellyfinEpisodes?.find(
					(i) =>
						i.IndexNumber === episode.episode_number &&
						i.ParentIndexNumber === episode.season_number
				)}
				{@const jellyfinEpisodeId = jellyfinEpisode?.Id}
				{#key episode.id}
					<TmdbEpisodeCard
						{episode}
						series={$tmdbSeries}
						on:mount={(e) => handleMountCard(e.detail, episode)}
						on:enter={scrollIntoView({ top: 92, bottom: 128 })}
						handlePlay={jellyfinEpisodeId
							? () => playerState.streamJellyfinId(jellyfinEpisodeId)
							: undefined}
						isWatched={jellyfinEpisode?.UserData?.Played || false}
						playbackProgress={jellyfinEpisode?.UserData?.PlayedPercentage || 0}
						on:clickOrSelect={() => handleOpenEpisodePage(episode)}
					/>
				{/key}
			{/each}
			<ManageSeasonCard
				backdropUrl={TMDB_BACKDROP_SMALL + $tmdbSeries?.backdrop_path}
				on:clickOrSelect={() => handleRequestSeason(seasonIndex + 1)}
				on:enter={scrollIntoView({ top: 92, bottom: 128 })}
			/>
		{/if}
	</CardGrid>
</Container>
