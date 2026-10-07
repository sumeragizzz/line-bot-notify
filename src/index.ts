/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { Hono } from "hono";
import { LineBotClient, validateSignature } from "@line/bot-sdk";

type LineEnv = Env & {
	LINE_CHANNEL_SECRET: string;
	LINE_CHANNEL_ACCESS_TOKEN: string;
};

type TextMessageEvent = {
	type: "message";
	replyToken: string;
	message: {
		type: "text";
		text: string;
	};
};

const app = new Hono<{ Bindings: LineEnv }>();

app.post("/callback", async (context) => {
	const channelSecret = context.env.LINE_CHANNEL_SECRET;
	const channelAccessToken = context.env.LINE_CHANNEL_ACCESS_TOKEN;
	const signature = context.req.header("x-line-signature");

	if (!channelSecret || !channelAccessToken) {
		return context.json({ error: "LINE credentials are not configured" }, 500);
	}

	if (!signature) {
		return context.json({ error: "Missing LINE signature" }, 401);
	}

	const body = await context.req.text();
	if (!validateSignature(body, channelSecret, signature)) {
		return context.json({ error: "Invalid LINE signature" }, 401);
	}

	let events: TextMessageEvent[];
	try {
		const payload = JSON.parse(body) as { events?: unknown[] };
		events = (payload.events ?? []).filter(isTextMessageEvent);
	} catch {
		return context.json({ error: "Invalid LINE webhook payload" }, 400);
	}

	const client = LineBotClient.fromChannelAccessToken({ channelAccessToken });
	try {
		await Promise.all(
			events.map((event) =>
				client.replyMessage({
					replyToken: event.replyToken,
					messages: [{ type: "text", text: event.message.text }],
				}),
			),
		);
	} catch (error) {
		console.error("LINE reply failed", error instanceof Error ? error.message : error);
		return context.json({ error: "Failed to reply through LINE" }, 502);
	}

	return context.json({ ok: true });
});

function isTextMessageEvent(event: unknown): event is TextMessageEvent {
	if (typeof event !== "object" || event === null) {
		return false;
	}

	const candidate = event as Partial<TextMessageEvent>;
	return (
		candidate.type === "message" &&
		typeof candidate.replyToken === "string" &&
		candidate.message?.type === "text" &&
		typeof candidate.message.text === "string"
	);
}

export default app;
