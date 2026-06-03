const { TwitterApi } = require('twitter-api-v2');

function getClient() {
  return new TwitterApi({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET,
  });
}

function formatTweet(hr) {
  const half = hr.halfInning === 'top' ? 'Top' : 'Bot';
  const levelTag = hr.level ? ` (${hr.level})` : '';
  const lines = [`⚾️💥 ${hr.playerName} goes DEEP!${levelTag}`];

  const stats = [];
  if (hr.distance)    stats.push(`📏 ${Math.round(hr.distance)} ft`);
  if (hr.exitVelo)    stats.push(`🚀 ${Math.round(hr.exitVelo)} mph`);
  if (hr.launchAngle) stats.push(`📐 ${Math.round(hr.launchAngle)}°`);
  if (stats.length) lines.push(stats.join(' · '));

  lines.push(`${hr.awayTeam} @ ${hr.homeTeam} · ${half} ${hr.inning}`);
  lines.push('#MLB #HomeRun #JewishMLB');

  return lines.join('\n');
}

async function sendTweet(text) {
  const client = getClient();
  return client.v2.tweet(text);
}

module.exports = { sendTweet, formatTweet };
