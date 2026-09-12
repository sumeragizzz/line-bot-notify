import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index";

const channelSecret = "test-channel-secret";
const channelAccessToken = "test-channel-access-token";
const testEnv = {
	LINE_CHANNEL_SECRET: channelSecret,
	LINE_CHANNEL_ACCESS_TOKEN: channelAccessToken,
} as Env;

describe("LINE webhook", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("echoes text messages through LINE reply API", async () => {
		const lineFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response("{}", { status: 200 }),
		);
		const body = JSON.stringify({
			events: [
				{
					type: "message",
					replyToken: "reply-token",
					message: { type: "text", text: "hello" },
				},
			],
		});

		const response = await sendWebhook(body);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true });
		expect(lineFetch).toHaveBeenCalledOnce();
		const requestBody = String(lineFetch.mock.calls[0][1]?.body);
		expect(requestBody).toContain('"replyToken":"reply-token"');
		expect(requestBody).toContain('"text":"hello"');
	});

	it("rejects an invalid signature before processing the payload", async () => {
		const lineFetch = vi.spyOn(globalThis, "fetch");

		const response = await sendWebhook("{\"events\":[]}", "invalid-signature");

		expect(response.status).toBe(401);
		expect(lineFetch).not.toHaveBeenCalled();
	});

	it("ignores non-text events without calling LINE reply API", async () => {
		const lineFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response("{}", { status: 200 }),
		);
		const body = JSON.stringify({
			events: [{ type: "follow", replyToken: "reply-token" }],
		});

		const response = await sendWebhook(body);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true });
		expect(lineFetch).not.toHaveBeenCalled();
	});
});

async function sendWebhook(body: string, signature = awaitSignature(body)) {
	const context = createExecutionContext();
	const request = new Request("https://example.com/callback", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			"x-line-signature": await signature,
		},
		body,
	});
	const response = await worker.fetch(request, testEnv, context);
	await waitOnExecutionContext(context);
	return response;
}

async function awaitSignature(body: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(channelSecret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
	return btoa(String.fromCharCode(...new Uint8Array(digest)));
}
