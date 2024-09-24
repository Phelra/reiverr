import { sonarrApi } from '../../apis/sonarr/sonarr-api';
import { radarrApi } from '../../apis/radarr/radarr-api';

export async function getTvProgress(tmdbId: number, season?: number) {
  try {
    const sonarrItem = await sonarrApi.getSeriesByTmdbId(tmdbId);
    
    if (!sonarrItem) {
      return null; 
    }
    
    if (season !== undefined && season !== null) {
      const downloadInfo = await sonarrApi.getDownloadProgressForSeason(sonarrItem.id, season);
      
      if (!downloadInfo || downloadInfo.progress === 0) {
        return null;
      }
      
      return {
        progress: downloadInfo.progress,
        timeLeft: downloadInfo.timeLeft
      };
    } else {
      return null;
    }
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function getMovieProgress(tmdbId: number) {
  try {
    const radarrItem = await radarrApi.getMovieByTmdbId(tmdbId);
    
    if (!radarrItem) {
      return null;
    }
    
    const downloadInfo = await radarrApi.getDownloadProgressForMovie(radarrItem.id);
    
    if (!downloadInfo || downloadInfo.progress === 0) {
      return null;
    }
    
    return {
      progress: downloadInfo.progress,
      timeLeft: downloadInfo.timeLeft
    };
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function getMediaProgress(tmdbId: number, mediaType: 0 | 1, season?: number) {
  if (mediaType === 0) {
    return getMovieProgress(tmdbId);
  } else if (mediaType === 1) {
    return getTvProgress(tmdbId, season);
  } else {
    throw new Error(`Invalid media type: ${mediaType}`);
  }
}