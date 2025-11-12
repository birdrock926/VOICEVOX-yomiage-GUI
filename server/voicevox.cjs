const axios = require('axios');

const VOICEVOX_URL = process.env.VOICEVOX_URL || 'http://127.0.0.1:50021';
const DEFAULT_SPEAKER_ID = 3;

class VoiceVoxClient {
  constructor() {
    this.baseURL = VOICEVOX_URL;
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
    });
  }

  async checkHealth() {
    try {
      const response = await this.client.get('/version');
      console.log('[VoiceVox] Health check successful, version:', response.data);
      return true;
    } catch (error) {
      console.log('[VoiceVox] Health check failed:', error.message);
      return false;
    }
  }

  async getSpeakers() {
    try {
      const response = await this.client.get('/speakers');
      console.log('[VoiceVox] Successfully loaded', response.data.length, 'speakers');
      return response.data;
    } catch (error) {
      console.error('[VoiceVox] Failed to get speakers:', error.message);
      throw error;
    }
  }

  async synthesize(text, speakerId = DEFAULT_SPEAKER_ID, options = {}) {
    try {
      // Step 1: audio_query で音声パラメータを取得
      const queryResponse = await this.client.post('/audio_query', null, {
        params: {
          text: text,
          speaker: speakerId
        }
      });

      let query = queryResponse.data;

      // オプションでパラメータをカスタマイズ
      if (options.speedScale) query.speedScale = options.speedScale;
      if (options.pitchScale) query.pitchScale = options.pitchScale;
      if (options.intonationScale) query.intonationScale = options.intonationScale;
      if (options.volumeScale) query.volumeScale = options.volumeScale;

      // Step 2: synthesis で音声を生成
      const synthesisResponse = await this.client.post('/synthesis', query, {
        params: {
          speaker: speakerId
        },
        responseType: 'arraybuffer'
      });

      const buffer = Buffer.from(synthesisResponse.data);
      console.log('[VoiceVox] Synthesis successful, size:', buffer.length, 'bytes');
      return buffer;
    } catch (error) {
      console.error('[VoiceVox] Failed to synthesize voice:', error.message);
      throw error;
    }
  }

  async synthesizeFast(text, speakerId = DEFAULT_SPEAKER_ID, cancelToken = null) {
    try {
      const config = cancelToken ? { cancelToken } : {};

      // audio_query
      const queryResponse = await this.client.post('/audio_query', null, {
        ...config,
        params: { text, speaker: speakerId }
      });

      // synthesis
      const synthesisResponse = await this.client.post('/synthesis', queryResponse.data, {
        ...config,
        params: { speaker: speakerId },
        responseType: 'arraybuffer'
      });

      return Buffer.from(synthesisResponse.data);
    } catch (error) {
      if (axios.isCancel(error)) {
        console.log('Request cancelled:', text);
        return null;
      }
      throw error;
    }
  }
}

module.exports = VoiceVoxClient;
