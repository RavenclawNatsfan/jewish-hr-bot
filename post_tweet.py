import asyncio
import base64
import json
import os
import re
import sys

# Monkey patch for twikit KEY_BYTE indices bug (broken since March 2026)
# https://github.com/d60/twikit/issues/408 — remove once twikit releases a fix
_tx_mod = __import__('twikit.x_client_transaction.transaction', fromlist=['ClientTransaction'])
_tx_mod.ON_DEMAND_FILE_REGEX = re.compile(r""",(\d+):["']ondemand\.s["']""", flags=(re.VERBOSE | re.MULTILINE))
_tx_mod.ON_DEMAND_HASH_PATTERN = r',{}:"([0-9a-f]+)"'
async def _patched_get_indices(self, home_page_response, session, headers):
    key_byte_indices = []
    response = self.validate_response(home_page_response) or self.home_page_response
    on_demand_file_index = _tx_mod.ON_DEMAND_FILE_REGEX.search(str(response)).group(1)
    regex = re.compile(_tx_mod.ON_DEMAND_HASH_PATTERN.format(on_demand_file_index))
    filename = regex.search(str(response)).group(1)
    on_demand_file_url = f"https://abs.twimg.com/responsive-web/client-web/ondemand.s.{filename}a.js"
    on_demand_file_response = await session.request(method="GET", url=on_demand_file_url, headers=headers)
    key_byte_indices_match = _tx_mod.INDICES_REGEX.finditer(str(on_demand_file_response.text))
    for item in key_byte_indices_match:
        key_byte_indices.append(item.group(2))
    if not key_byte_indices:
        raise Exception("Couldn't get KEY_BYTE indices")
    key_byte_indices = list(map(int, key_byte_indices))
    return key_byte_indices[0], key_byte_indices[1:]
_tx_mod.ClientTransaction.get_indices = _patched_get_indices

from twikit import Client

COOKIES_FILE = 'twitter_cookies.json'


async def main():
    if not os.path.exists('pending_tweet.json'):
        print('No pending tweet.')
        return

    with open('pending_tweet.json') as f:
        data = json.load(f)
    text = data['text']

    client = Client('en-US')

    # Prefer cookies stored as a GitHub secret (base64-encoded JSON)
    cookies_secret = os.environ.get('TWITTER_COOKIES')
    if cookies_secret:
        cookies = json.loads(base64.b64decode(cookies_secret).decode())
        client.set_cookies(cookies)
        print('Loaded cookies from secret.')
    elif os.path.exists(COOKIES_FILE):
        client.load_cookies(COOKIES_FILE)
        print('Loaded cookies from file.')
    else:
        print('No cookies found — logging in fresh.')
        await client.login(
            auth_info_1=os.environ['TWITTER_USERNAME'],
            auth_info_2=os.environ['TWITTER_EMAIL'],
            password=os.environ['TWITTER_PASSWORD'],
        )
        client.save_cookies(COOKIES_FILE)
        print('Saved cookies.')

    await client.create_tweet(text=text)
    print(f'Tweeted: {text[:80]}')

    os.remove('pending_tweet.json')


asyncio.run(main())
