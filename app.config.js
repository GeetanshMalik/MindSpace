const fs = require('fs');
const path = require('path');

const baseConfig = require('./app.json').expo;

module.exports = () => {
  const expo = {
    ...baseConfig,
    splash: { ...baseConfig.splash },
    ios: { ...baseConfig.ios },
    android: {
      ...baseConfig.android,
      adaptiveIcon: { ...baseConfig.android.adaptiveIcon },
    },
    web: { ...baseConfig.web },
    plugins: [...baseConfig.plugins],
  };

  const googleServicesPath = path.join(__dirname, 'google-services.json');
  if (!fs.existsSync(googleServicesPath)) {
    delete expo.android.googleServicesFile;
  }

  return { expo };
};
