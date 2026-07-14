import { useEffect, useRef } from "react";

export function AudioAlarm({ active }: { active: boolean }) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (active) {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const ctx = audioCtxRef.current;
      
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const gainNode = ctx.createGain();
      gainNode.connect(ctx.destination);
      gainNode.gain.value = 0;
      gainNodeRef.current = gainNode;

      const playBeep = () => {
        const osc = ctx.createOscillator();
        osc.type = "square";
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
        
        osc.connect(gainNode);
        osc.start();
        
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
        gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
        
        osc.stop(ctx.currentTime + 0.3);
      };

      playBeep();
      intervalRef.current = window.setInterval(playBeep, 800);

    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (gainNodeRef.current && audioCtxRef.current) {
        gainNodeRef.current.gain.linearRampToValueAtTime(0, audioCtxRef.current.currentTime + 0.1);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [active]);

  return null;
}
