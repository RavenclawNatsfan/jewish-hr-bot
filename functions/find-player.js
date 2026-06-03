// Utility to look up MLB player IDs by name.
// Usage: node find-player.js "Alex Bregman"
const https = require('https');

const name = process.argv[2];
if (!name) {
  console.log('Usage: node find-player.js "Player Name"');
  process.exit(1);
}

const url = `https://statsapi.mlb.com/api/v1/people/search?names=${encodeURIComponent(name)}&sportId=1`;
https.get(url, res => {
  let raw = '';
  res.on('data', c => (raw += c));
  res.on('end', () => {
    const json = JSON.parse(raw);
    const people = json.people ?? [];
    if (!people.length) {
      console.log('No results found. Try a partial last name, e.g. "Bregman"');
      return;
    }
    people.forEach(p =>
      console.log(`mlbId: ${p.id}  |  ${p.fullName}  |  ${p.primaryPosition?.abbreviation ?? ''}`)
    );
  });
});
