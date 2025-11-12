import { useEffect, useRef, useState } from 'react';

export default function AudioPlayer({ audioData, onPlayStart, onPlayEnd }) {
  const audioRef = useRef(null); // For VB Cable output (Discord/game)
  const localAudioRef = useRef(null); // For local output (user hearing)
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState(null);
  const isProcessingRef = useRef(false);
  const activeAudiosRef = useRef(0); // Track how many audio elements are still playing

  useEffect(() => {
    const initializeAudio = async () => {
      // Create audio element for VB Cable
      if (!audioRef.current) {
        audioRef.current = new Audio();
        // Try to set VB Audio Cable as output device
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const audioOutputs = devices.filter(d => d.kind === 'audiooutput');

          const vbCable = audioOutputs.find(d =>
            d.label.includes('VB-Audio') ||
            d.label.includes('CABLE Input') ||
            d.label.includes('VB Audio Cable')
          );

          if (vbCable && audioRef.current.setSinkId) {
            await audioRef.current.setSinkId(vbCable.deviceId);
          }
        } catch (err) {
          // Ignore errors
        }

        audioRef.current.onended = () => {
          activeAudiosRef.current--;
          if (activeAudiosRef.current === 0) {
            setIsPlaying(false);
            isProcessingRef.current = false;
            onPlayEnd?.();
          }
        };
        audioRef.current.onerror = (e) => {
          activeAudiosRef.current--;
          if (activeAudiosRef.current === 0) {
            setError('Playback failed');
            setIsPlaying(false);
            isProcessingRef.current = false;
            onPlayEnd?.();
          }
        };
      }

      // Create audio element for local output (user hearing)
      if (!localAudioRef.current) {
        localAudioRef.current = new Audio();
        // Don't set sinkId - just use default output device
        localAudioRef.current.volume = 1.0;

        localAudioRef.current.onplay = () => {
          setIsPlaying(true);
          setError(null);
        };
        localAudioRef.current.onended = () => {
          activeAudiosRef.current--;
          if (activeAudiosRef.current === 0) {
            setIsPlaying(false);
            isProcessingRef.current = false;
            onPlayEnd?.();
          }
        };
        localAudioRef.current.onerror = (e) => {
          console.error('[AudioPlayer] Local audio error:', e);
          activeAudiosRef.current--;
          if (activeAudiosRef.current === 0) {
            setError('Playback failed');
            setIsPlaying(false);
            isProcessingRef.current = false;
            onPlayEnd?.();
          }
        };
      }
    };

    initializeAudio();

    // Cleanup
    return () => {
      if (audioRef.current) {
        try {
          audioRef.current.pause();
          audioRef.current.src = '';
        } catch (err) {
          console.error('[AudioPlayer] Cleanup error:', err);
        }
      }
      if (localAudioRef.current) {
        try {
          localAudioRef.current.pause();
          localAudioRef.current.src = '';
        } catch (err) {
          console.error('[AudioPlayer] Cleanup error:', err);
        }
      }
    };
  }, []);

  useEffect(() => {
    if (audioData && audioData.data && !isProcessingRef.current) {
      playAudio(audioData.data);
    }
  }, [audioData]); // audioData changes with timestamp, forcing re-play

  const playAudio = async (base64Audio) => {
    // Prevent multiple simultaneous playback attempts
    if (isProcessingRef.current) {
      return;
    }

    isProcessingRef.current = true;

    try {
      setError(null);

      if (!audioRef.current || !localAudioRef.current) {
        const msg = 'Audio elements not initialized';
        console.error('[AudioPlayer]', msg);
        setError(msg);
        isProcessingRef.current = false;
        onPlayEnd?.();
        return;
      }

      // Stop any currently playing audio (both VB Cable and local)
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        localAudioRef.current.pause();
        localAudioRef.current.currentTime = 0;
      } catch (e) {
        // Ignore errors when stopping previous audio
      }

      // Call onPlayStart callback safely
      if (onPlayStart) {
        try {
          onPlayStart();
        } catch (callbackError) {
          console.error('[AudioPlayer] onPlayStart callback error:', callbackError);
        }
      }

      // Decode base64 to blob
      let blob;
      try {
        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Create blob from bytes (VOICEVOX returns WAV format)
        blob = new Blob([bytes], { type: 'audio/wav' });
      } catch (decodeError) {
        console.error('[AudioPlayer] Base64 decode error:', decodeError);
        setError('Base64 decode failed');
        setIsPlaying(false);
        isProcessingRef.current = false;
        onPlayEnd?.();
        return;
      }

      // Create object URL and play on both outputs
      try {
        const url = URL.createObjectURL(blob);

        // Clean up old URLs if exist
        if (audioRef.current.src) {
          try {
            URL.revokeObjectURL(audioRef.current.src);
          } catch (e) {
            // Ignore
          }
        }
        if (localAudioRef.current.src) {
          try {
            URL.revokeObjectURL(localAudioRef.current.src);
          } catch (e) {
            // Ignore
          }
        }

        // Set same audio source to both elements
        audioRef.current.src = url;
        localAudioRef.current.src = url;

        // Ensure volume is set
        audioRef.current.volume = 1.0;
        localAudioRef.current.volume = 1.0;

        // Reset active audio counter
        activeAudiosRef.current = 2; // Both VB Cable and local

        // Play both simultaneously
        const vbPlayPromise = audioRef.current.play();
        const localPlayPromise = localAudioRef.current.play();

        // Wait for both to start
        await Promise.all([
          vbPlayPromise || Promise.resolve(),
          localPlayPromise || Promise.resolve()
        ]);

        isProcessingRef.current = false; // Allow next playback request
      } catch (playError) {
        console.error('[AudioPlayer] Playback start error:', playError);
        setError('Playback failed: ' + playError.message);
        setIsPlaying(false);
        isProcessingRef.current = false;
        activeAudiosRef.current = 0;
        onPlayEnd?.();
      }
    } catch (error) {
      console.error('[AudioPlayer] Unexpected error in playAudio:', error);
      console.error('[AudioPlayer] Error stack:', error.stack);
      setError('Unexpected playback error');
      setIsPlaying(false);
      isProcessingRef.current = false;
      activeAudiosRef.current = 0;
      if (onPlayEnd) {
        try {
          onPlayEnd();
        } catch (callbackError) {
          console.error('[AudioPlayer] onPlayEnd callback error in catch:', callbackError);
        }
      }
    } finally {
      // Ensure processing flag is always reset
      if (isProcessingRef.current) {
        isProcessingRef.current = false;
      }
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      {error && (
        <div className="bg-red-900 bg-opacity-20 border border-red-600 rounded px-3 py-1">
          <p className="text-sm text-red-300">⚠️ {error}</p>
        </div>
      )}
      <div className="flex items-center gap-2">
        {isPlaying && (
          <div className="flex items-center gap-1">
            <div className="w-1 h-8 bg-zundamon-500 wave-bar" style={{ animationDelay: '0s' }}></div>
            <div className="w-1 h-8 bg-zundamon-500 wave-bar" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-1 h-8 bg-zundamon-500 wave-bar" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-1 h-8 bg-zundamon-500 wave-bar" style={{ animationDelay: '0.3s' }}></div>
          </div>
        )}
      </div>
    </div>
  );
}
