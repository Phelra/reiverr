<script lang="ts">
	import Container from '../../../Container.svelte';
	import HeroCarousel from '../HeroCarousel/HeroCarousel.svelte';
	import DetachedPage from '../DetachedPage/DetachedPage.svelte';
	import ScrollHelper from '../ScrollHelper.svelte';
	import Carousel from '../Carousel/Carousel.svelte';
	import TmdbPersonCard from '../PersonCard/TmdbPersonCard.svelte';
	import TmdbCard from '../Card/TmdbCard.svelte';
	import EpisodeGrid from './EpisodeGrid.svelte';
	import Button from '../Button.svelte';
	import FileDetailsDialog from './FileDetailsDialog.svelte';
	import SonarrMediaManagerModal from '../MediaManagerModal/SonarrMediaManagerModal.svelte';
	import MMAddToSonarrDialog from '../MediaManagerModal/MMAddToSonarrDialog.svelte';
	import ConfirmDialog from '../Dialog/ConfirmDialog.svelte';
	import DownloadDetailsDialog from './DownloadDetailsDialog.svelte';
	import SpinnerModal from '../SpinnerModal.svelte';
	import ChooseSeason from '../Requests/ChooseSeason.svelte';
	import classNames from 'classnames';
	import { tmdbApi } from '../../apis/tmdb/tmdb-api';
	import { jellyfinApi } from '../../apis/jellyfin/jellyfin-api';
	import { sonarrApi } from '../../apis/sonarr/sonarr-api';
	import { reiverrApi } from '../../apis/reiverr/reiverr-api'; 
	import { generalSettings } from '../../stores/generalSettings.store';
	import { useRequest } from '../../stores/data.store';
	import { user } from '../../stores/user.store';
	import { createModal, modalStack } from '../Modal/modal.store';
	import { writable, get } from 'svelte/store';
	import { scrollIntoView, useRegistrar } from '../../selectable';
	import { formatSize } from '../../utils';
	import { createSerieRequestApprouved, createSerieRequest } from '../Requests/requestActions';
	import { getOrAddSeriesToSonarr } from '../MediaManagerAuto/addSerieToSonarrAutomatically';
	import { handleSeriesDownload } from '../MediaManagerAuto/AutoDownloadManagerSerie';
	import { PLATFORM_WEB, TMDB_IMAGES_ORIGINAL } from '../../constants';
	import { Cross1, DotFilled, ExternalLink, Play, Plus, Trash } from 'radix-icons-svelte';

	export let id: string;
	const tmdbId = Number(id);
	let requestExists = false;
	let pendingRequest = false;
	let selectedSeason = writable<number | null>(null);
	let requestedSeasons = writable<number[]>([]);
	let scrollTop: number;
    let loadingMessage = writable('');

    function setLoadingMessage(message: string) {
        loadingMessage.set(message);
    }

	const { promise: tmdbSeries, data: tmdbSeriesData } = useRequest(tmdbApi.getTmdbSeries, tmdbId);
	let sonarrItem = sonarrApi.getSeriesByTmdbId(tmdbId);
	const { promise: recommendations } = useRequest(tmdbApi.getSeriesRecommendations, tmdbId);
	$: sonarrDownloads = getDownloads(sonarrItem);
	$: sonarrFiles = getFiles(sonarrItem);
	$: sonarrSeasonNumbers = Promise.all([sonarrFiles, sonarrDownloads]).then(
		([files, downloads]) => [...new Set(files.map(item => item.seasonNumber || -1)), ...new Set(downloads.map(item => item.seasonNumber || -1))]
	);
	$: sonarrEpisodes = Promise.all([sonarrItem, sonarrSeasonNumbers])
		.then(([item, seasons]) => Promise.all(seasons.map(s => sonarrApi.getEpisodes(item?.id || -1, s))))
		.then(items => items.flat());

	const jellyfinSeries = getJellyfinSeries(id);
	const jellyfinEpisodes = jellyfinSeries.then(s => (s && jellyfinApi.getJellyfinEpisodes(s.Id)) || []);
	const nextJellyfinEpisode = jellyfinEpisodes.then(items => items.find(i => i.UserData?.Played === false));
	const episodeCards = useRegistrar();

	function getJellyfinSeries(id: string) {
		return jellyfinApi.getLibraryItemFromTmdbId(id);
	}

	function getFiles(item: typeof sonarrItem) {
		return item.then(item => (item ? sonarrApi.getFilesBySeriesId(item?.id || -1) : []));
	}

	function getDownloads(item: typeof sonarrItem) {
		return item.then(item => (item ? sonarrApi.getDownloadsBySeriesId(item?.id || -1) : []));
	}

	function onGrabRelease() {
		setTimeout(() => (sonarrDownloads = getDownloads(sonarrItem)), 8000);
	}

	function formatRequestedSeasons(seasons: number[]) {
		if (seasons.length === 0) return '';
		if (seasons.length === 1) return `Requested Season ${seasons[0]}`;
		const allButLast = seasons.slice(0, -1).join(', ');
		const last = seasons[seasons.length - 1];
		return `Requested Seasons ${allButLast} & ${last}`;
	}


	(async () => {
  try {
    // Récupère les requêtes par MediaId et vérifie si le retour est un tableau
    const existingRequests = (await reiverrApi.getRequestsByMediaId(tmdbId)) || [];

    // Ajoute une vérification pour être sûr que c'est un tableau
    if (Array.isArray(existingRequests)) {
      // Utilise `length` uniquement si c'est bien un tableau
      requestExists = existingRequests.length > 0;
      pendingRequest = existingRequests.some(request => request.status === 'Pending');
      const pendingRequests = existingRequests.filter(request => request.status === 'Pending');

      if (pendingRequests.length > 0) {
        requestedSeasons.set(pendingRequests.map(request => request.season));
      }
    } else {
      // En cas de retour inattendu, affiche un message d'erreur
      console.error('Expected an array for existingRequests, but got:', typeof existingRequests);
    }
  } catch (error) {
    console.error('Error fetching data:', error);
  }
})();



	// Gestion des requêtes et des quotas
	async function checkQuotaAndCreateRequest(season: number, sonarrItem: any) {
		const currentUser = get(user);
		const userId = currentUser?.id;
		const settings = get(generalSettings);
		const days = settings.data.requests?.delayInDays ?? 30;
		const userRequestCount = await reiverrApi.countRequestsInPeriodForUser(userId, days);
		const maxRequests = settings.data.requests?.defaultLimitTV ?? 5;

		if (userRequestCount < maxRequests) {
			const remainingRequests = maxRequests - userRequestCount;
			createConfirmQuotaDialog(remainingRequests, days, maxRequests, sonarrItem, season);
		} else {
			createConfirmRequestDialog(season);
		}
	}

	async function handleRequestSeason() {
    try {
        const tmdbSeries = await tmdbApi.getTmdbSeries(tmdbId);
        const currentUser = get(user);

        // Récupérer ou ajouter la série à Sonarr
        const sonarrItem = await getOrAddSeriesToSonarr(
            tmdbSeries.id,
            tmdbSeries.name,
            tmdbSeries.backdrop_path,
            () => console.log('Series added successfully.') // onComplete callback
        );
        if (!sonarrItem) {
            console.error('Failed to process series in Sonarr.');
            return;
        }

        // Ouvrir le modal de sélection de saison
        openChooseSeasonModal(sonarrItem, currentUser);

    } catch (error) {
        console.error('Error handling request for season:', error);
    }
}

// Ouvre le modal pour choisir une saison et gère les actions de l'utilisateur
function openChooseSeasonModal(sonarrItem, currentUser) {
    const validSeasons = sonarrItem.seasons.filter(s => s.seasonNumber > 0);
    createModal(ChooseSeason, {
        seasons: writable(validSeasons.map(s => s.seasonNumber)),
        selectedSeason,
        onConfirm: async season => {
            if (currentUser?.isAdmin) {
                handleAdminRequest(sonarrItem, season);
            } else {
                await checkQuotaAndCreateRequest(season,sonarrItem);
            }
        }
    });
}


async function handleAdminRequest(sonarrItem: any, season: number) {
  try {
    createModal(SpinnerModal, {
      title: 'Processing Season Download',
      progressMessage: loadingMessage,
    });

    await handleSeriesDownload(sonarrItem.id, season, setLoadingMessage, handleError);

    setLoadingMessage('Download complete.');
    setTimeout(() => modalStack.closeTopmost(), 1000); // Fermer le modal après 1 seconde

  } catch (error) {
    handleError(error.message || 'Failed to download series.');
    setTimeout(() => modalStack.closeTopmost(), 2000);
  }
}

function handleError(message: string) {
        console.error(message);
        loadingMessage.set('Error occurred');
    }

	// Fonctions de confirmation et de création de requêtes
function createConfirmQuotaDialog(remainingRequests, days, maxRequests, sonarrItem, season) {
	createModal(ConfirmDialog, {
		header: 'Confirm Automatic Download',
		body: `You have ${remainingRequests}/${maxRequests} requests remaining that will be automatically approved. Requests reset every ${days} days. After reaching this limit, further requests will require admin approval.`,
		confirm: async () => {
			modalStack.closeTopmost();
			createModal(SpinnerModal, {
				title: 'Processing Series Download',
				progressMessage: loadingMessage
			});
			try {
				// Ajouter la série à Sonarr et télécharger la saison sélectionnée
				await handleSeriesDownload(sonarrItem.id, season, setLoadingMessage, handleError);

				// Création d'une requête approuvée
				await createSerieRequestApprouved(tmdbId, get(user), season);
				requestExists = true;
				pendingRequest = false;

				// Mise à jour finale du message une fois le téléchargement terminé
				loadingMessage.set("Process completed");
				setTimeout(() => modalStack.closeTopmost(), 1000);
			} catch (error) {
				console.error('Error during automatic download process:', error.message);
				handleError(error.message || 'Failed to download series.');
				setTimeout(() => modalStack.closeTopmost(), 2000); // Fermer le modal en cas d'erreur
			}
		}
	});
}

	function createConfirmRequestDialog(season: number) {
		createModal(ConfirmDialog, {
			header: 'Confirm Request',
			body: `Do you want to request season ${season}? An administrator will have to approve it before it appears in the library.`,
			confirm: async () => {
				try {
					await createSerieRequest(tmdbId,get(user),season);
					requestedSeasons.update(seasons => [...seasons, season]); 
				} catch (error) {
					console.error('Error confirming request creation:', error);
				}
			}
		});
	}

	function createConfirmDeleteSeasonDialog(files: EpisodeFileResource[]) {
		createModal(ConfirmDialog, {
			header: 'Delete Season Files?',
			body: `Are you sure you want to delete all ${files.length} file(s) from season ${files[0]?.seasonNumber}?`,
			confirm: () =>
				sonarrApi.deleteSonarrEpisodes(files.map(f => f.id || -1)).then(() => (sonarrFiles = getFiles(sonarrItem)))
		});
	}

	function createConfirmCancelDownloadsDialog(downloads: EpisodeDownload[]) {
		createModal(ConfirmDialog, {
			header: 'Cancel Season Downloads?',
			body: `Are you sure you want to cancel all ${downloads.length} download(s) from season ${downloads[0]?.seasonNumber}?`,
			confirm: () =>
				sonarrApi.cancelDownloads(downloads.map(d => d.id || -1)).then(() => (sonarrDownloads = getDownloads(sonarrItem)))
		});
	}
  </script>
  

<DetachedPage let:handleGoBack let:registrar>
	<ScrollHelper bind:scrollTop />
	<div class="relative">
		<Container
			class="h-[calc(100vh-4rem)] flex flex-col py-16 px-32"
			on:enter={scrollIntoView({ top: 0 })}
			on:navigate={({ detail }) => {
				if (detail.direction === 'down' && detail.willLeaveContainer) {
					$episodeCards?.focus();
					detail.preventNavigation();
				}
			}}
		>
		<HeroCarousel
		urls={$tmdbSeries.then((series) => {
			const sortedBackdrops = series?.images.backdrops
				?.sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0))
				?.map((i) => ({
					trailerUrl: '',
					backdropUrl: TMDB_IMAGES_ORIGINAL + i.file_path
				}))
				.slice(0, 5) || [];	
			return sortedBackdrops;
		})}
			>
				<Container />
				<div class="h-full flex-1 flex flex-col justify-end">
					{#await $tmdbSeries then series}
						{#if series}
							<div
								class={classNames(
									'text-left font-medium tracking-wider text-stone-200 hover:text-amber-200 mt-2',
									{
										'text-4xl sm:text-5xl 2xl:text-6xl': series.name?.length || 0 < 15,
										'text-3xl sm:text-4xl 2xl:text-5xl': series.name?.length || 0 >= 15
									}
								)}
							>
								{series.name}
							</div>
							<div
								class="flex items-center gap-1 uppercase text-zinc-300 font-semibold tracking-wider mt-2 text-lg"
							>
								<p class="flex-shrink-0">
									{#if series.status !== 'Ended'}
										Since {new Date(series.first_air_date || Date.now())?.getFullYear()}
									{:else}
										Ended {new Date(series.last_air_date || Date.now())?.getFullYear()}
									{/if}
								</p>
								<!-- <DotFilled />
								<p class="flex-shrink-0">{movie.runtime}</p> -->
								<DotFilled />
								<p class="flex-shrink-0">
									<a href={'https://www.themoviedb.org/movie/' + series.id}
										>{series.vote_average} TMDB</a>
								</p>
								 {#if $requestedSeasons.length > 0}
								 <div class="py-0.10 px-3 rounded-lg" style="color: white; background-color: #ffa500; border-radius: 20px; display: inline-block; font-size: 0.75rem;">
									 {formatRequestedSeasons($requestedSeasons)}
								 </div>
							 {/if}
							</div>
							<div
								class="text-stone-300 font-medium line-clamp-3 opacity-75 max-w-4xl mt-4 text-lg"
							>
								{series.overview}
							</div>
						{/if}
					{/await}
					{#await nextJellyfinEpisode then nextJellyfinEpisode}
						<Container
							direction="horizontal"
							class="flex mt-8"
							focusOnMount
							on:back={handleGoBack}
							on:mount={registrar}
						>
							{#if nextJellyfinEpisode}
								<Button
									class="mr-4"
									on:clickOrSelect={() =>
										nextJellyfinEpisode?.Id && playerState.streamJellyfinId(nextJellyfinEpisode.Id)}
								>
									Play Season {nextJellyfinEpisode?.ParentIndexNumber} Episode
									{nextJellyfinEpisode?.IndexNumber}
									<Play size={19} slot="icon" />
								</Button>
							{/if}
							<Button class="mr-4" on:clickOrSelect={() => handleRequestSeason()}>
									Request
									<Plus size={19} slot="icon" />
							</Button>
							

							{#if PLATFORM_WEB}
								<Button class="mr-4">
									Open In TMDB
									<ExternalLink size={19} slot="icon-after" />
								</Button>
								<Button class="mr-4">
									Open In Jellyfin
									<ExternalLink size={19} slot="icon-after" />
								</Button>
							{/if}
						</Container>
					{/await}
				</div>
			</HeroCarousel>
		</Container>
		<div
			class={classNames('transition-opacity', {
				// 'opacity-0': hideInterface
			})}
		>
			<EpisodeGrid
				on:enter={scrollIntoView({ top: -32, bottom: 128 })}
				on:mount={episodeCards.registrar}
				id={Number(id)}
				tmdbSeries={tmdbSeriesData}
				{jellyfinEpisodes}
				currentJellyfinEpisode={nextJellyfinEpisode}
				{handleRequestSeason}
			/>
			<Container on:enter={scrollIntoView({ top: 0 })} class="pt-8">
				{#await $tmdbSeries then series}
					<Carousel scrollClass="px-32" class="mb-8">
						<div slot="header">Show Cast</div>
						{#each series?.aggregate_credits?.cast?.slice(0, 15) || [] as credit}
							<TmdbPersonCard on:enter={scrollIntoView({ horizontal: 128 })} tmdbCredit={credit} />
						{/each}
					</Carousel>
				{/await}
				{#await $recommendations then recommendations}
					<Carousel scrollClass="px-32" class="mb-8">
						<div slot="header">Recommendations</div>
						{#each recommendations || [] as recommendation}
							<TmdbCard item={recommendation} on:enter={scrollIntoView({ horizontal: 128 })} />
						{/each}
					</Carousel>
				{/await}
			</Container>
			{#await $tmdbSeries then series}
				<Container class="flex-1 bg-secondary-950 pt-8 px-32" on:enter={scrollIntoView({ top: 0 })}>
					<h1 class="font-medium tracking-wide text-2xl text-zinc-300 mb-8">More Information</h1>
					<div class="text-zinc-300 font-medium text-lg flex flex-wrap">
						<div class="flex-1">
							<div class="mb-8">
								<h2 class="uppercase text-sm font-semibold text-zinc-500 mb-0.5">Created By</h2>
								{#each series?.created_by || [] as creator}
									<div>{creator.name}</div>
								{/each}
							</div>
							<div class="mb-8">
								<h2 class="uppercase text-sm font-semibold text-zinc-500 mb-0.5">Network</h2>
								<div>{series?.networks?.[0]?.name}</div>
							</div>
						</div>
						<div class="flex-1">
							<div class="mb-8">
								<h2 class="uppercase text-sm font-semibold text-zinc-500 mb-0.5">Language</h2>
								<div>{series?.spoken_languages?.[0]?.name}</div>
							</div>
							<div class="mb-8">
								<h2 class="uppercase text-sm font-semibold text-zinc-500 mb-0.5">Last Air Date</h2>
								<div>{series?.last_air_date}</div>
							</div>
						</div>
					</div>
				</Container>
			{/await}
			{#await Promise.all( [sonarrSeasonNumbers, sonarrFiles, sonarrEpisodes, sonarrDownloads] ) then [seasons, files, episodes, downloads]}
				{#if files?.length}
					<Container
						class="flex-1 bg-secondary-950 pt-8 pb-16 px-32 flex flex-col"
						on:enter={scrollIntoView({ top: 32 })}
					>
						<!--						<h1 class="font-medium tracking-wide text-2xl text-zinc-300 mb-8">Local Files</h1>-->
						<div class="space-y-16">
							{#each seasons as season}
								{@const seasonEpisodes = episodes.filter((e) => e.seasonNumber === season)}
								{@const seasonFiles = files.filter((f) => f.seasonNumber === season)}
								{@const seasonDownloads = downloads.filter((d) => d.seasonNumber === season)}

								<div>
									<div class="flex justify-between">
										<h2 class="font-medium tracking-wide text-2xl text-zinc-300 mb-8">
											Season {season} Files
										</h2>
									</div>

									<Container direction="grid" gridCols={2} class="grid grid-cols-2 gap-8">
										{#each seasonEpisodes as episode}
											{@const file = seasonFiles.find((f) => f.id === episode.episodeFileId)}
											{@const download = seasonDownloads.find((d) => d.episodeId === episode.id)}

											<Container
												class={classNames(
													'flex space-x-8 items-center text-zinc-300 font-medium relative overflow-hidden',
													'px-8 py-4 border-2 border-transparent rounded-xl',
													{
														'bg-secondary-800 focus-within:bg-primary-700 focus-within:border-primary-500': true,
														'hover:bg-primary-700 hover:border-primary-500 cursor-pointer': true
														// 'bg-primary-700 focus-within:border-primary-500': selected,
														// 'bg-secondary-800 focus-within:border-zinc-300': !selected
													}
												)}
												on:clickOrSelect={() => {
													if (file)
														modalStack.create(FileDetailsDialog, {
															file,
															title: episode?.title || '',
															subtitle: `Season ${episode?.seasonNumber} Episode ${episode?.episodeNumber}`,
															backgroundUrl: episode?.images?.[0]?.remoteUrl || '',
															onDelete: () => (sonarrFiles = getFiles(sonarrItem))
														});
													else if (download)
														modalStack.create(DownloadDetailsDialog, {
															download,
															title: episode?.title || '',
															subtitle: `Season ${episode?.seasonNumber} Episode ${episode?.episodeNumber}`,
															backgroundUrl: episode?.images?.[0]?.remoteUrl || '',
															onCancel: () => (sonarrDownloads = getDownloads(sonarrItem))
														});
												}}
												on:enter={scrollIntoView({ vertical: 128 })}
												focusOnClick
											>
												{#if download}
													<div
														class="absolute inset-0 bg-secondary-50/10"
														style={`width: ${
															(((download.size || 0) - (download.sizeleft || 0)) /
																(download.size || 1)) *
															100
														}%`}
													/>
												{/if}
												<div class="flex-1">
													<h1 class="text-lg">
														{episode?.episodeNumber}. {episode?.title}
													</h1>
												</div>
												{#if file}
													<div>
														{file?.mediaInfo?.runTime}
													</div>
													<div>
														{formatSize(file?.size || 0)}
													</div>
													<div>
														{file?.quality?.quality?.name}
													</div>
												{:else if download}
													<div>
														{formatSize((download?.size || 0) - (download?.sizeleft || 1))} / {formatSize(
															download?.size || 0
														)}
													</div>
													<div>
														{download?.quality?.quality?.name}
													</div>
												{/if}
											</Container>
										{/each}
									</Container>
									<Container direction="horizontal" class="flex mt-8">
										{#if seasonFiles?.length}
											<Button on:clickOrSelect={() => createConfirmDeleteSeasonDialog(seasonFiles)}>
												<Trash size={19} slot="icon" />
												Delete Season Files
											</Button>
										{/if}
										{#if seasonDownloads?.length}
											<Button
												on:clickOrSelect={() => createConfirmCancelDownloadsDialog(seasonDownloads)}
											>
												<Cross1 size={19} slot="icon" />
												Cancel Season Downloads
											</Button>
										{/if}
									</Container>
								</div>
							{/each}
						</div>
					</Container>
				{/if}
			{/await}
		</div>
	</div>
</DetachedPage>
