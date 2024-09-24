<script lang="ts">
	import Container from '../../Container.svelte';
	import HeroCarousel from '../components/HeroCarousel/HeroCarousel.svelte';
	import { tmdbApi } from '../apis/tmdb/tmdb-api';
	import { PLATFORM_WEB, TMDB_IMAGES_ORIGINAL } from '../constants';
	import classNames from 'classnames';
	import { Cross1, DotFilled, ExternalLink, Play, Plus, Trash } from 'radix-icons-svelte';
	import Button from '../components/Button.svelte';
	import { jellyfinApi } from '../apis/jellyfin/jellyfin-api';
	import { radarrApi } from '../apis/radarr/radarr-api';
	import { useRequest } from '../stores/data.store';
	import DetachedPage from '../components/DetachedPage/DetachedPage.svelte';
	import { createModal, modalStack } from '../components/Modal/modal.store';
	import { playerState } from '../components/VideoPlayer/VideoPlayer';
	import { scrollIntoView } from '../selectable';
	import Carousel from '../components/Carousel/Carousel.svelte';
	import TmdbPersonCard from '../components/PersonCard/TmdbPersonCard.svelte';
	import TmdbCard from '../components/Card/TmdbCard.svelte';
	import FileDetailsDialog from '../components/SeriesPage/FileDetailsDialog.svelte';
	import DownloadDetailsDialog from '../components/SeriesPage/DownloadDetailsDialog.svelte';
	import { capitalize, formatSize } from '../utils';
	import ConfirmDialog from '../components/Dialog/ConfirmDialog.svelte';
	import { TMDB_BACKDROP_SMALL } from '../constants.js';
	import { user } from '../stores/user.store';
	import { reiverrApi } from '../apis/reiverr/reiverr-api'; 
	import { get } from 'svelte/store';
	import { generalSettings } from '../stores/generalSettings.store';
	import { handleMovieDownload } from '../components/MediaManagerAuto/AutoDownloadManagerMovie';
	import SpinnerModal from '../components/SpinnerModal.svelte';
	import { writable } from 'svelte/store';
	import { createMovieApprovedRequest, createMovieRequest } from '../components/Requests/requestActions';
	import { getOrAddMovieToRadarr } from '../components/MediaManagerAuto/addMovieToRadarrAutomatically'; 
	

	export let id: string;
	const tmdbId = Number(id);

	// Utilise des versions plus légères des images pour optimiser la bande passante
	let tmdbMovie = tmdbApi.getTmdbMovie(tmdbId, { imageSize: 'w500' });
	let recommendations = tmdbApi.getMovieRecommendations(tmdbId);
	const jellyfinItemP = useRequest(() => jellyfinApi.getLibraryItemFromTmdbId(id), id).promise;
	let radarrItem = radarrApi.getMovieByTmdbId(tmdbId);
	let radarrDownloads = [];
	let radarrFiles = [];
	let requestExists = writable(false);
	let pendingRequest = writable(false);
	const loadingMessage = writable('');
	const allowRequests = writable(true);
	let requestedMovies = writable<boolean>(false);


	function logError(message: string, error?: any) {
		console.error(message, error);
		return [];
	}

	async function fetchMediaData(item) {
		try {
			const files = item ? await radarrApi.getFilesByMovieId(item.id || -1) : [];
			const downloads = item ? await radarrApi.getDownloadsById(item.id || -1) : [];
			return { files, downloads };
		} catch (error) {
			logError('Error fetching media data', error);
			return { files: [], downloads: [] };
		}
	}

	(async () => {
  try {
    const existingRequests = await reiverrApi.getRequestsByMediaId(tmdbId);
    requestExists = existingRequests.length > 0;
    pendingRequest = existingRequests.some(request => request.status === 'Pending');
    if (pendingRequest) {
      requestedMovies.set(true);
    } else {
      requestedMovies.set(false);
    }
  } catch (error) {
    console.error('Error fetching data:', error);
  }
})();

	async function handleRequest() {
	const currentUser = get(user);
	try {
		const tmdbMovie = await tmdbApi.getTmdbMovie(tmdbId);
		if (currentUser?.isAdmin) {
			await handleMovieDownloadWithModal(tmdbMovie, loadingMessage);
		} else {
			const userId = currentUser?.id;
			const { data: { requests } } = get(generalSettings);
			const userRequestCount = await reiverrApi.countRequestsInPeriodForUser(userId, requests.delayInDays ?? 7);
			const remainingRequests = (requests.defaultLimitMovies ?? 5) - userRequestCount;

			if (remainingRequests > 0) {
				createConfirmQuotaDialog(remainingRequests, requests.delayInDays, requests.defaultLimitMovies, tmdbMovie);
			} else {
				createConfirmRequestDialog();
			}
		}
	} catch (error) {
		logError('Error handling request', error);
	}
}

	async function handleMovieDownloadWithModal(movie, loadingMessage) {
		createModal(SpinnerModal, {
			title: 'Processing Movie Download',
			progressMessage: loadingMessage
		});

		try {
			loadingMessage.set("(1/2) Search movie in library");
			const radarrItem = await getOrAddMovieToRadarr(movie.id, movie.title);

			if (!radarrItem || !radarrItem.id) throw new Error('Radarr item not found');

			await handleMovieDownload(
				radarrItem.id,
				message => loadingMessage.set(message),
				error => logError('Error during download process: ', error)
			);

			const result = await createMovieApprovedRequest(get(user).id, movie.id, 0);
			if (result.success) {
				requestExists = true;
				pendingRequest = false;
				loadingMessage.set('Process completed');
				setTimeout(() => modalStack.closeTopmost(), 1000);
			} else {
				throw new Error('Request creation failed');
			}
		} catch (error) {
			logError('Error during download process', error);
		} finally {
			setTimeout(() => modalStack.closeTopmost(), 1000);
		}
	}

	function createConfirmQuotaDialog(requestsRemaining, days, maxRequests, movie) {
		createModal(ConfirmDialog, {
			header: 'Confirm Automatic Download',
			body: `You have ${requestsRemaining}/${maxRequests} requests remaining. Requests reset every ${days} days.`,
			confirm: () => handleMovieDownloadWithModal(movie, loadingMessage)
		});
	}

	function createConfirmRequestDialog() {
		createModal(ConfirmDialog, {
			header: 'Confirm Request',
			body: 'Do you want to request this movie? An administrator must approve it.',
			confirm: createRequest
		});
	}

	async function createRequest() {
	try {
		const result = await createMovieRequest(tmdbId, get(user));
		if (result.success) {
			requestedMovies.set(true);
		} else {
			throw new Error('Request creation failed');
		}
	} catch (error) {
		logError('Error confirming request creation', error);
	}
}

</script>
  
  <DetachedPage let:handleGoBack let:registrar>
	<div class="relative">
	  <Container class="h-[calc(100vh-4rem)] flex flex-col py-16 px-32" on:enter={scrollIntoView({ top: 999 })}>
		<HeroCarousel
		  urls={tmdbMovie.then((movie) => {
			const sortedBackdrops = movie?.images.backdrops
			  ?.sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0))
			  ?.map((bd) => ({
				trailerUrl: '',
				backdropUrl: TMDB_IMAGES_ORIGINAL + bd.file_path
			  }))
			  .slice(0, 5) || [];
			return sortedBackdrops;
		  })}
		>
		  <Container />
		  <div class="h-full flex-1 flex flex-col justify-end">
			{#await tmdbMovie then movie}
			  {#if movie}
				<div class={classNames('text-left font-medium tracking-wider text-stone-200 hover:text-amber-200 mt-2 ', {
				  'text-4xl sm:text-5xl 2xl:text-6xl': movie.title?.length || 0 < 15,
				  'text-3xl sm:text-4xl 2xl:text-5xl': movie?.title?.length || 0 >= 15
				})}>
				  {movie?.title} 
				</div>
				<div class="flex items-center gap-1 uppercase text-zinc-300 font-semibold tracking-wider mt-2 text-lg">
				  <p class="flex-shrink-0">{new Date(movie.release_date || Date.now())?.getFullYear()}</p>
				  <DotFilled />
				  <p class="flex-shrink-0">
					<a href={'https://www.themoviedb.org/movie/' + movie.id}>{movie.vote_average?.toFixed(1)} TMDB</a>
					{#if $requestedMovies}
						<div class="py-0.10 px-3 rounded-lg" style="color: white; background-color: #ffa500; border-radius: 20px; display: inline-block; font-size: 0.75rem;">
							requested
						</div>
					{/if}
				  </p>
				</div>
				<div class="text-stone-300 font-medium line-clamp-3 opacity-75 max-w-4xl mt-4">{movie.overview}</div>
			  {/if}
			{/await}
			{#await Promise.all([$jellyfinItemP]) then [jellyfinItem]}
			  <Container direction="horizontal" class="flex mt-8" focusOnMount on:back={handleGoBack} on:mount={registrar}>
				{#if jellyfinItem}
				  <Button class="mr-4" on:clickOrSelect={() => jellyfinItem.Id && playerState.streamJellyfinId(jellyfinItem.Id)}>
					Play
					<Play size={19} slot="icon" />
				  </Button>
				{/if}
				{#if !jellyfinItem && !$requestedMovies}
				<Button
						class="mr-4"
						on:clickOrSelect={handleRequest}
						disabled={!$allowRequests}
						style="opacity: {$allowRequests ? 1 : 0.5}; cursor: {$allowRequests ? 'pointer' : 'not-allowed'};">
						Request
						<Plus size={19} slot="icon" />
					</Button>
				{/if}
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
  
	  <!-- Additional Content: Cast, Recommendations, and More -->
	  <Container on:enter={scrollIntoView({ top: 0 })} class="">
		{#await tmdbMovie then movie}
		  <Carousel scrollClass="px-32" class="mb-8">
			<div slot="header">Show Cast</div>
			{#each movie?.credits?.cast?.slice(0, 15) || [] as credit}
			  <TmdbPersonCard on:enter={scrollIntoView({ horizontal: 128 })} tmdbCredit={credit} />
			{/each}
		  </Carousel>
		{/await}
		{#await recommendations then recommendations}
		  <Carousel scrollClass="px-32" class="mb-8">
			<div slot="header">Recommendations</div>
			{#each recommendations || [] as recommendation}
			  <TmdbCard item={recommendation} on:enter={scrollIntoView({ horizontal: 128 })} />
			{/each}
		  </Carousel>
		{/await}
	  </Container>
	  {#await tmdbMovie then movie}
		<Container class="flex-1 bg-secondary-950 pt-8 px-32" on:enter={scrollIntoView({ top: 0 })}>
		  <h1 class="font-medium tracking-wide text-2xl text-zinc-300 mb-8">More Information</h1>
		  <div class="text-zinc-300 font-medium text-lg flex flex-wrap">
			<div class="flex-1">
			  <div class="mb-8">
				<h2 class="uppercase text-sm font-semibold text-zinc-500 mb-0.5">Directed By</h2>
				<div>
				  {movie?.credits.crew
					?.filter((c) => c.job === 'Director')
					?.map((c) => c.name)
					.join(', ')}
				</div>
			  </div>
			  <div class="mb-8">
				<h2 class="uppercase text-sm font-semibold text-zinc-500 mb-0.5">Written By</h2>
				<div>
				  {movie?.credits.crew
					?.filter((c) => c.job === 'Writer')
					?.map((c) => c.name)
					.join(', ')}
				</div>
			  </div>
			</div>
			<div class="flex-1">
			  <div class="mb-8">
				<h2 class="uppercase text-sm font-semibold text-zinc-500 mb-0.5">Languages</h2>
				<div>
				  {movie?.spoken_languages?.map((language) => language.name).join(', ')}
				</div>
			  </div>
			  <div class="mb-8">
				<h2 class="uppercase text-sm font-semibold text-zinc-500 mb-0.5">Release Date</h2>
				<div>
				  {new Date(movie?.release_date || 0).toLocaleDateString('en-US', {
					year: 'numeric',
					month: 'short',
					day: 'numeric'
				  })}
				</div>
			  </div>
			</div>
		  </div>
		</Container>
	  {/await}
	  {#await Promise.all([tmdbMovie, radarrFiles, radarrDownloads]) then [movie, files, downloads]}
		{#if files?.length || downloads?.length}
		  <Container class="flex-1 bg-secondary-950 pt-8 pb-16 px-32 flex flex-col" on:enter={scrollIntoView({ top: 32 })}>
			<h1 class="font-medium tracking-wide text-2xl text-zinc-300 mb-8">Local Files</h1>
			<div class="space-y-8">
			  <Container direction="grid" gridCols={2} class="grid grid-cols-2 gap-8">
				{#each downloads as download}
				  <Container
					class={classNames(
					  'flex space-x-8 items-center text-zinc-300 font-medium relative overflow-hidden',
					  'px-8 py-4 border-2 border-transparent rounded-xl',
					  {
						'bg-secondary-800 focus-within:bg-primary-700 focus-within:border-primary-500': true,
						'hover:bg-primary-700 hover:border-primary-500 cursor-pointer': true
					  }
					)}
					on:clickOrSelect={() =>
					  modalStack.create(DownloadDetailsDialog, {
						download,
						title: movie?.title || '',
						subtitle: download.title || '',
						backgroundUrl: TMDB_BACKDROP_SMALL + movie?.backdrop_path || '',
						onCancel: () => (radarrDownloads = getDownloads(radarrItem))
					  })
					}
					on:enter={scrollIntoView({ vertical: 128 })}
					focusOnClick
				  >
					<div
					  class="absolute inset-0 bg-secondary-50/10"
					  style={`width: ${
						(((download.size || 0) - (download.sizeleft || 0)) / (download.size || 1)) * 100
					  }%`}
					/>
					<div class="flex-1">
					  <h1 class="text-lg">
						{capitalize(download.status || movie?.title || '')}
					  </h1>
					</div>
  
					<div>
					  {formatSize((download?.size || 0) - (download?.sizeleft || 1))} / {formatSize(download?.size || 0)}
					</div>
					<div>
					  {download?.quality?.quality?.name}
					</div>
				  </Container>
				{/each}
				{#each files as file}
				  <Container
					class={classNames(
					  'flex space-x-8 items-center text-zinc-300 font-medium relative overflow-hidden',
					  'px-8 py-4 border-2 border-transparent rounded-xl',
					  {
						'bg-secondary-800 focus-within:bg-primary-700 focus-within:border-primary-500': true,
						'hover:bg-primary-700 hover:border-primary-500 cursor-pointer': true
					  }
					)}
					on:clickOrSelect={() =>
					  modalStack.create(FileDetailsDialog, {
						file,
						title: movie?.title || '',
						subtitle: file.relativePath || '',
						backgroundUrl: TMDB_BACKDROP_SMALL + movie?.backdrop_path || '',
						onDelete: () => (radarrFiles = getFiles(radarrItem))
					  })
					}
					on:enter={scrollIntoView({ vertical: 128 })}
					focusOnClick
				  >
					<div class="flex-1">
					  <h1 class="text-lg">
						{file?.quality?.quality?.name}
					  </h1>
					</div>
					<div>
					  {file?.mediaInfo?.runTime}
					</div>
					<div>
					  {formatSize(file?.size || 0)}
					</div>
				  </Container>
				{/each}
			  </Container>
			  <Container direction="horizontal" class="flex mt-0">
				{#if files?.length}
				  <Button on:clickOrSelect={() => createConfirmDeleteSeasonDialog(files)}>
					<Trash size={19} slot="icon" />
					Delete All Files
				  </Button>
				{/if}
				{#if downloads?.length}
				  <Button on:clickOrSelect={() => createConfirmCancelDownloadsDialog(downloads)}>
					<Cross1 size={19} slot="icon" />
					Cancel All Downloads
				  </Button>
				{/if}
			  </Container>
			</div>
		  </Container>
		{/if}
	  {/await}
	</div>
  </DetachedPage>
  