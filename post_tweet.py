import asyncio
import base64
import json
import os
import sys

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
