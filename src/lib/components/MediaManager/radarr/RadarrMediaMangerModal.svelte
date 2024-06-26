<script lang="ts">
	import FullScreenModal from '../../Modal/FullScreenModal.svelte';
	import ManageMediaMenuLayout from '../MediaManagerMenuLayout.svelte';
	import {
		type MovieFileResource,
		radarrApi,
		type RadarrRelease
	} from '../../../apis/radarr/radarr-api';
	import ReleaseList from '../../MediaManagerModal/Releases/MMReleasesTab.svelte';
	import FilesList from '../../MediaManagerModal/LocalFiles/MMLocalFilesTab.svelte';
	import { modalStack } from '../../Modal/modal.store';
	import FileActionsModal from '../modals/FileActionsModal.svelte';
	import DownloadsList from '../DownloadList.svelte';
	import { useRequest } from '../../../stores/data.store';
	import { derived, type Readable } from 'svelte/store';
	import ReleaseActionsModal from '../modals/ReleaseActionsModal.svelte';
	import type { SonarrRelease } from '../../../apis/sonarr/sonarr-api';
	import Button from '../../Button.svelte';
	import type { FileResource } from '../../../apis/combined-types';

	export let modalId: symbol;
	export let hidden: boolean;
	export let id: number;

	const { promise: files, refresh: refreshFiles } = useRequest(radarrApi.getFilesByMovieId, id);
	const {
		promise: downloads,
		data: downloadsData,
		refresh: refreshDownloads
	} = useRequest(radarrApi.getDownloadsById, id);

	const handleGrabRelease = (guid: string, indexerId: number) =>
		radarrApi
			.downloadMovie(guid, indexerId)
			.then((ok) => {
				if (!ok) {
					// TODO: Show error
				}
				refreshFiles(id);

				return ok;
			})
			.finally(() => {
				radarrApi.getReleaseHistory(id).then(console.log);
				setTimeout(() => refreshDownloads(id), 8000);
			});
	const handleCancelDownload = (id: number) =>
		radarrApi.cancelDownloadRadarrMovie(id).then(() => refreshDownloads(id));

	const grabbedReleases: Readable<Record<string, boolean>> = derived(downloadsData, ($downloads) =>
		($downloads || []).reduce((acc: Record<string, boolean>, download) => {
			acc[`${download.title}`] = true;
			return acc;
		}, {})
	);

	function handleSelectRelease(release: RadarrRelease | SonarrRelease) {
		modalStack.create(
			ReleaseActionsModal,
			{
				release,
				grabRelease: handleGrabRelease
			},
			modalId
		);
	}

	function handleSelectFile(file: FileResource) {
		modalStack.create(
			FileActionsModal,
			{
				file,
				handleDeleteFile: (id: number) => radarrApi.deleteMovieFile(id).then(() => refreshFiles(id))
			},
			modalId
		);
	}
</script>

<FullScreenModal {modalId} {hidden}>
	<ManageMediaMenuLayout focusOnMount>
		<h1 slot="header">Download</h1>
		<ReleaseList
			getReleases={() => radarrApi.getReleases(id)}
			selectRelease={handleSelectRelease}
		/>
	</ManageMediaMenuLayout>
	<ManageMediaMenuLayout>
		<h1 slot="header">Local Files</h1>
		<FilesList files={$files} {handleSelectFile} />
	</ManageMediaMenuLayout>
	<ManageMediaMenuLayout>
		<h1 slot="header">Downloads</h1>
		<DownloadsList downloads={$downloads} cancelDownload={handleCancelDownload} />
	</ManageMediaMenuLayout>
</FullScreenModal>
