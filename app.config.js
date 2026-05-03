const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const googleServicesPath = path.join(__dirname, 'google-services.json');
  if (!fs.existsSync(googleServicesPath)) {
    if (config.android && config.android.googleServicesFile) {
      delete config.android.googleServicesFile;
    }
  }

  return {
    ...config,
  };
};
