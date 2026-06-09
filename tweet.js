const fs = require('fs');
const { TwitterApi } = require('twitter-api-v2');

async function main() {
  if (!fs.existsSync('pending_tweet.json')) {
    console.log('No pending tweet.');
    return;
  }

  const { text } = JSON.parse(fs.readFileSync('pending_tweet.json', 'utf8'));

  const client = new TwitterApi({
    appKey:       process.env.TWITTER_API_KEY,
    appSecret:    process.env.TWITTER_API_SECRET,
    accessToken:  process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET,
  });

  await client.v2.tweet(text);
  console.log('Tweeted:', text.split('\n')[0]);
  fs.unlinkSync('pending_tweet.json');
}

main().catch(e => { console.error('Tweet failed:', e.message); process.exit(1); });
