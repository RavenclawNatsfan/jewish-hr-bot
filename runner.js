const fs = require('fs');
const path = require('path');
const { getTodaysGames, getLiveFeed, extractHomeRuns, getCareerHomeRuns, getSeasonHomeRuns, getHighlightVideo } = require('./mlb');
const { sendPost, formatPost } = require('./bluesky');
const config = require('./players');

const STATE_FILE = path.join(__dirname, 'tweeted.json');

// How long to keep retrying for a highlight video before posting without one.
const VIDEO_WAIT_MS = 10 * 60 * 1000;

function loadState() {
  try {
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    state.tweeted ??= {};
    state.pending ??= {};
    return state;
  } catch {
    return { tweeted: {}, pending: {} };
  }
}

function saveState(state) {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  for (const [id, ts] of Object.entries(state.tweeted)) {
    if (ts < cutoff) delete state.tweeted[id];
  }
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function postHR(hr, video, state) {
  const text = formatPost(hr);
  try {
    await sendPost(text, video);
    state.tweeted[hr.playId] = Date.now();
    console.log('Posted:', hr.playerName, hr.playId, video ? '(with video)' : '(no video)');
    const existing = fs.existsSync('pending_email.json')
      ? JSON.parse(fs.readFileSync('pending_email.json', 'utf8'))
      : [];
    existing.push({ playerName: hr.playerName, text: formatPost(hr, { abbreviateTeams: true }), videoUrl: video?.url ?? null });
    fs.writeFileSync('pending_email.json', JSON.stringify(existing));
    return true;
  } catch (err) {
    console.error('Post failed:', err.message);
    return false;
  }
}

async function main() {
  const watchedIds = new Set(config.players.map(p => p.mlbId));
  if (watchedIds.size === 0) {
    console.log('No players configured in players.js');
    return;
  }

  const state = loadState();
  let stateChanged = false;

  // Retry any home runs that were detected previously but were waiting on a
  // highlight video.
  for (const [playId, entry] of Object.entries(state.pending)) {
    const elapsed = Date.now() - entry.firstSeen;
    const video = await getHighlightVideo(entry.hr.gamePk, entry.hr.batterId);

    if (!video && elapsed < VIDEO_WAIT_MS) continue;

    if (await postHR(entry.hr, video, state)) {
      delete state.pending[playId];
      stateChanged = true;
    }
  }

  let games;
  try {
    games = await getTodaysGames(config.includeMiLB);
  } catch (err) {
    console.error('Failed to fetch schedule:', err.message);
    if (stateChanged) saveState(state);
    process.exit(1);
  }

  if (!games.length) {
    console.log('No active games today');
    if (stateChanged) saveState(state);
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
      if (state.tweeted[hr.playId] || state.pending[hr.playId]) continue;

      [hr.careerHRs, hr.seasonHRs] = await Promise.all([
        hr.isMiLB ? Promise.resolve(null) : getCareerHomeRuns(hr.batterId, hr.isMiLB),
        getSeasonHomeRuns(hr.batterId, hr.isMiLB),
      ]);

      const video = await getHighlightVideo(hr.gamePk, hr.batterId);

      if (!video) {
        state.pending[hr.playId] = { firstSeen: Date.now(), hr };
        stateChanged = true;
        console.log('Waiting for video:', hr.playerName, hr.playId);
        continue;
      }

      if (await postHR(hr, video, state)) stateChanged = true;
    }
  }

  if (stateChanged) saveState(state);
}

main();
