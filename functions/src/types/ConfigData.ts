export interface ConfigData {
	oauth: {
		client_key?: string;
		secret_key?: string;
		redirect_uri?: string;
	};
	data: {
		video_id?: string;
	};
}
