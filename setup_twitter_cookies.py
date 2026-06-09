"""
Run this once locally to generate Twitter cookies for GitHub Actions.

  pip install twikit
  python setup_twitter_cookies.py

Then base64-encode the output and store it as a GitHub Actions secret
named TWITTER_COOKIES:

  On Mac/Linux:  base64 -i twitter_cookies.json | pbcopy
  On Windows:    [Convert]::ToBase64String([IO.File]::ReadAllBytes('twitter_cookies.json')) | clip
"""
import asyncio
import base64
import json
import re

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

USERNAME = input('Twitter username: ')
EMAIL    = input('Twitter email: ')
PASSWORD = input('Twitter password: ')

async def main():
    client = Client('en-US')
    await client.login(auth_info_1=USERNAME, auth_info_2=EMAIL, password=PASSWORD)
    client.save_cookies('twitter_cookies.json')
    encoded = base64.b64encode(open('twitter_cookies.json', 'rb').read()).decode()
    print('\n--- Copy the line below and save it as GitHub secret TWITTER_COOKIES ---')
    print(encoded)
    print('--- End ---\n')
    print('Also saved to twitter_cookies.json (do not commit this file).')

asyncio.run(main())
