import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
// @ts-ignore
import { google } from "googleapis";
import { UserData } from "./types/UserData";
import { ConfigData } from "./types/ConfigData";

admin.initializeApp();

const config = functions.config() as ConfigData;
const { client_key, secret_key, redirect_uri } = config.oauth;
const { video_id } = config.data;

const oauth = new google.auth.OAuth2(client_key, secret_key, redirect_uri);

const update = async () => {
	if (video_id == undefined) return;

	const doc = await admin.firestore().collection("token").doc("user").get();

	if (!doc.exists) return;
	if (doc.data() == undefined) return;

	const data = doc.data() as UserData;

	oauth.setCredentials({
		refresh_token: data.refresh_token,
	});

	const youtube = google.youtube({
		version: "v3",
		auth: oauth,
	});

	const result = await youtube.videos.list({
		id: video_id,
		part: "statistics,snippet",
	});

	if (result.data.items == undefined) return;

	const video = result.data.items[0];
	if (video.snippet == undefined) return;
	if (video.statistics == undefined) return;

	const { viewCount } = video.statistics;

	const newTitle = `I made a bot that knows that this video has ${viewCount} views!`;

	const updateResult = await youtube.videos.update({
		requestBody: {
			id: video_id,
			snippet: {
				title: newTitle,
				categoryId: video.snippet.categoryId,
			},
		},
		part: "snippet",
	});

	console.log(updateResult.status);
};

export const callback = functions.https.onRequest(async (req, res) => {
	const doc = await admin.firestore().collection("token").doc("user").get();

	if (doc.exists) {
		res.send("Value already in storage.");
		return;
	}

	const code = req.query.code;

	if (typeof code != "string") return;

	try {
		const { tokens } = await oauth.getToken(code);
		const { refresh_token } = tokens;

		if (refresh_token == undefined) return;

		await admin.firestore().doc("token/user").set({
			refresh_token,
		});

		res.send("Successfully logged in!");
	} catch (error) {
		res.send("There was an error...");
	}
});

export const auth = functions.https.onRequest(async (req, res) => {
	const doc = await admin.firestore().collection("token").doc("user").get();

	if (doc.exists) {
		res.send("Value already in storage.");
		return;
	}

	const scopes = [
		"profile",
		"email",
		"https://www.googleapis.com/auth/youtube",
	];

	const url = oauth.generateAuthUrl({
		access_type: "offline",
		scope: scopes,
	});

	res.redirect(url);
});

export const updateJob = functions.pubsub
	.schedule("every 3 minutes")
	.onRun(update);
