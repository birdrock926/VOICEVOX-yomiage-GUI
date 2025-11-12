import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import VoiceVoxClient from './voicevox.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;
const voicevox = new VoiceVoxClient();


app.use(cors());
app.use(express.json());


app.get('/api/health', async (req, res) => {
  const isVoicevoxHealthy = await voicevox.checkHealth();
  res.json({
    status: 'ok',
    voicevox: isVoicevoxHealthy ? 'connected' : 'disconnected'
  });
});


app.get('/api/speakers', async (req, res) => {
  try {
    const speakers = await voicevox.getSpeakers();
    res.json(speakers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.post('/api/synthesize', async (req, res) => {
  try {
    const { text, speakerId = 3 } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const audioBuffer = await voicevox.synthesize(text, speakerId);

    res.set({
      'Content-Type': 'audio/wav',
      'Content-Length': audioBuffer.length
    });
    res.send(audioBuffer);
  } catch (error) {
    console.error('Synthesis error:', error);
    res.status(500).json({ error: error.message });
  }
});


io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);


  socket.on('check_voicevox', async (callback) => {
    const isHealthy = await voicevox.checkHealth();
    callback({ connected: isHealthy });
  });


  socket.on('get_speakers', async (callback) => {
    try {
      const speakers = await voicevox.getSpeakers();
      callback({ success: true, speakers });
    } catch (error) {
      callback({ success: false, error: error.message });
    }
  });


  socket.on('synthesize', async (data, callback) => {
    const { text, speakerId = 3, options = {} } = data;

    if (!text || text.trim() === '') {
      callback({ success: false, error: 'Text is required' });
      return;
    }

    try {
      console.log(`Synthesizing: "${text}" (Speaker: ${speakerId})`);
      const startTime = Date.now();


      const audioBuffer = await voicevox.synthesize(text, speakerId, options);

      const elapsed = Date.now() - startTime;
      console.log(`Synthesis completed in ${elapsed}ms`);


      const audioBase64 = audioBuffer.toString('base64');

      callback({
        success: true,
        audio: audioBase64,
        elapsed,
        size: audioBuffer.length
      });
    } catch (error) {
      console.error('Synthesis error:', error);
      callback({
        success: false,
        error: error.message
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});


httpServer.listen(PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);


  const isConnected = await voicevox.checkHealth();
  if (isConnected) {
    console.log('✅ VOICEVOX Engine connected');
  } else {
    console.log('⚠️  VOICEVOX Engine not found. Please start VOICEVOX on http://127.0.0.1:50021');
  }
});
