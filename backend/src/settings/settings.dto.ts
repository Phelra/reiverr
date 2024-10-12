import { ApiProperty } from '@nestjs/swagger';

export class UpdateSettingsDto {
  @ApiProperty({ type: Object })
  integrations: {
    sonarr: {
      apiKey: string;
      baseUrl: string;
      qualityProfileId: number;
      rootFolderPath: string;
      languageProfileId: number;
    };
    radarr: {
      apiKey: string;
      baseUrl: string;
      qualityProfileId: number;
      rootFolderPath: string;
    };
    jellyfin: {
      apiKey: string;
      baseUrl: string;
    };
    tmdb: {
      userId: string;
      sessionId: string;
    };
  };

  @ApiProperty({ type: Object })
  requests: {
    defaultLimitMovies: number;
    defaultLimitTV: number;
    delayInDays: number;
    allowRequests: boolean;
  };
}
