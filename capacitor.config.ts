import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl = 'https://voter-webiste-app-main.vercel.app/'

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
