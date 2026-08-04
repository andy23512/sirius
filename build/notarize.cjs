// electron-builder afterSign hook: notarize the macOS app, but only when Apple
// credentials are present in the environment. Without them (e.g. CI, or an
// unsigned local build) it no-ops, so packaging still succeeds.
//
// Provide EITHER App-Store-Connect API key:
//   APPLE_API_KEY (path to .p8), APPLE_API_KEY_ID, APPLE_API_ISSUER
// OR Apple ID:
//   APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID
const { notarize } = require('@electron/notarize');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'darwin') {
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;

  const hasApiKey =
    process.env.APPLE_API_KEY &&
    process.env.APPLE_API_KEY_ID &&
    process.env.APPLE_API_ISSUER;
  const hasAppleId =
    process.env.APPLE_ID &&
    process.env.APPLE_APP_SPECIFIC_PASSWORD &&
    process.env.APPLE_TEAM_ID;

  if (!hasApiKey && !hasAppleId) {
    console.log(
      'Skipping notarization: no Apple credentials in the environment.',
    );
    return;
  }

  console.log(`Notarizing ${appName} (${appPath})…`);
  await notarize(
    hasApiKey
      ? {
          appPath,
          appleApiKey: process.env.APPLE_API_KEY,
          appleApiKeyId: process.env.APPLE_API_KEY_ID,
          appleApiIssuer: process.env.APPLE_API_ISSUER,
        }
      : {
          appPath,
          appleId: process.env.APPLE_ID,
          appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
          teamId: process.env.APPLE_TEAM_ID,
        },
  );
  console.log('Notarization complete.');
};
