<script lang="ts">
  import Container from '../../../Container.svelte';
  import Button from '../Button.svelte';
  import { reiverrApi } from '../../apis/reiverr/reiverr-api';
  import { tmdbApi } from '../../apis/tmdb/tmdb-api';
  import { writable } from 'svelte/store';
  import { Check, Cross1, EyeOpen, CountdownTimer } from 'radix-icons-svelte';
  import { user } from '../../stores/user.store';
  import { navigate } from '../StackRouter/StackRouter';
  import { formatTimeAgo } from '../../utils';
  import { scrollIntoView } from '../../selectable';
  import { getMediaProgress } from './progressManager';
  import { handleMovieDownload } from '../MediaManagerAuto/AutoDownloadManagerMovie';
  import { handleSeriesDownload } from '../MediaManagerAuto/AutoDownloadManagerSerie';
  import { getOrAddSeriesToSonarr } from '../MediaManagerAuto/addSerieToSonarrAutomatically';
  import { getOrAddMovieToRadarr } from '../MediaManagerAuto/addMovieToRadarrAutomatically';

  interface Request {
    id: number;
    user_id: string;
    media_id: number;
    media_type: number;
    status: 'Approved' | 'Declined' | 'Pending';
    created_at: string;
    updated_at?: string;
    season?: number;
  }

  interface Movie {
    title?: string;
    name?: string;
    release_date?: string;
    first_air_date?: string;
    poster_path?: string;
  }

  export let request: Request;
  export let requests: Request[];

  let movie: Movie | null = null;
  let posterUrl = '';
  let requestStatus = writable(request.status);
  let isDeleted = writable(false);
  let connectedUser = $user;
  let loadingMessage = writable('');
  let requestUser = writable({ name: 'Unknown User', profilePicture: '' });

  function setLoadingMessage(step: string) {
    loadingMessage.set(step);
  }

  function handleError(message: string) {
    console.error(message);
    loadingMessage.set('');
  }

  async function fetchMediaAndUserDetails() {
    try {
      const fetchFunction = request.media_type === 0 ? tmdbApi.getTmdbMovie : tmdbApi.getTmdbSeries;
      const [media, { user, error }] = await Promise.all([
        fetchFunction(request.media_id),
        reiverrApi.fetchRequestUser(request.user_id),
      ]);

      movie = media || { title: "Unknown media" };
      posterUrl = `https://image.tmdb.org/t/p/w200${movie.poster_path || ''}`;

      if (!error) {
        requestUser.set(user);
      } else {
        console.error('Error fetching user info:', error);
      }

      //await downloadInfo();
    } catch (error) {
      handleError('Error fetching media or user data.');
    }
  }

  async function downloadInfo() {
    try {
      const downloadInfo = await getMediaProgress(
        request.media_id,
        request.media_type,
        request.media_type === 1 ? request.season : undefined
      );

      if (downloadInfo) {
        console.log(`Progress for media ID: ${request.media_id}, Progress: ${downloadInfo.progress}%, Time left: ${downloadInfo.timeLeft}`);
      }
    } catch (error) {
      console.error(`Error fetching media progress: ${error.message}`);
    }
  }

  async function updateRequestStatus(status: 'Approved' | 'Declined') {
    try {
      if (status === 'Approved') {
        if (request.media_type === 0) {
          const tmdbMovie = await tmdbApi.getTmdbMovie(request.media_id);
          if (tmdbMovie) {
            const radarrItem = await getOrAddMovieToRadarr(
              tmdbMovie.id,
              tmdbMovie.title || 'Unknown',
              () => console.log(`Movie ${tmdbMovie.title} added to Radarr successfully`)
            );

            if (radarrItem) {
              await handleMovieDownload(radarrItem.id, setLoadingMessage, handleError);
            } else {
              handleError('Failed to add or retrieve movie from Radarr');
            }
          } else {
            handleError('Failed to retrieve movie information from TMDb');
          }

        } else if (request.media_type === 1 && request.season !== null) {
          const tmdbSeries = await tmdbApi.getTmdbSeries(request.media_id);

          if (tmdbSeries) {
            const sonarrItem = await getOrAddSeriesToSonarr(
              tmdbSeries.id,
              tmdbSeries.name || tmdbSeries.title || 'Title',
              () => console.log(`Series ${tmdbSeries.name || tmdbSeries.title} added to Sonarr successfully`)
            );

            if (sonarrItem) {
              await handleSeriesDownload(sonarrItem.id, request.season, setLoadingMessage, handleError);
            } else {
              handleError('Failed to add or retrieve series from Sonarr');
            }
          } else {
            handleError('Failed to retrieve series information from TMDb');
          }

        } else {
          handleError('Invalid media type or missing season for series');
        }
      }

      const response = await reiverrApi.updateRequest(request.id, { status });
      if (response) {
        requestStatus.set(status);
        loadingMessage.set('');
      } else {
        handleError('Failed to update the request status.');
      }

    } catch (error) {
      handleError(`Error updating request to ${status}: ${error}`);
    }
  }

  async function deleteRequest() {
    isDeleted.set(true);
    try {
      const response = await reiverrApi.deleteRequest(request.id);

      if (response?.message === 'Request successfully deleted') {
        requests = requests.filter((req) => req.id !== request.id);
      } else {
        throw new Error('Failed to delete request');
      }
    } catch (error) {
      handleError(`Error deleting request: ${error}`);
    }
  }

  function viewMediaPage() {
    if (request.media_type === 0) {
      navigate(`/movie/${request.media_id}`);
    } else if (request.media_type === 1) {
      navigate(`/series/${request.media_id}`);
    } else {
      console.error(`Unknown media type: ${request.media_type}`);
    }
  }

  fetchMediaAndUserDetails();
</script>

{#if !$isDeleted}
  <Container class="bg-primary-800 rounded-lg mb-4 p-4 flex flex-col md:flex-row items-center md:items-center">


    <div class="poster-container flex-shrink-0 mb-4 md:mb-0 md:mr-6">
      {#if posterUrl}
        <img
          src={posterUrl}
          alt="Movie Poster"
          class="poster-image object-cover rounded-lg shadow-lg"
          width="100"
          height="150"
        />
      {:else}
        <div class="loading-placeholder poster-placeholder"></div>
      {/if}
    </div>


    <div class="movie-info flex-3 mb-4 md:mb-0">
      {#if movie?.release_date || movie?.first_air_date}
        <p class="release-date text-secondary-400">{new Date(movie.release_date || movie.first_air_date).getFullYear()}</p>
      {:else}
        <div class="loading-placeholder release-date-placeholder mb-2"></div>
      {/if}
      {#if movie?.title || movie?.name}
        <h3 class="movie-title font-bold text-lg">{movie?.title || movie?.name}</h3>
      {:else}
        <div class="loading-placeholder movie-title-placeholder mb-2"></div>
      {/if}
      {#if request.media_type === 1 && request.season !== null}
        <p class="season">Season {request.season}</p>
      {/if}
    </div>



    <div class="request-details flex-2 mb-4 md:mb-0 md:ml-auto">
      <div class="status-container flex items-center gap-2 mb-2">
        <div class="status-label text-secondary-400">Status</div>
        <div
          class="status-box"
          class:approved={$requestStatus === 'Approved'}
          class:declined={$requestStatus === 'Declined'}
          class:pending={$requestStatus === 'Pending'}
        >
          {$requestStatus}
        </div>
      </div>
      <p class="requested text-secondary-400">Requested {formatTimeAgo(new Date(request.created_at))} ago</p>
      {#if connectedUser?.isAdmin}
        <div class="user-info flex items-center gap-2 mt-2">
          <p class="by text-secondary-400">by</p>
          {#if $requestUser.profilePicture}
            <img src={$requestUser.profilePicture} alt="Profile Picture" class="user-picture" />
          {:else}
            <div class="loading-placeholder user-picture-placeholder"></div>
          {/if}
          {#if $requestUser.name}
            <p class="user-name text-secondary-400">{$requestUser.name}</p>
          {:else}
            <div class="loading-placeholder user-name-placeholder"></div>
          {/if}
        </div>
      {/if}
    </div>



    <div class="buttons-container flex-shrink-0 flex flex-col space-y-4 w-full pl-3">
      {#if $loadingMessage}
        <p class="loading-message text-primary-500">{$loadingMessage}</p>
      {:else}
        {#if connectedUser?.isAdmin}
          {#if $requestStatus !== 'Approved' && $requestStatus !== 'Declined'}
            <Button
              class="buttonRequest small-button w-full same-size-button"
              type="primary-dark"
              on:clickOrSelect={() => updateRequestStatus('Approved')}
              on:enter={scrollIntoView({ vertical: 128 })}
              icon={Check}
            >
              Accept
            </Button>
            <Button
              class="buttonRequest small-button w-full same-size-button"
              type="primary-dark"
              on:clickOrSelect={() => updateRequestStatus('Declined')}
              on:enter={scrollIntoView({ vertical: 128 })}
              icon={Cross1}
            >
              Decline
            </Button>
          {/if}
          {#if $requestStatus === 'Approved' || $requestStatus === 'Declined'}
            {#if $requestStatus === 'Declined'}
              <Button
                class="buttonRequest small-button w-full same-size-button"
                type="primary-dark"
                on:clickOrSelect={() => updateRequestStatus('Approved')}
                on:enter={scrollIntoView({ vertical: 128 })}
                icon={CountdownTimer}
              >
                Undo
              </Button>
            {/if}
            {#if $requestStatus === 'Approved'}
              <Button
                class="buttonRequest small-button w-full same-size-button"
                type="primary-dark"
                on:clickOrSelect={viewMediaPage}
                on:enter={scrollIntoView({ vertical: 128 })}
                icon={EyeOpen}
              >
                View media page
              </Button>
            {/if}
            <Button
              class="buttonRequest small-button w-full same-size-button"
              type="primary-dark"
              on:clickOrSelect={deleteRequest}
              on:enter={scrollIntoView({ vertical: 128 })}
              icon={Cross1}
            >
              Delete
            </Button>
          {/if}
        {:else}
          {#if $requestStatus === 'Approved' || $requestStatus === 'Declined'}
            <Button
              class="buttonRequest small-button w-full same-size-button"
              type="primary-dark"
              on:clickOrSelect={viewMediaPage}
              on:enter={scrollIntoView({ vertical: 128 })}
              icon={EyeOpen}
            >
              View movie page
            </Button>
          {/if}
          {#if $requestStatus === 'Pending'}
            <Button
              class="buttonRequest small-button w-full same-size-button"
              type="primary-dark"
              on:clickOrSelect={deleteRequest}
              on:enter={scrollIntoView({ vertical: 128 })}
              icon={Cross1}
            >
              Cancel
            </Button>
          {/if}
        {/if}
      {/if}
    </div>
  </Container>
{/if}

<style>
  .loading-placeholder {
    background-color: rgb(24, 22, 16);
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0% {
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
    100% {
      opacity: 1;
    }
  }

  /* Poster Styles */
  .poster-container {
    width: 100px;
    height: 150px;
  }

  .poster-image {
    width: 100px;
    height: 150px;
    object-fit: cover;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .poster-placeholder {
    width: 100px;
    height: 150px;
    border-radius: 8px;
  }

  .movie-info {
    flex: 3;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .release-date-placeholder {
    width: 80px;
    height: 16px;
    border-radius: 4px;
  }

  .movie-title {
    font-size: 1.125rem;
  }

  .movie-title-placeholder {
    width: 60%;
    height: 1.5rem;
    border-radius: 4px;
    background-color: rgb(24, 22, 16);
    margin-bottom: 0.5rem;
  }

  .season {
    color: inherit;
  }

  .request-details {
    flex: 2;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .status-container {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .status-label {
    color: #a0aec0;
  }

  .status-box {
    border-radius: 20px;
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    color: white;
  }

  .status-box.approved {
    background-color: #29a458;
    border: 2px solid #22c55d;
  }

  .status-box.declined {
    background-color: #bd2c2c;
    border: 2px solid #ef4444;
  }

  .status-box.pending {
    background-color: #c69921;
    border: 2px solid #ebb20c;
  }

  .requested {
    color: #a0aec0;
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .by {
    color: #a0aec0;
  }

  .user-picture {
    width: 1.5rem;
    height: 1.5rem;
    object-fit: cover;
    border-radius: 9999px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .user-picture-placeholder {
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 9999px;
    background-color: rgb(24, 22, 16);
  }

  .user-name {
    color: #a0aec0;
  }

  .user-name-placeholder {
    width: 6rem;
    height: 1rem;
    border-radius: 4px;
    background-color: rgb(24, 22, 16);
  }

  .buttons-container {
    display: flex;
    flex-direction: column;
    width: 100%;
    flex: 2;
    justify-content: flex-start;
  }

  .buttonRequest {
    padding: 1rem 0.5rem;
    margin-bottom: 0.5rem;
    width: 100%;
    height: 3rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .same-size-button {
    height: 3rem;
  }

  .loading-message {
    text-align: center;
  }
</style>
