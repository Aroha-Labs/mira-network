import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "unused",
  baseURL: "https://gateway.ai.cloudflare.com/v1/b9d9855d1fdfcd9fb504dc752c05499f/mira-router-mira-gateway-dev/compat",
  defaultHeaders: {
    "cf-aig-authorization": `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
  },
});

const response = await client.chat.completions.create({
  model: "workers-ai/@cf/meta/llama-3.1-8b-instruct",
  messages: [{ role: "user", content: "Say hello in one word" }],
});

console.log(response.choices[0].message.content);
