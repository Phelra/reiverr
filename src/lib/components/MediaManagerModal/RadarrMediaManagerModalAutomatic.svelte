<script lang="ts">
	import { radarrApi, type RadarrMovie } from '../../apis/radarr/radarr-api';
	import type { Release } from '../../apis/combined-types';
	import { retry } from '../../utils';

	export let radarrItem: RadarrMovie;
	export let onGrabRelease: (release: Release) => void = () => {};

	// Fonction pour télécharger le fichier sélectionné
	const grabRelease = async (release: Release) => {
		try {
			console.log(`Attempting to download release: ${release.title}`);
			const result = await radarrApi.downloadMovie(release.guid || '', release.indexerId || -1);
			if (result) {
				console.log(`Successfully grabbed release: ${release.title}`);
				onGrabRelease(release);
			} else {
				console.error(`Failed to grab release: ${release.title}`);
			}
			return result;
		} catch (error) {
			console.error(`Error during grabbing release: ${error.message}`);
		}
	};

	// Fonction pour attribuer des points selon différents critères
	function calculatePoints(release: Release): number {
		let points = 0;

		// Taille du fichier
		const sizeGB = (release.size || 0) / (1024 * 1024 * 1024); // Convertir en Go
		if (sizeGB < 5) points += 4;
		else if (sizeGB < 10) points += 3;
		else if (sizeGB < 15) points += 2;
		else if (sizeGB < 20) points += 1;

		// Présence de "multi" dans le titre
		if (release.title.toLowerCase().includes("MULTI")) points += 3;

		// Nombre de seeders
		const seeders = release.seeders || 0;
		if (seeders > 10) points += 3;
		else if (seeders > 5) points += 2;
		else if (seeders > 1) points += 1;

		// Age du fichier
		const ageHours = release.ageHours || 0;
		if (ageHours > 100) points += 3;
		else if (ageHours > 10) points += 2;
		else if (ageHours > 5) points += 1;

		return points;
	}

	// Fonction pour trouver le meilleur fichier basé sur un système de points si tous les customFormatScore sont à 0
	function findBestReleaseBasedOnPoints(releases: Release[]): Release | undefined {
		let bestRelease: Release | undefined = undefined;
		let maxPoints = 0;

		for (const release of releases) {
			const points = calculatePoints(release);
			if (points > maxPoints) {
				maxPoints = points;
				bestRelease = release;
			}
		}
		return bestRelease;
	}

	// Fonction pour trouver le meilleur fichier basé sur le customFormatScore
	function findBestRelease(releases: Release[]): Release | undefined {
		let bestRelease = releases.reduce((best, current) => {
			if (current.customFormatScore > best.customFormatScore) {
				return current;
			}
			return best;
		}, releases[0]);

		// Si tous les customFormatScore sont égaux à 0, on applique l'algorithme des points
		if (bestRelease.customFormatScore === 0) {
			console.log("All customFormatScores are 0, applying the points-based algorithm.");
			bestRelease = findBestReleaseBasedOnPoints(releases) || bestRelease;
		}

		return bestRelease;
	}

	// Récupérer les releases avec la fonction retry
	const fetchReleases = async (): Promise<Release[]> => {
		try {
			console.log(`Fetching releases for movie ID: ${radarrItem.id}`);
			const releaseList = await retry(
				() => radarrApi.getReleases(radarrItem.id || -1),
				(v) => !!v?.length,
				{ retries: 2 }
			);
			if (releaseList && releaseList.length > 0) {
				console.log(`Found ${releaseList.length} releases for movie: ${radarrItem.title}`);
				return releaseList;
			} else {
				console.warn("No releases found.");
				return [];
			}
		} catch (error) {
			console.error(`Error fetching releases: ${error.message}`);
			return [];
		}
	};

	// Sélection automatique du fichier avec le meilleur score
	async function autoSelectBestRelease() {
		const releaseList = await fetchReleases();
		if (releaseList.length > 0) {
			// Log regroupant toutes les releases
			const formattedReleases = releaseList.map((release, index) => ({
				title: release.title,
				indexer: release.indexer,
				seeders: release.seeders,
				leechers: release.leechers,
				quality: release.quality?.quality?.name,
				size: release.size,
				customFormatScore: release.customFormatScore
			}));
			console.log("All releases:", formattedReleases);

			// Sélection du meilleur release
			const bestRelease = findBestRelease(releaseList);
			if (bestRelease) {
				// Log détaillé pour la release sélectionnée
				console.log(`Automatically selected best release: ${bestRelease.title}, Score: ${bestRelease.customFormatScore}`);
				console.log(`Details of selected release:`, {
					title: bestRelease.title,
					indexer: bestRelease.indexer,
					seeders: bestRelease.seeders,
					leechers: bestRelease.leechers,
					quality: bestRelease.quality?.quality?.name,
					size: bestRelease.size,
					customFormatScore: bestRelease.customFormatScore,
					age: bestRelease.ageHours
				});
				await grabRelease(bestRelease);
			} else {
				console.log("No suitable release found.");
			}
		}
	}

	// Appel de la fonction pour sélectionner automatiquement le meilleur release
	autoSelectBestRelease();
</script>
