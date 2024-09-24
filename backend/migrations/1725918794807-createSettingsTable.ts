import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateSettingsTable1624384004000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'settings',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'integrations',
            type: 'json',
            isNullable: false,
            default: `'{
              "radarr": {
                "apiKey": "",
                "baseUrl": "",
                "minimumAvailability": "",
                "qualityProfileId": 4,
                "rootFolderPath": ""
              },
              "sonarr": {
                "apiKey": "",
                "baseUrl": "",
                "qualityProfileId": 0,
                "rootFolderPath": "",
                "languageProfileId": 0
              },
              "jellyfin": {
                "apiKey": "",
                "baseUrl": ""
              },
              "tmdb": {
                "userId": "",
                "sessionId": ""
              }
            }'`,
          },
          {
            name: 'requests',
            type: 'json',
            isNullable: false,
            default: `'{
              "defaultLimitMovies": 10,
              "defaultLimitTV": 5,
              "delayInDays": 7
            }'`,
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('settings');
  }
}

