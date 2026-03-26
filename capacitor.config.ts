import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl = 'https://voteapp--ai-link-in-bio.us-central1.hosted.app/'

const config: CapacitorConfig = {
  appId: 'com.clickvote',
  appName: 'clickvote',
  webDir: 'out',
  ...(serverUrl
    ? {
        server: {
          url: serverUrl,
          cleartext: true
        }
      }
    : {})
};

export default config;
