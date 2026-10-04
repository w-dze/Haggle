// One-off: register the `request_user_approval` client tool on the ElevenLabs
// agent and push prompts/negotiator.system.md as its system prompt.
// Usage: node scripts/el-setup-live.mjs
import { readFileSync } from "node:fs";
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

const key = process.env.ELEVENLABS_API_KEY;
const agentId = process.env.ELEVENLABS_AGENT_ID;
if (!key || !agentId) throw new Error("ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID are required");

const api = async (method, path, body) => {
  const res = await fetch(`https://api.elevenlabs.io${path}`, {
    method,
    headers: { "xi-api-key": key, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : {};
};

const TOOL_NAME = "request_user_approval";
const toolConfig = {
  type: "client",
  name: TOOL_NAME,
  description:
    "Ask the account holder to approve an offer before agreeing to it. Blocks until they answer. Returns JSON {approved: boolean, reason: string}.",
  expects_response: true,
  response_timeout_secs: 60,
  parameters: {
    type: "object",
    properties: {
      summary: { type: "string", description: "One sentence describing the offer, in English." },
      monthly_price: { type: "number", description: "Offered monthly price in dollars." },
    },
    required: ["summary", "monthly_price"],
  },
};

const { tools = [] } = await api("GET", "/v1/convai/tools");
const existing = tools.find((t) => t.tool_config?.name === TOOL_NAME);
let toolId;
if (existing) {
  toolId = existing.id;
  await api("PATCH", `/v1/convai/tools/${toolId}`, { tool_config: toolConfig });
  console.log("updated tool", toolId);
} else {
  toolId = (await api("POST", "/v1/convai/tools", { tool_config: toolConfig })).id;
  console.log("created tool", toolId);
}

const prompt = readFileSync("prompts/negotiator.system.md", "utf8").replace(/^# .*\n+/, "");
const agent = await api("GET", `/v1/convai/agents/${agentId}`);
const toolIds = new Set(agent.conversation_config?.agent?.prompt?.tool_ids ?? []);
toolIds.add(toolId);

await api("PATCH", `/v1/convai/agents/${agentId}`, {
  conversation_config: {
    agent: { prompt: { prompt, tool_ids: [...toolIds] } },
  },
});
console.log("agent updated with", toolIds.size, "tool(s)");
