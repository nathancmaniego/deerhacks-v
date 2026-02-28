// Expo loads .env and exposes EXPO_PUBLIC_* to process.env at build time.
// We pass API URL into extra so services/api.ts can read Constants.expoConfig?.extra?.apiUrl
const base = require('./app.json');

module.exports = {
  expo: {
    ...base.expo,
    extra: {
      apiUrl: process.env.EXPO_PUBLIC_API_URL,
    },
  },
};
