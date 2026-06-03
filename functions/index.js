const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const { getTodaysGames, getLiveFeed, extractHomeRuns } = require('./mlb');
const { sendTweet, formatTweet } = require('./twitter');
const config = require('./players');

admin.initializeApp();
const db = admin.firestore();

const watchedIds = new Set(config.players.map(p => p.mlbId));

async function alreadyTweeted(playId) {
  const snap = await db.collection('tweeted_plays').doc(playId).get();
  return snap.exists;
}

exports.checkHomeRuns = onSchedule(
  {
    schedule: '*/2 * * * *',
    timeZone: 'America/New_York',
    secrets: [
      'TWITTER_API_KEY',
      'TWITTER_API_SECRET',
      'TWITTER_ACCESS_TOKEN',
      'TWITTER_ACCESS_SECRET',
    ],
    memory: '256MiB',
    timeoutSeconds: 60,
  },
  async () => {
    if (watchedIds.size === 0) {
      console.log('No players in players.js — nothing to do');
      return;
    }

    let games;
    try {
      games = await getTodaysGames(config.includeMiLB);
    } catch (err) {
      console.error('Failed to fetch schedule:', err.message);
      return;
    }

    if (!games.length) {
      console.log('No active games today');
      return;
    }

    console.log(`Checking ${games.length} game(s) for ${watchedIds.size} player(s)`);

    const feedResults = await Promise.allSettled(
      games.map(g => getLiveFeed(g.gamePk).then(feed => ({ feed, level: g.level })))
    );

    for (const result of feedResults) {
      if (result.status === 'rejected') {
        console.error('Feed fetch failed:', result.reason?.message);
        continue;
      }

      const { feed, level } = result.value;
      const homeRuns = extractHomeRuns(feed, watchedIds, level);

      for (const hr of homeRuns) {
        if (await alreadyTweeted(hr.playId)) continue;

        const text = formatTweet(hr);
        try {
          await sendTweet(text);
          await db.collection('tweeted_plays').doc(hr.playId).set({
            playerName: hr.playerName,
            tweetedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          console.log('Tweeted:', hr.playerName, hr.playId);
        } catch (err) {
          console.error('Tweet failed for', hr.playId, err.message);
        }
      }
    }
  }
);
