import asyncio
import json
from mira_network import MiraClient


async def main():
    client = MiraClient(
        api_key="sk-mira-701d920ff62d74d337edcff20870dc0958cc264721896264",
    )
    # models = await client.list_models()
    # print(json.dumps(models, indent=2))

    # api_tokens = await client.list_api_tokens()
    # print(json.dumps(api_tokens, indent=2))

    completion = await client.chat_completions_create(
        model="llama-3.3-70b-instruct",
        messages=[
            {"role": "system", "content": "your name is Hamid"},
            {"role": "user", "content": "who are you"},
        ],
    )
    print(json.dumps(completion, indent=2))

    # completion = await client.chat_completions_create(
    #     model="llama-3.3-70b-instruct",
    #     messages=[
    #         {"role": "system", "content": "you are Hamid?"},
    #         {"role": "user", "content": "who are you"},
    #     ],
    #     stream=True,
    # )
    # async for message in completion:
    #     print(json.dumps(message, indent=2))


# Properly run the asyncio event loop
if __name__ == "__main__":
    asyncio.run(main())
