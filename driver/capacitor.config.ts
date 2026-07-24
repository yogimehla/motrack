import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.muulroute.driver',
  appName: 'MuulRoute Driver',
  webDir: 'dist',
  server: {
    // Leave androidScheme as https for security
    androidScheme: 'https',
  },
  plugins: {
    Geolocation: {
      // Request precise location on Android 12+
    },
  },
};

export default config;
