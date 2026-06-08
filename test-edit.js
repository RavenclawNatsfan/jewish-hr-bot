// Test whether Bluesky PDS accepts putRecord to edit a post.
// Reads the existing post, prints its content, then attempts a no-op edit
// (same text, same embed) to confirm the API accepts it without error.
const { BskyAgent, RichText } = require('@atproto/api');

const POST_URI = process.argv[2];
if (!POST_URI) { console.error('Usage: node test-edit.js at://did/.../rkey'); process.exit(1); }

async function main() {
  const agent = new BskyAgent({ service: 'https://bsky.social' });
  await agent.login({ identifier: process.env.BSKY_HANDLE, password: process.env.BSKY_APP_PASSWORD });

  const [did, , rkey] = POST_URI.replace('at://', '').split('/');

  const { data: existing } = await agent.com.atproto.repo.getRecord({
    repo: did, collection: 'app.bsky.feed.post', rkey,
  });

  console.log('Current record:');
  console.log(JSON.stringify(existing.value, null, 2));

  // Attempt a no-op putRecord with the exact same content
  await agent.com.atproto.repo.putRecord({
    repo: did,
    collection: 'app.bsky.feed.post',
    rkey,
    record: existing.value,
  });

  console.log('\nputRecord succeeded — editing is supported.');
}

main().catch(e => { console.error('putRecord failed:', e.message); process.exit(1); });
