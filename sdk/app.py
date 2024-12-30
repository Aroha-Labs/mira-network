from src.mira_sdk.client import MiraClient

async def main():
    async with MiraClient(
        base_url="https://mira-client-balancer.alts.dev",
        api_token="sk-mira-8ac810228d32ff68fc93266fb9a0ba612724119ffab16dcc"
    ) as client:
        models = await client.list_models()
        print(models)

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())