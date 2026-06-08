const axios = require('axios');
const { sendPost, formatPost } = require('./bluesky');
const { getLiveFeed, extractHomeRuns, getCareerHomeRuns, getSeasonHomeRuns, getHighlightVideo } = require('./mlb');
const config = require('./players');

const BASE = 'https://statsapi.mlb.com';
const SPORT_IDS = [1, 11, 12, 13, 14, 16];
const watchedIds = new Set(config.players.map(p => p.mlbId));

async function findRecentJewishHR() {
  for (let daysBack = 0; daysBack <= 7; daysBack++) {
    const d = new Date();
    d.setDate(d.getDate() - daysBack);
    const date = d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

    const { data: sched } = await axios.get(`${BASE}/api/v1/schedule`, {
      params: { sportId: SPORT_IDS.join(','), date, gameType: 'R' },
    });
    if (!sched.dates?.length) continue;

    const games = sched.dates.flatMap(d => d.games)
      .filter(g => g.status.abstractGameState !== 'Preview')
      .map(g => ({ gamePk: g.gamePk, level: g.sport?.name ?? null }));

    for (const g of games) {
      const feed = await getLiveFeed(g.gamePk);
      const [hr] = extractHomeRuns(feed, watchedIds, g.level);
      if (hr) return { ...hr, date };
    }
  }
  return null;
}

async function main() {
  const hr = await findRecentJewishHR();
  if (!hr) {
    console.log('No Jewish HRs found in the last 7 days — nothing to post');
    return;
  }

  [hr.careerHRs, hr.seasonHRs] = await Promise.all([
    getCareerHomeRuns(hr.batterId, hr.isMiLB),
    getSeasonHomeRuns(hr.batterId, hr.isMiLB),
  ]);

  const text = formatPost(hr);
  const video = await getHighlightVideo(hr.gamePk, hr.batterId);
  console.log(`Using HR from ${hr.date}:`);
  console.log(text);
  console.log(video ? `Video: ${video.url}` : 'No highlight video found — posting without video');
  await sendPost(text, video);
  console.log('Posted!');
}

main().catch(e => { console.error(e.message); process.exit(1); });
