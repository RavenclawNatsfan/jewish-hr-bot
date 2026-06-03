// One-time script to get Access Token + Secret for the BOT account.
// Run: node get-bot-tokens.js
// Then run the firebase commands it prints at the end.

const { TwitterApi } = require('twitter-api-v2');
const readline = require('readline');

const API_KEY    = 'nAMVeIK7SwHcucaIcyPlHajHz';
const API_SECRET = 'BXaoq32x4NFJhVkbjTrbLji9twCGdq1McSXO0t8PvHp30Jf4pg';

(async () => {
  const client = new TwitterApi({ appKey: API_KEY, appSecret: API_SECRET });

  const { url, oauth_token, oauth_token_secret } =
    await client.generateAuthLink('oob', { linkMode: 'authenticate' });

  console.log('\n─────────────────────────────────────────────');
  console.log('1. Make sure you are logged into Twitter as the BOT account (@JewishHomeRuns)');
  console.log('2. Open this URL in your browser:\n');
  console.log('   ' + url);
  console.log('\n3. Authorize the app — Twitter will show you a PIN.');
  console.log('─────────────────────────────────────────────\n');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question('Paste the PIN here: ', async (pin) => {
    rl.close();
    try {
      const loggedInClient = new TwitterApi({
        appKey: API_KEY,
        appSecret: API_SECRET,
        accessToken: oauth_token,
        accessSecret: oauth_token_secret,
      });

      const { accessToken, accessSecret, screenName } = await loggedInClient.login(pin.trim());

      console.log('\n✓ Authorized as @' + screenName);
      console.log('\nRun these 4 commands in your terminal:\n');
      console.log(`firebase functions:secrets:set TWITTER_API_KEY`);
      console.log(`  → paste: ${API_KEY}\n`);
      console.log(`firebase functions:secrets:set TWITTER_API_SECRET`);
      console.log(`  → paste: ${API_SECRET}\n`);
      console.log(`firebase functions:secrets:set TWITTER_ACCESS_TOKEN`);
      console.log(`  → paste: ${accessToken}\n`);
      console.log(`firebase functions:secrets:set TWITTER_ACCESS_SECRET`);
      console.log(`  → paste: ${accessSecret}\n`);
    } catch (err) {
      console.error('Failed:', err.message);
    }
  });
})();
