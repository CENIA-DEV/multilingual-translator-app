import { useRef } from 'react';

export const useWaveform = (getAudioContext) => {
  const waveCanvasRef = useRef(null);
  const waveRAFRef = useRef(null);
  const waveAnalyserRef = useRef(null);
  const waveSourceRef = useRef(null);
  const pulseRef = useRef(null);

  const stopWaveformVisualization = () => {
    try { if (waveRAFRef.current) cancelAnimationFrame(waveRAFRef.current); } catch {}
    waveRAFRef.current = null;
    try { if (waveSourceRef.current) waveSourceRef.current.disconnect(); } catch {}
    try { if (waveAnalyserRef.current && waveAnalyserRef.current.disconnect) waveAnalyserRef.current.disconnect(); } catch {}
    waveSourceRef.current = null;
    waveAnalyserRef.current = null;
  };

  const startWaveformVisualization = async (stream) => {
    try {
      const ctx = await getAudioContext();
      if (ctx.state === 'suspended') await ctx.resume();
  
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.85;
  
      const timeData = new Uint8Array(analyser.fftSize);
      const freqData = new Uint8Array(analyser.frequencyBinCount);
  
      waveSourceRef.current = source;
      waveAnalyserRef.current = analyser;
      source.connect(analyser);
  
      const canvas = waveCanvasRef.current;
      if (!canvas) return;
      const g = canvas.getContext('2d');
  
      function resize() {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width  = Math.max(1, Math.floor(rect.width * dpr));
        canvas.height = Math.max(1, Math.floor(rect.height * dpr));
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.scale(dpr, dpr);
      }
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(canvas);
  
      const draw = () => {
        waveRAFRef.current = requestAnimationFrame(draw);
        analyser.getByteTimeDomainData(timeData);
        analyser.getByteFrequencyData(freqData);
  
        const { width, height } = canvas.getBoundingClientRect();
        g.clearRect(0, 0, width, height);
        g.fillStyle = '#fff';
        g.fillRect(0, 0, width, height);
  
        // midline
        g.strokeStyle = '#e5e7eb';
        g.lineWidth = 1;
        const mid = height / 2;
        g.beginPath();
        g.moveTo(0, mid);
        g.lineTo(width, mid);
        g.stroke();
  
        // waveform
        g.strokeStyle = '#0a8cde';
        g.lineWidth = 2;
        g.beginPath();
        for (let i = 0; i < timeData.length; i++) {
          const x = (i / (timeData.length - 1)) * width;
          const y = mid + ((timeData[i] - 128) / 128) * (height * 0.42);
          if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.stroke();
  
        // VU bars (bottom)
        const bars = 16;
        const step = Math.floor(freqData.length / bars);
        const barW = Math.max(6, width / (bars * 1.5));
        for (let b = 0; b < bars; b++) {
          const slice = freqData.subarray(b * step, (b + 1) * step);
          let avg = 0;
          for (let j = 0; j < slice.length; j++) avg += slice[j];
          avg /= slice.length || 1;
          const barH = (avg / 255) * (height * 0.35);
          const x = 10 + b * (barW + 6);
          const y = height - 10 - barH;
          g.fillStyle = '#0a8cde';
          g.fillRect(x, y, barW, barH);
        }
  
        // RMS pulse
        let sum = 0;
        for (let i = 0; i < timeData.length; i++) {
          const v = (timeData[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / timeData.length);
        if (pulseRef.current) {
          const s = 1 + Math.min(1.4, rms * 2.2);
          pulseRef.current.style.transform = `scale(${s})`;
          pulseRef.current.style.boxShadow = `0 0 ${8 + rms * 36}px rgba(10,140,222,0.65)`;
          pulseRef.current.style.opacity = `${0.6 + Math.min(0.4, rms * 0.8)}`;
        }
      };
      draw();
    } catch (e) {
      console.debug('Visualizer error', e);
    }
  };

  return { waveCanvasRef, pulseRef, startWaveformVisualization, stopWaveformVisualization, waveAnalyserRef };
};