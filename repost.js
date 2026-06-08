// One-off script: edit existing posts with old emoji stat format to use new format.
const { BskyAgent, RichText } = require('@atproto/api');
const axios = require('axios');
const { getLiveFeed, extractHomeRuns, getCareerHomeRuns, getSeasonHomeRuns, getHighlightVideo } = require('./mlb');
const config = require('./players');

const BASE = 'https://statsapi.mlb.com';
const SPORT_IDS = [1, 11, 12, 13, 14, 16];
const watchedIds = new Set(config.players.map(p => p.mlbId));

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

  const tags = hr.level ? '#MiLB #HomeRun #JewishMLB' : '#MLB #HomeRun #JewishMLB';
  lines.push(isWalkOff ? tags + ' #WalkOff' : tags);

  return lines.join('\n');
}

async function findHRForPlayer(playerName, daysBack = 10) {
  for (let d = 0; d <= daysBack; d++) {
    const date = new Date();
    date.setDate(date.getDate() - d);
    const dateStr = date.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

    const { data: sched } = await axios.get(`${BASE}/api/v1/schedule`, {
      params: { sportId: SPORT_IDS.join(','), date: dateStr, gameType: 'R' },
    });
    if (!sched.dates?.length) continue;

    const games = sched.dates.flatMap(d => d.games)
      .filter(g => g.status.abstractGameState !== 'Preview')
      .map(g => ({ gamePk: g.gamePk, level: g.sport?.name ?? null }));

    for (const g of games) {
      const feed = await getLiveFeed(g.gamePk);
      const hrs = extractHomeRuns(feed, watchedIds, g.level);
      const match = hrs.find(hr => hr.playerName === playerName);
      if (match) return { ...match, date: dateStr };
    }
  }
  return null;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) console.log('[DRY RUN — no posts will be modified]\n');

  const agent = new BskyAgent({ service: 'https://bsky.social' });
  await agent.login({
    identifier: process.env.BSKY_HANDLE,
    password:   process.env.BSKY_APP_PASSWORD,
  });

  const { data } = await agent.getAuthorFeed({ actor: process.env.BSKY_HANDLE, limit: 50 });
  const oldPosts = data.feed
    .map(item => item.post)
    .filter(p => p.record?.text?.includes('goes DEEP!') && /📏|🚀|📐/.test(p.record.text));

  if (!oldPosts.length) {
    console.log('No posts with old emoji stat format found.');
    return;
  }

  console.log(`Found ${oldPosts.length} post(s) to edit.`);

  for (const post of oldPosts) {
    const text = post.record.text;
    console.log('\nProcessing:', text.split('\n')[0]);

    const nameMatch = text.match(/(?:🚨 WALK-OFF! )?⚾️💥 (.+?) goes DEEP!/);
    if (!nameMatch) { console.log('  Could not parse player name, skipping.'); continue; }
    const playerName = nameMatch[1];

    const hr = await findHRForPlayer(playerName);
    if (!hr) { console.log(`  Could not find HR data for ${playerName}, skipping.`); continue; }

    [hr.careerHRs, hr.seasonHRs] = await Promise.all([
      getCareerHomeRuns(hr.batterId, hr.isMiLB),
      getSeasonHomeRuns(hr.batterId, hr.isMiLB),
    ]);

    const newText = formatPost(hr);
    const video = await getHighlightVideo(hr.gamePk, hr.batterId);

    if (dryRun) {
      console.log('  Would edit to:\n' + newText.split('\n').map(l => '    ' + l).join('\n'));
      console.log('  Video:', video ? video.url : 'none (keep existing embed)');
      continue;
    }

    const rt = new RichText({ text: newText });
    await rt.detectFacets(agent);

    const [did, , rkey] = post.uri.replace('at://', '').split('/');

    // Build updated record, preserving createdAt and existing embed if no new video
    const updatedRecord = {
      ...post.record,
      text: rt.text,
      facets: rt.facets,
    };

    if (video) {
      try {
        const { data: videoData } = await axios.get(video.url, { responseType: 'arraybuffer' });
        const buf = Buffer.from(videoData);
        if (buf.length > 12 && buf.slice(4, 8).toString('ascii') === 'ftyp' && buf.slice(8, 12).toString('ascii').startsWith('M4V')) {
          buf.write('mp42', 8, 'ascii');
        }
        const { data: blob } = await agent.uploadBlob(buf, { encoding: 'video/mp4' });
        updatedRecord.embed = {
          $type: 'app.bsky.embed.video',
          video: blob.blob,
          aspectRatio: video.aspectRatio,
        };
      } catch (err) {
        console.error('  Video upload failed, keeping existing embed:', err.message);
      }
    }

    await agent.com.atproto.repo.putRecord({
      repo: did,
      collection: 'app.bsky.feed.post',
      rkey,
      record: updatedRecord,
    });

    console.log(`  Edited: ${playerName}${video ? ' (video refreshed)' : ' (existing embed kept)'}`);
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
