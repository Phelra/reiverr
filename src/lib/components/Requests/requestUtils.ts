// requestUtils.ts

import { createModal, modalStack } from '../Modal/modal.store';
import { sonarrApi } from '../../apis/sonarr/sonarr-api';
import { createSerieRequest, createSerieRequestApprouved } from '../Requests/requestActions';
import SpinnerModal from '../SpinnerModal.svelte';
import { getOrAddSeriesToSonarr } from '../MediaManagerAuto/addSerieToSonarrAutomatically';
import { generalSettings } from '../../stores/generalSettings.store';
import { get, writable } from 'svelte/store';
import { tmdbApi } from '../../apis/tmdb/tmdb-api';
import { reiverrApi } from '../../apis/reiverr/reiverr-api';
import EpisodeSelectionDialog from '../Dialog/EpisodeSelectionDialog.svelte';
import SelectEpisode from '../SeriesPage/SelectEpisode.svelte';
import ConfirmDialog from '../Dialog/ConfirmDialog.svelte';
import { handleSeriesDownload } from '../MediaManagerAuto/AutoDownloadManagerSerie';

export const loadingMessage = writable('');

export function setLoadingMessage(message: string) {
  loadingMessage.set(message);
}

export async function handleRequestSeason(
  tmdbId: number,
  currentUser: string
) {
  try {
    const tmdbSeries = await tmdbApi.getTmdbSeries(tmdbId);

    const sonarrItem = await getOrAddSeriesToSonarr(
      tmdbSeries.id,
      tmdbSeries.name,
      () => console.log('Series added successfully.')
    );

    if (!sonarrItem) {
      console.error('Failed to process series in Sonarr.');
      return;
    }

    const result = await chooseSeasonAndEpisode(sonarrItem, tmdbId, currentUser);
    console.log('Request Result:', result);

    await checkQuotaAndCreateRequest(result.season, sonarrItem, result.episode, result.choice, tmdbId, currentUser);
  } catch (error) {
    console.error('Error handling request for season:', error);
  }
}

async function chooseSeasonAndEpisode(sonarrItem: SonarrSeries, tmdbId: number, currentUser: UserType) {
  const validSeasons = sonarrItem.seasons.filter(s => s.seasonNumber > 0);
  const seasonNumbers = validSeasons.map(s => s.seasonNumber);

  const statusResults = await Promise.all(
    seasonNumbers.map(seasonNumber =>
      sonarrApi.isSeasonFullyDownloaded(sonarrItem.id, seasonNumber)
        .then(isCompleted => isCompleted ? seasonNumber : null)
        .catch(error => {
          console.log(`Error checking season ${seasonNumber}: ${error}`);
          return null;
        })
    )
  );

  const completedSeasons = statusResults.filter(season => season !== null) as number[];

  return new Promise<{ sonarrItem: SonarrSeries, season: number, episode: number | null, choice: number }>((resolve, reject) => {
    createModal(ChooseSeason, {
      seasons: writable(seasonNumbers),
      completedSeasons: writable(completedSeasons),
      selectedSeason: writable(null),
      onConfirm: async (season: number) => {
        try {
          const result = await handleEpisodeSelection(sonarrItem, season, tmdbId, currentUser);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      },
      onCancel: () => {
        reject('Modal was canceled');
      }
    });
  });
}

async function handleEpisodeSelection(sonarrItem: SonarrSeries, season: number, tmdbId: number, currentUser: UserType) {
  const episodes = await sonarrApi.getEpisodes(sonarrItem.id, season);

  const totalEpisodes = episodes.length;
  const downloadedEpisodes = episodes.filter(episode => episode.hasFile).length;
  const allEpisodesAired = episodes.every(episode => new Date(episode.airDate || '') <= new Date());

  if (downloadedEpisodes === 0 && allEpisodesAired && totalEpisodes > 0) {
    return { sonarrItem, season, episode: null, choice: 1 };
  }

  return await openEpisodeSelectionModal(sonarrItem, season, tmdbId, currentUser);
}

async function openEpisodeSelectionModal(sonarrItem: SonarrSeries, seasonNumber: number, tmdbId: number, currentUser: UserType) {
  const episodes = await sonarrApi.getEpisodes(sonarrItem.id, seasonNumber);

  const formattedEpisodes = episodes.map(episode => ({
    id: episode.id,
    episodeNumber: episode.episodeNumber,
    title: episode.title,
    hasFile: episode.hasFile,
    airDate: episode.airDate
  }));

  return new Promise<{ sonarrItem: SonarrSeries, season: number, episode: number | null, choice: number }>((resolve, reject) => {
    createModal(EpisodeSelectionDialog, {
      header: 'Episode Selection Mode',
      body: 'Would you like to automatically monitor all current and future episodes, or manually select episodes to download?',
      automaticSelection: async () => {
        try {
          await sonarrApi.monitorSeries(sonarrItem.id, true, 'none');
          await sonarrApi.monitorSeason(sonarrItem.id, seasonNumber, true);
          await sonarrApi.searchSeason(sonarrItem.id, seasonNumber);
          resolve({ sonarrItem, season: seasonNumber, episode: null, choice: 2 });
        } catch (error) {
          reject(error);
        }
      },
      manualSelection: async () => {
        const selected = await selectEpisodeManually(sonarrItem, seasonNumber, tmdbId, currentUser);
        resolve({ sonarrItem, season: seasonNumber, episode: selected.episodeNumber, choice: 3 });
      }
    });
  });
}

async function selectEpisodeManually(sonarrItem: SonarrSeries, seasonNumber: number, tmdbId: number, currentUser: UserType) {
  const episodes = await sonarrApi.getEpisodes(sonarrItem.id, seasonNumber);

  const formattedEpisodes = episodes.map(episode => ({
    id: episode.id,
    episodeNumber: episode.episodeNumber,
    title: episode.title,
    hasFile: episode.hasFile,
    airDate: episode.airDate
  }));

  const selectedEpisode = writable(null);

  return new Promise<any>((resolve, reject) => {
    createModal(SelectEpisode, {
      episodes: writable(formattedEpisodes),
      selectedEpisode,
      onConfirm: async (selected: any) => {
        if (selected !== null) {
          try {
            await sonarrApi.monitorEpisode(selected.id);
            await sonarrApi.searchEpisode(selected.id);
            await createSerieRequestApprouved(tmdbId, currentUser, seasonNumber, selected.episodeNumber);
            resolve(selected);
          } catch (error) {
            reject(error);
          }
        } else {
          reject('No episode selected');
        }
      },
      onCancel: () => {
        reject('Modal was canceled');
      }
    });
  });
}

export async function checkQuotaAndCreateRequest(
  season: number,
  sonarrItem: SonarrSeries,
  episode: number | null,
  choice: number,
  tmdbId: number,
  currentUser: UserType
) {
  const userId = currentUser?.id;
  const settings = get(generalSettings);
  const days = settings.data?.requests?.delayInDays ?? 30;
  const userRequestCount = await reiverrApi.countRequestsInPeriodForUser(userId, days);
  const maxRequests = settings.data?.requests?.defaultLimitTV ?? 3;

  if (currentUser?.isAdmin || userRequestCount < maxRequests) {
    const remainingRequests = maxRequests - userRequestCount;
    createApprovedRequestDialog(remainingRequests, days, maxRequests, sonarrItem, season, choice, episode, tmdbId, currentUser);
  } else {
    createPendingRequestDialog(season, episode, tmdbId, currentUser);
  }
}

function createApprovedRequestDialog(
  remainingRequests: number,
  days: number,
  maxRequests: number,
  sonarrItem: SonarrSeries,
  season: number,
  choice: number,
  selectedEpisode: number | null,
  tmdbId: number,
  currentUser: UserType
) {
  createModal(ConfirmDialog, {
    header: 'Confirm Automatic Download',
    body: `You have ${remainingRequests}/${maxRequests} requests remaining that will be automatically approved. Requests reset every ${days} days. After reaching this limit, further requests will require admin approval.`,
    confirm: async () => {
      if (choice === 1) {
        await automaticDownloadSeason(sonarrItem, season, tmdbId, currentUser);
      } else if (choice === 2) {
        await sonarrApi.monitorSeries(sonarrItem.id, true, 'none');
        await sonarrApi.monitorSeason(sonarrItem.id, season, true);
        await sonarrApi.searchSeason(sonarrItem.id, season);
        console.log(`Search initiated for season ${season} of series ${sonarrItem.id}.`);
      } else if (choice === 3 && selectedEpisode !== undefined && selectedEpisode !== null) {
        await sonarrApi.monitorEpisode(selectedEpisode);
        await sonarrApi.searchEpisode(selectedEpisode);
        await createSerieRequestApprouved(tmdbId, currentUser, season, selectedEpisode);
        console.log(`Search initiated for episode ${selectedEpisode} of series ${sonarrItem.id}, season ${season}.`);
      } else {
        console.error('Invalid choice or missing episode for choice 3');
      }
    }
  });
}

async function automaticDownloadSeason(sonarrItem: SonarrSeries, season: number, tmdbId: number, currentUser: UserType) {
  modalStack.closeTopmost();
  createModal(SpinnerModal, {
    title: 'Processing Series Download',
    progressMessage: loadingMessage
  });
  try {
    await handleSeriesDownload(sonarrItem.id, season, setLoadingMessage, handleError);
    await createSerieRequestApprouved(tmdbId, currentUser, season);

    loadingMessage.set("Process completed");
    setTimeout(() => modalStack.closeTopmost(), 1000);

  } catch (error) {
    handleError(error.message || 'Failed to download the series.');
    modalStack.closeTopmost();
    createErrorDialog(error.message, () => automaticDownloadSeason(sonarrItem, season, tmdbId, currentUser));
  }
}

function createPendingRequestDialog(season: number, episode: number | null, tmdbId: number, currentUser: UserType) {
  createModal(ConfirmDialog, {
    header: 'Confirm Request',
    body: `Do you want to request season ${season}? An administrator will have to approve it before it appears in the library.`,
    confirm: async () => {
      try {
        await createSerieRequest(tmdbId, currentUser, season, episode);
        // Update requestedSeasons or any other state as needed
      } catch (error) {
        console.error('Error confirming request creation:', error);
      }
    }
  });
}

function createErrorDialog(error: string, retryCallback: () => void) {
  const errorMessage = `An error occurred while downloading the season: ${error} Do you want to retry downloading the series?`;
  createModal(ConfirmDialog, {
    header: 'Download Error',
    body: errorMessage,
    confirm: () => {
      modalStack.closeTopmost();
      retryCallback();
    },
    cancel: () => {
      modalStack.closeTopmost();
    },
    confirmButtonText: 'Retry',
    cancelButtonText: 'Cancel'
  });
}

function handleError(message: string) {
  console.error(message);
  loadingMessage.set('Error occurred');
}
