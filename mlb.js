const axios = require('axios');

const BASE = 'https://statsapi.mlb.com';

const SPORT_IDS = {
  MLB:      1,
  'AAA':    11,
  'AA':     12,
  'High-A': 13,
  'A':      14,
  'Rookie': 16,
};

async function getTodaysGames(includeMiLB = false) {
  const date = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const sportIds = includeMiLB ? Object.values(SPORT_IDS).join(',') : String(SPORT_IDS.MLB);

  const { data } = await axios.get(`${BASE}/api/v1/schedule`, {
    params: { sportId: sportIds, date, gameType: 'R' },
  });

  if (!data.dates?.length) return [];
  return data.dates
    .flatMap(d => d.games)
    .filter(g => g.status.abstractGameState !== 'Preview')
    .map(g => ({ gamePk: g.gamePk, level: g.sport?.name ?? null }));
}

const LIVE_FEED_FIELDS = [
  'liveData', 'plays', 'allPlays',
  'result', 'eventType',
  'about', 'atBatIndex', 'isComplete', 'inning', 'halfInning',
  'matchup', 'batter', 'id', 'fullName',
  'hitData', 'totalDistance', 'launchSpeed', 'launchAngle',
  'gameData', 'game', 'pk',
  'teams', 'home', 'away', 'abbreviation',
].join(',');

async function getLiveFeed(gamePk) {
  const { data } = await axios.get(`${BASE}/api/v1.1/game/${gamePk}/feed/live`, {
    params: { fields: LIVE_FEED_FIELDS },
  });
  return data;
}

function extractHomeRuns(feed, watchedIds, level) {
  const plays = feed.liveData?.plays?.allPlays ?? [];
  const gamePk = feed.gameData?.game?.pk;
  const homeTeam = feed.gameData?.teams?.home?.abbreviation ?? '???';
  const awayTeam = feed.gameData?.teams?.away?.abbreviation ?? '???';
  const isMiLB = level && !['American League', 'National League', 'MLB'].includes(level);

  return plays
    .filter(p =>
      p.result?.eventType === 'home_run' &&
      p.about?.isComplete &&
      watchedIds.has(p.matchup?.batter?.id)
    )
    .map(p => ({
      playId: `${gamePk}_${p.about.atBatIndex}`,
      playerName: p.matchup.batter.fullName,
      distance:    p.hitData?.totalDistance ?? null,
      exitVelo:    p.hitData?.launchSpeed   ?? null,
      launchAngle: p.hitData?.launchAngle   ?? null,
      inning:      p.about.inning,
      halfInning:  p.about.halfInning,
      homeTeam,
      awayTeam,
      level: isMiLB ? level : null,
    }));
}

module.exports = { getTodaysGames, getLiveFeed, extractHomeRuns };
