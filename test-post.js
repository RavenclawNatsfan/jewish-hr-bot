const axios = require('axios');
const { sendPost, formatPost } = require('./bluesky');
const { getCareerHomeRuns, getSeasonHomeRuns } = require('./mlb');
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
      const { data: feed } = await axios.get(`${BASE}/api/v1.1/game/${g.gamePk}/feed/live`, {
        params: { fields: 'liveData,plays,allPlays,result,eventType,rbi,awayScore,homeScore,about,atBatIndex,isComplete,inning,halfInning,matchup,batter,pitcher,id,fullName,hitData,totalDistance,launchSpeed,launchAngle,gameData,game,pk,teams,home,away,abbreviation' },
      });

      const plays = feed.liveData?.plays?.allPlays ?? [];
      const homeTeam = feed.gameData?.teams?.home?.abbreviation ?? '???';
      const awayTeam = feed.gameData?.teams?.away?.abbreviation ?? '???';
      const isMiLB = g.level && !['American League', 'National League', 'MLB'].includes(g.level);

      for (const p of plays) {
        if (p.result?.eventType === 'home_run' && p.about?.isComplete && watchedIds.has(p.matchup?.batter?.id)) {
          return {
            gamePk:      g.gamePk,
            batterId:    p.matchup.batter.id,
            playerName:  p.matchup.batter.fullName,
            rbi:         p.result?.rbi          ?? null,
            awayScore:   p.result?.awayScore    ?? null,
            homeScore:   p.result?.homeScore    ?? null,
            distance:    p.hitData?.totalDistance ?? null,
            exitVelo:    p.hitData?.launchSpeed   ?? null,
            launchAngle: p.hitData?.launchAngle   ?? null,
            inning:      p.about.inning,
            halfInning:  p.about.halfInning,
            homeTeam, awayTeam, isMiLB,
            level: isMiLB ? g.level : null,
            date,
          };
        }
      }
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
  console.log(`Using HR from ${hr.date}:`);
  console.log(text);
  await sendPost(text);
  console.log('Posted!');
}

main().catch(e => { console.error(e.message); process.exit(1); });
