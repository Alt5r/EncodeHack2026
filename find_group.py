import asyncio, os
from luffa_bot.client import AsyncLuffaClient

async def main():
    client = AsyncLuffaClient(os.environ["WATCHTOWER_LUFFA_ROBOT_KEY"])
    print("Polling — send the bot a DM or group message in Luffa...")
    for _ in range(30):
        envs = await client.receive()
        for env in envs:
            kind = "GROUP" if env.type == 1 else "DM"
            print(f"[{kind}] uid={env.uid}")
            for msg in env.messages:
                print(f"  msg: {msg.text!r}")
            if env.type == 1:
                print(f"\n✅ GROUP UID = {env.uid}\n")
            else:
                print(f"\n📩 DM from uid={env.uid} — try adding bot to a group\n")
        await asyncio.sleep(1)
    await client.aclose()

asyncio.run(main())
