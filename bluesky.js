const axios = require('axios');
const { BskyAgent, RichText } = require('@atproto/api');

async function sendPost(text, gamePk = null) {
  const agent = new BskyAgent({ service: 'https://bsky.social' });
  await agent.login({
    identifier: process.env.BSKY_HANDLE,
    password:   process.env.BSKY_APP_PASSWORD,
  });

  const rt = new RichText({ text });
  await rt.detectFacets(agent);

  const post = { text: rt.text, facets: rt.facets };

  if (gamePk) {
    post.embed = {
      $type: 'app.bsky.embed.external',
      external: {
        uri:         `https://baseballtheater.club/game/${gamePk}`,
        title:       'Watch on Baseball Theater',
        description: 'Home run highlight',
      },
    };
  }

  await agent.post(post);
}

function formatPost(hr) {
  const isWalkOff = hr.halfInning === 'bottom' && hr.inning >= 9
    && hr.homeScore != null && hr.homeScore > hr.awayScore;

  const arrow = hr.halfInning === 'top' ? '▲' : '▼';
  const levelTag = hr.level ? ` (${hr.level})` : '';
  const hrTag = hr.seasonHRs != null && hr.careerHRs != null
    ? ` (No. ${hr.seasonHRs} this year, #${hr.careerHRs} career)`
    : hr.seasonHRs != null ? ` (No. ${hr.seasonHRs} this year)`
    : hr.careerHRs != null ? ` (career #${hr.careerHRs})`
    : '';
  const opener = isWalkOff
    ? `🚨 WALK-OFF! ⚾️💥 ${hr.playerName} goes DEEP!${hrTag}${levelTag}`
    : `⚾️💥 ${hr.playerName} goes DEEP!${hrTag}${levelTag}`;
  const lines = [opener];

  const gameInfo = [`${arrow}${hr.inning}`];
  if (hr.rbi != null) gameInfo.push(`${hr.rbi} RBI`);
  if (hr.awayScore != null && hr.homeScore != null) {
    gameInfo.push(`${hr.awayTeam} ${hr.awayScore}, ${hr.homeTeam} ${hr.homeScore}`);
  } else {
    gameInfo.push(`${hr.awayTeam} @ ${hr.homeTeam}`);
  }
  lines.push(gameInfo.join(' · '));

  const stats = [];
  if (hr.distance)    stats.push(`📏 ${Math.round(hr.distance)} ft`);
  if (hr.exitVelo)    stats.push(`🚀 ${Math.round(hr.exitVelo)} mph`);
  if (hr.launchAngle) stats.push(`📐 ${Math.round(hr.launchAngle)}°`);
  if (stats.length) lines.push(stats.join(' · '));

  const tags = hr.level ? '#MiLB #HomeRun #JewishMLB' : '#MLB #HomeRun #JewishMLB';
  lines.push(isWalkOff ? tags + ' #WalkOff' : tags);

  return lines.join('\n');
}

module.exports = { sendPost, formatPost };
