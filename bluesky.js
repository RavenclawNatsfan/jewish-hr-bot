const { BskyAgent } = require('@atproto/api');

async function sendPost(text) {
  const agent = new BskyAgent({ service: 'https://bsky.social' });
  await agent.login({
    identifier: process.env.BSKY_HANDLE,
    password:   process.env.BSKY_APP_PASSWORD,
  });
  await agent.post({ text });
}

function formatPost(hr) {
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

module.exports = { sendPost, formatPost };
