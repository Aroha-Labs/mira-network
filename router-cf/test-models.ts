const ACCOUNT_ID = "b9d9855d1fdfcd9fb504dc752c05499f";
const GATEWAY_ID = "mira-router-mira-gateway-dev";
const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN!;
const BASE_URL = `https://gateway.ai.cloudflare.com/v1/${ACCOUNT_ID}/${GATEWAY_ID}/openrouter`;

const models: Record<string, string> = {
  "claude-haiku-4.5": "anthropic/claude-3-5-haiku",
  "gpt-5.2": "openai/gpt-5.2",
  "gpt-4o-mini": "openai/gpt-4o-mini",
  "gemini-3-flash": "google/gemini-2.5-flash",
  "deepseek-v3.2": "deepseek/deepseek-chat",
};

async function testModel(name: string, openRouterModel: string) {
  const start = Date.now();
  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "cf-aig-authorization": `Bearer ${CF_TOKEN}`,
        "cf-aig-byok-alias": "default",
      },
      body: JSON.stringify({
        model: openRouterModel,
        messages: [{ role: "user", content: "Say hi in 5 words" }],
      }),
    });

    const elapsed = Date.now() - start;
    const data = await res.json();

    if (!res.ok) {
      return { name, status: "FAIL", code: res.status, error: data, elapsed };
    }

    const content = (data as any).choices?.[0]?.message?.content?.slice(0, 80);
    return { name, status: "OK", code: res.status, response: content, elapsed };
  } catch (err: any) {
    return { name, status: "ERROR", error: err.message, elapsed: Date.now() - start };
  }
}

console.log(`Testing ${Object.keys(models).length} models directly against AI Gateway + OpenRouter BYOK\n`);
console.log(`Gateway: ${BASE_URL}\n`);

const results = await Promise.all(
  Object.entries(models).map(([name, model]) => testModel(name, model))
);

for (const r of results) {
  const icon = r.status === "OK" ? "✅" : "❌";
  console.log(`${icon} ${r.name.padEnd(20)} ${r.status.padEnd(6)} ${r.elapsed}ms`);
  if (r.status === "OK") {
    console.log(`   → ${(r as any).response}`);
  } else {
    console.log(`   → ${JSON.stringify((r as any).error)}`);
  }
  console.log();
}

const passed = results.filter((r) => r.status === "OK").length;
console.log(`Result: ${passed}/${Object.keys(models).length} models passed`);
