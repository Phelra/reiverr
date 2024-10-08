<script lang="ts">
    import Container from '../../../Container.svelte';
    import TextField from '../TextField.svelte';
    import Button from '../Button.svelte';
    import { writable, get } from 'svelte/store';
    import { generalSettings } from '../../stores/generalSettings.store';
    import Toggle from '../../components/Toggle.svelte';

  
    let limitMovies = writable(0);
    let limitTV = writable(0);
    let delayInDays = writable(7);
    let isLoading = writable(false);
    let allowRequests = writable(true);
  
    const fetchSettings = () => {
      const settings = get(generalSettings)?.data?.requests;
      if (settings) {
        limitMovies.set(settings.defaultLimitMovies || 0);
        limitTV.set(settings.defaultLimitTV || 0);
        delayInDays.set(settings.delayInDays || 7);
        allowRequests.set(settings.allowRequests ?? true); 
        console.log('Settings loaded:', settings);
      } else {
        console.log('No settings found, using default values.');
      }
    };
  
    async function handleSave() {
      isLoading.set(true);
      try {
        const currentSettings = get(generalSettings)?.data?.requests || {};
        await generalSettings.updateSettings(prev => ({
          ...prev,
          requests: {
            ...currentSettings,
            defaultLimitMovies: Number($limitMovies),
            defaultLimitTV: Number($limitTV),
            delayInDays: Number($delayInDays),
            allowRequests: $allowRequests
          }
        }));
        console.log('Settings successfully saved.');
      } catch (error) {
        console.error('Failed to save request settings:', error);
      } finally {
        isLoading.set(false);
      }
    }
  
    fetchSettings();
  </script>


<div class="flex space-x-8">
  <Container class="bg-primary-800 rounded-xl p-8 w-1/2">
    <h1 class="mb-4 header1">Automatic approval feature</h1>
    <Container>
      <div class="space-y-4 mb-4">
        <Container class="flex space-x-4">
          <div class="w-1/2">
            <TextField 
              bind:value={$limitMovies} 
              isValid={true} 
              on:change={handleSave}
            >
              Limit automatic movie approvals
            </TextField>
          </div>
    
          <div class="w-1/2">
            <TextField 
              bind:value={$limitTV} 
              isValid={true} 
              on:change={handleSave}
            >
            Limit automatic season approvals
            </TextField>
          </div>
        </Container>
    
        <div class=" w-full">
          <TextField 
            bind:value={$delayInDays} 
            isValid={true} 
            on:change={handleSave}
          >
            Number of days before limits reset
          </TextField>
        </div>
      </div>
    
      <!--<Button
        class="button"
        type="primary-dark"
        on:click={handleSave}
        disabled={$isLoading}
      >
        Save
      </Button>-->
    </Container>
    </Container>
    <Container class="bg-primary-800 rounded-xl p-8 w-1/2">
    <div class="space-y-4 mb-4">
        <h1 class="mb-4 header1">Advanced settings</h1>
      <div class="flex items-center justify-between text-lg font-medium text-secondary-100 py-2">
        <label class="mr-2">Enable requests</label>
        <Toggle bind:checked={$allowRequests} on:change={handleSave} />
      </div>
    </div>
  </Container>
</div>
  
  
 