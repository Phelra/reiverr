<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade } from 'svelte/transition';

  export let videoId: string | null = null;
  export let backgroundUrl: string;
  export let topOffset: number = 50;
  export let zoomFactor: number = 1.5;

  let player: any;
  let showBackgroundImage = true;
  let videoReady = false;
  let checkTimeInterval: number | null = null;

  function loadYouTubeAPI() {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode!.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = setupPlayer;
    } else {
      setupPlayer();
    }
  }

  function setupPlayer() {
    if (player) {
      player.destroy();
      player = null;
    }

    if (window.YT && window.YT.Player && videoId) {
      player = new window.YT.Player('youtube-player', {
        videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          modestbranding: 1,
          mute: 1,
          rel: 0,
          iv_load_policy: 3,
          start: 3,
          fs: 0,
          disablekb: 1,
          cc_load_policy: 0
        },
        events: {
          onReady: (event) => {
            event.target.mute();
            event.target.playVideo();
            adjustVideoSize();
            window.addEventListener('resize', adjustVideoSize);

            setTimeout(() => {
              videoReady = true;
              showBackgroundImage = false;
            }, 2000);
          },
          onStateChange: onPlayerStateChange,
          onError: () => {
            showBackgroundImage = true;
          },
        },
      });
    } else {
      showBackgroundImage = true;
    }
  }

  function onPlayerStateChange(event: any) {
    if (event.data === YT.PlayerState.PLAYING) {
      const duration = player.getDuration();

      if (checkTimeInterval) clearInterval(checkTimeInterval);

      checkTimeInterval = setInterval(() => {
        const currentTime = player.getCurrentTime();
        if (currentTime >= duration - 3) {
          player.seekTo(0);
        }
      }, 500);
    } else if (event.data === YT.PlayerState.ENDED) {
      player.seekTo(0);
      player.playVideo();
    }
  }

  function adjustVideoSize() {
    if (!player) return;

    const containerWidth = window.innerWidth;
    const containerHeight = window.innerHeight;
    const containerRatio = containerWidth / containerHeight;
    const videoRatio = 16 / 9;

    const newWidth = containerRatio > videoRatio ? containerWidth : containerHeight * videoRatio;
    const newHeight = containerRatio > videoRatio ? containerWidth / videoRatio : containerHeight;

    player.setSize(newWidth, newHeight);

    const playerElement = document.getElementById('youtube-player');
    if (playerElement) {
      playerElement.style.width = `${newWidth}px`;
      playerElement.style.height = `${newHeight}px`;
      playerElement.style.top = `${(containerHeight - newHeight) / 2 - topOffset}px`;
      playerElement.style.left = `${(containerWidth - newWidth) / 2}px`;
      playerElement.style.transform = `scale(${zoomFactor})`;
      playerElement.style.transformOrigin = 'center center';
    }
  }

  onMount(() => {
    loadYouTubeAPI();

    return () => {
      if (player) {
        player.destroy();
        player = null;
      }
      if (checkTimeInterval) {
        clearInterval(checkTimeInterval);
      }
      window.removeEventListener('resize', adjustVideoSize);
    };
  });

  $: if (videoId && window.YT && window.YT.Player) {
    setupPlayer();
  } else {
    showBackgroundImage = true;
  }
</script>

<div
  id="youtube-player"
  class="video-background"
/>

{#if showBackgroundImage}
  <div class="background-image" style={`background-image: url('${backgroundUrl}');`} out:fade={{ duration: 400 }} in:fade={{ duration: 200 }}></div>
{/if}

<style>
  .video-background, .background-image {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    z-index: -1;
    background-size: cover;
    background-position: center;
  }

  .background-image {
    opacity: 1;
  }
</style>
