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
