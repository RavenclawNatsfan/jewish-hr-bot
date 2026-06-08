const axios = require('axios');
const { BskyAgent, RichText } = require('@atproto/api');

async function sendPost(text, video = null) {
  const agent = new BskyAgent({ service: 'https://bsky.social' });
  await agent.login({
    identifier: process.env.BSKY_HANDLE,
    password:   process.env.BSKY_APP_PASSWORD,
  });

  const rt = new RichText({ text });
  await rt.detectFacets(agent);

  const post = { text: rt.text, facets: rt.facets };

  if (video) {
    try {
      const { data: videoData } = await axios.get(video.url, { responseType: 'arraybuffer' });
      const buf = Buffer.from(videoData);
      // MLB videos have ftyp major brand "M4V " (bytes 8-11) which the AT proto PDS
      // sniffs as video/x-m4v, rejected by the Bluesky lexicon. Patch to "mp42" —
      // same ISO base media container, only the brand hint differs.
      if (buf.length > 12 && buf.slice(4, 8).toString('ascii') === 'ftyp' && buf.slice(8, 12).toString('ascii').startsWith('M4V')) {
        buf.write('mp42', 8, 'ascii');
      }
      const { data: blob } = await agent.uploadBlob(buf, { encoding: 'video/mp4' });
      post.embed = {
        $type: 'app.bsky.embed.video',
        video: blob.blob,
        aspectRatio: video.aspectRatio,
      };
    } catch (err) {
      console.error('Video upload failed, posting without video:', err.message);
    }
  }

  await agent.post(post);
}

function fmt(n) {
  const r = Math.round(n * 10) / 10;
  return r % 1 === 0 ? String(Math.round(r)) : r.toFixed(1);
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
  if (hr.distance)    stats.push(`${fmt(hr.distance)} ft`);
  if (hr.exitVelo)    stats.push(`${fmt(hr.exitVelo)} mph`);
  if (hr.launchAngle) stats.push(`${fmt(hr.launchAngle)}°`);
  if (stats.length) lines.push(stats.join(' · '));

  const tags = hr.level ? '#MiLB #HomeRun #JewishBaseball' : '#MLB #HomeRun #JewishBaseball';
  lines.push(isWalkOff ? tags + ' #WalkOff' : tags);

  return lines.join('\n');
}

module.exports = { sendPost, formatPost };
