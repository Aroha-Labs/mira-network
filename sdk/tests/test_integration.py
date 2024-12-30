import pytest
from src.mira_sdk.client import MiraClient
from src.mira_sdk.models import Message, AiRequest, ModelProvider


@pytest.mark.asyncio
async def test_real_generate():
    """This test makes a real API call to generate text."""
    client = MiraClient(
        base_url="https://mira-client-balancer.alts.dev",
        api_token="sk-mira-8ac810228d32ff68fc93266fb9a0ba612724119ffab16dcc"
    )

    request = AiRequest(
        model="mira/llama3.1",
        messages=[Message(role="user", content="Hi Who are you!")],
        stream=False,
        model_provider=None
    )

    async with client:
        result = await client.generate(request)
        print("Real API Response:", result)
        # assert len(result) > 0


# @pytest.mark.asyncio
# async def test_real_generate_stream():
#     """This test makes a real API call with streaming enabled."""
#     client = MiraClient(
#         base_url="https://mira-client-balancer.alts.dev",
#         api_token="sk-mira-8ac810228d32ff68fc93266fb9a0ba612724119ffab16dcc"
#     )

#     request = AiRequest(
#         messages=[Message(role="user", content="Count from 1 to 5")],
#         stream=True
#     )

#     async with client:
#         stream = await client.generate(request)
#         response = ""
#         async for chunk in stream:
#             print("Chunk:", chunk)
#             response += chunk
#         print("Final Response:", response)
#         assert isinstance(response, str)
#         assert len(response) > 0
