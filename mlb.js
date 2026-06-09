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
  const sportIds = includeMiLB ? Object.values(SPORT_IDS).join(',') : String(SPORT_IDS.MLB);

  const fetchForDate = async (offsetDays) => {
    const dt = new Date();
    dt.setDate(dt.getDate() + offsetDays);
    const date = dt.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const { data } = await axios.get(`${BASE}/api/v1/schedule`, {
      params: { sportId: sportIds, date, gameType: 'R' },
    });
    return data.dates?.flatMap(d => d.games) ?? [];
  };

  const [todayGames, yesterdayGames] = await Promise.all([
    fetchForDate(0),
    fetchForDate(-1),
  ]);

  const spillover = yesterdayGames.filter(g => g.status.abstractGameState !== 'Preview');

  return [...spillover, ...todayGames]
    .filter(g => g.status.abstractGameState !== 'Preview')
    .map(g => ({ gamePk: g.gamePk, level: g.sport?.name ?? null }));
}

const LIVE_FEED_FIELDS = [
  'liveData', 'plays', 'allPlays',
  'result', 'eventType', 'rbi', 'awayScore', 'homeScore',
  'about', 'atBatIndex', 'isComplete', 'inning', 'halfInning',
  'matchup', 'batter', 'pitcher', 'id', 'fullName',
  'hitData', 'totalDistance', 'launchSpeed', 'launchAngle', 'trajectory', 'playEvents',
  'gameData', 'game', 'pk',
  'teams', 'home', 'away', 'abbreviation',
].join(',');

async function getLiveFeed(gamePk) {
  const { data } = await axios.get(`${BASE}/api/v1.1/game/${gamePk}/feed/live`, {
    params: { fields: LIVE_FEED_FIELDS },
  });
  return data;
}

function getHitData(play) {
  return play.hitData ?? play.playEvents?.find(pe => pe.hitData)?.hitData ?? null;
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
    .map(p => {
      const hitData = getHitData(p);
      return {
      playId:      `${gamePk}_${p.about.atBatIndex}`,
      gamePk,
      batterId:    p.matchup.batter.id,
      playerName:  p.matchup.batter.fullName,
      pitcher:     p.matchup?.pitcher?.fullName ?? null,
      rbi:         p.result?.rbi          ?? null,
      awayScore:   p.result?.awayScore    ?? null,
      homeScore:   p.result?.homeScore    ?? null,
      distance:    hitData?.totalDistance ?? null,
      exitVelo:    hitData?.launchSpeed   ?? null,
      launchAngle: hitData?.launchAngle   ?? null,
      trajectory:  hitData?.trajectory    ?? null,
      inning:      p.about.inning,
      halfInning:  p.about.halfInning,
      homeTeam,
      awayTeam,
      isMiLB,
      level: isMiLB ? level : null,
    };
    });
}

const MILB_SPORT_IDS = [11, 12, 13, 14, 16];

async function fetchHRStat(playerId, statType, isMiLB) {
  const season = new Date().getFullYear();
  const params = (sportId) => ({ stats: statType, group: 'hitting', sportId, ...(statType === 'season' ? { season } : {}) });
  try {
    if (!isMiLB) {
      const { data } = await axios.get(`${BASE}/api/v1/people/${playerId}/stats`, { params: params(1) });
      return data.stats?.[0]?.splits?.[0]?.stat?.homeRuns ?? null;
    }
    const sportIds = [1, ...MILB_SPORT_IDS];
    const results = await Promise.allSettled(
      sportIds.map(sportId =>
        axios.get(`${BASE}/api/v1/people/${playerId}/stats`, { params: params(sportId) })
          .then(r => r.data.stats?.[0]?.splits?.[0]?.stat?.homeRuns ?? 0)
      )
    );
    const total = results.filter(r => r.status === 'fulfilled').reduce((sum, r) => sum + r.value, 0);
    return total > 0 ? total : null;
  } catch {
    return null;
  }
}

async function getCareerHomeRuns(playerId, isMiLB) {
  return fetchHRStat(playerId, 'career', isMiLB);
}

async function getSeasonHomeRuns(playerId, isMiLB) {
  return fetchHRStat(playerId, 'season', isMiLB);
}

async function getHighlightVideo(gamePk, batterId) {
  try {
    const { data } = await axios.get(`${BASE}/api/v1/game/${gamePk}/content`);
    const items = data.highlights?.highlights?.items ?? [];
    const match = items.find(item => {
      const keywords = item.keywordsAll ?? [];
      const isBatter  = keywords.some(k => k.type === 'player_id' && k.value === String(batterId));
      const isHomeRun = keywords.some(k => k.type === 'taxonomy' && k.value === 'home-run');
      return isBatter && isHomeRun;
    });
    if (!match) return null;

    const playback = (match.playbacks ?? []).find(p => p.name === 'mp4Avc');
    if (!playback?.url) return null;

    const dimensions = playback.url.match(/_(\d+)x(\d+)_/);
    const aspectRatio = dimensions
      ? { width: Number(dimensions[1]), height: Number(dimensions[2]) }
      : { width: 16, height: 9 };

    return { url: playback.url, aspectRatio };
  } catch {
    return null;
  }
}

module.exports = { getTodaysGames, getLiveFeed, extractHomeRuns, getCareerHomeRuns, getSeasonHomeRuns, getHighlightVideo };
