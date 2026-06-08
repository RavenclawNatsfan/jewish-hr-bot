const fs = require('fs');
const path = require('path');
const { getTodaysGames, getLiveFeed, extractHomeRuns, getCareerHomeRuns, getSeasonHomeRuns, getHighlightVideo } = require('./mlb');
const { sendPost, formatPost } = require('./bluesky');
const config = require('./players');

const STATE_FILE = path.join(__dirname, 'tweeted.json');

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { tweeted: {} };
  }
}

function saveState(state) {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  for (const [id, ts] of Object.entries(state.tweeted)) {
    if (ts < cutoff) delete state.tweeted[id];
  }
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function main() {
  const watchedIds = new Set(config.players.map(p => p.mlbId));
  if (watchedIds.size === 0) {
    console.log('No players configured in players.js');
    return;
  }

  const state = loadState();

  let games;
  try {
    games = await getTodaysGames(config.includeMiLB);
  } catch (err) {
    console.error('Failed to fetch schedule:', err.message);
    process.exit(1);
  }

  if (!games.length) {
    console.log('No active games today');
    return;
  }

  console.log(`Checking ${games.length} game(s) for ${watchedIds.size} player(s)`);

  const feedResults = await Promise.allSettled(
    games.map(g => getLiveFeed(g.gamePk).then(feed => ({ feed, level: g.level })))
  );

  let stateChanged = false;

  for (const result of feedResults) {
    if (result.status === 'rejected') {
      console.error('Feed fetch failed:', result.reason?.message);
      continue;
    }

    const { feed, level } = result.value;
    const homeRuns = extractHomeRuns(feed, watchedIds, level);

    for (const hr of homeRuns) {
      if (state.tweeted[hr.playId]) continue;

      [hr.careerHRs, hr.seasonHRs] = await Promise.all([
        getCareerHomeRuns(hr.batterId, hr.isMiLB),
        getSeasonHomeRuns(hr.batterId, hr.isMiLB),
      ]);

      const text = formatPost(hr);
      const video = await getHighlightVideo(hr.gamePk, hr.batterId);

      try {
        await sendPost(text, video);
        state.tweeted[hr.playId] = Date.now();
        stateChanged = true;
        console.log('Posted:', hr.playerName, hr.playId, video ? '(with video)' : '(no video yet)');
      } catch (err) {
        console.error('Post failed:', err.message);
      }
    }
  }

  if (stateChanged) saveState(state);
}

main();
