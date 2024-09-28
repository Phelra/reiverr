import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('settings')
export class Settings {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('json', { 
    default: {
      sonarr: {
        apiKey: '',
        baseUrl: '',
        qualityProfileId: 0,
        rootFolderPath: '',
        languageProfileId: 0,
      },
      radarr: {
        apiKey: '',
        baseUrl: '',
        qualityProfileId: 0,
        rootFolderPath: '',
      },
      jellyfin: {
        apiKey: '',
        baseUrl: '',
      },
      tmdb: {
        userId: '',
        sessionId: '',
      }
    }
  })
  integrations: Record<string, any>;

  @Column('json', {
    default: {
      defaultLimitMovies: 10,
      defaultLimitTV: 5,
      delayInDays: 7,
      allowRequests: true,
    }
  })
  requests: Record<string, any>;
}
