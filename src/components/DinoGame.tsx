import React, { useEffect, useRef, useState } from 'react';
import { Play, RotateCcw } from 'lucide-react';
import { Language, getInitialLanguage, t } from '../i18n.ts';

interface DinoGameProps {
  currentLanguage?: Language;
}

export default function DinoGame({ currentLanguage }: DinoGameProps) {
  const lang = currentLanguage || getInitialLanguage();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    try {
      return parseInt(localStorage.getItem('dino_highscore') || '0', 10);
    } catch (e) {
      return 0;
    }
  });

  const gameStateRef = useRef({
    dinoY: 0,
    dinoVelocityY: 0,
    isJumping: false,
    obstacles: [] as Array<{ x: number; width: number; height: number; type: number }>,
    groundX: 0,
    score: 0,
    gameSpeed: 5,
    frameCount: 0,
    animId: 0,
    active: false,
  });

  const jump = () => {
    const state = gameStateRef.current;
    if (!state.active) {
      startGame();
      return;
    }
    if (!state.isJumping) {
      state.dinoVelocityY = -12;
      state.isJumping = true;
    }
  };

  const startGame = () => {
    const state = gameStateRef.current;
    state.dinoY = 0;
    state.dinoVelocityY = 0;
    state.isJumping = false;
    state.obstacles = [];
    state.groundX = 0;
    state.score = 0;
    state.gameSpeed = 5;
    state.frameCount = 0;
    state.active = true;

    setScore(0);
    setGameOver(false);
    setIsPlaying(true);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const state = gameStateRef.current;

      // Clear Canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const groundY = 150;
      const dinoX = 40;
      const dinoWidth = 24;
      const dinoHeight = 30;

      // Draw Ground
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      ctx.lineTo(canvas.width, groundY);
      ctx.stroke();

      // Ground texture dots
      if (state.active) {
        state.groundX = (state.groundX + state.gameSpeed) % 40;
      }
      ctx.fillStyle = '#475569';
      for (let i = -state.groundX; i < canvas.width; i += 30) {
        ctx.fillRect(i, groundY + 8, 4, 2);
        ctx.fillRect(i + 15, groundY + 16, 2, 2);
      }

      if (state.active) {
        state.frameCount++;
        state.score = Math.floor(state.frameCount / 5);
        setScore(state.score);

        // Physics
        state.dinoY += state.dinoVelocityY;
        state.dinoVelocityY += 0.65; // Gravity

        if (state.dinoY >= 0) {
          state.dinoY = 0;
          state.dinoVelocityY = 0;
          state.isJumping = false;
        }

        // Increase speed gradually
        if (state.frameCount % 300 === 0 && state.gameSpeed < 12) {
          state.gameSpeed += 0.5;
        }

        // Spawn Obstacles
        if (state.obstacles.length === 0 || canvas.width - state.obstacles[state.obstacles.length - 1].x > 180 + Math.random() * 120) {
          const type = Math.random() > 0.4 ? 1 : 2; // Single or Double Cactus
          state.obstacles.push({
            x: canvas.width,
            width: type === 1 ? 14 : 26,
            height: 28 + Math.random() * 8,
            type,
          });
        }

        // Move and draw obstacles
        for (let i = state.obstacles.length - 1; i >= 0; i--) {
          const obs = state.obstacles[i];
          obs.x -= state.gameSpeed;

          // Draw Cactus
          ctx.fillStyle = '#65A30D'; // Green accent
          const obsY = groundY - obs.height;

          if (obs.type === 1) {
            // Main trunk
            ctx.fillRect(obs.x + 4, obsY, 6, obs.height);
            // Left arm
            ctx.fillRect(obs.x, obsY + 8, 4, 10);
            ctx.fillRect(obs.x, obsY + 8, 6, 3);
            // Right arm
            ctx.fillRect(obs.x + 10, obsY + 12, 4, 8);
            ctx.fillRect(obs.x + 8, obsY + 12, 6, 3);
          } else {
            // Double cactus
            ctx.fillRect(obs.x + 2, obsY, 6, obs.height);
            ctx.fillRect(obs.x + 16, obsY + 6, 6, obs.height - 6);
            ctx.fillRect(obs.x, obsY + 10, 24, 3);
          }

          // Collision Detection
          const actualDinoY = groundY - dinoHeight + state.dinoY;
          if (
            dinoX < obs.x + obs.width - 2 &&
            dinoX + dinoWidth > obs.x + 2 &&
            actualDinoY + dinoHeight > obsY + 4
          ) {
            // Game Over
            state.active = false;
            setIsPlaying(false);
            setGameOver(true);
            setHighScore((prev) => {
              const newHigh = Math.max(prev, state.score);
              try {
                localStorage.setItem('dino_highscore', String(newHigh));
              } catch (e) {}
              return newHigh;
            });
          }

          // Remove offscreen
          if (obs.x + obs.width < 0) {
            state.obstacles.splice(i, 1);
          }
        }
      }

      // Draw Dino
      const currentDinoY = groundY - dinoHeight + state.dinoY;
      ctx.fillStyle = '#e2e8f0';

      // Head
      ctx.fillRect(dinoX + 10, currentDinoY, 12, 10);
      // Eye
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(dinoX + 18, currentDinoY + 2, 2, 2);

      // Body
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(dinoX + 4, currentDinoY + 10, 14, 12);
      // Tail
      ctx.fillRect(dinoX, currentDinoY + 12, 4, 4);

      // Arms
      ctx.fillRect(dinoX + 16, currentDinoY + 12, 4, 2);

      // Animated Legs
      if (!state.isJumping && state.active && Math.floor(state.frameCount / 6) % 2 === 0) {
        ctx.fillRect(dinoX + 6, currentDinoY + 22, 3, 8);
        ctx.fillRect(dinoX + 13, currentDinoY + 22, 3, 4);
      } else if (!state.isJumping && state.active) {
        ctx.fillRect(dinoX + 6, currentDinoY + 22, 3, 4);
        ctx.fillRect(dinoX + 13, currentDinoY + 22, 3, 8);
      } else {
        // Jumping legs
        ctx.fillRect(dinoX + 6, currentDinoY + 22, 3, 6);
        ctx.fillRect(dinoX + 13, currentDinoY + 22, 3, 6);
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        jump();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex flex-col items-center w-full max-w-md bg-slate-800/90 border border-slate-700/80 rounded-2xl p-4 shadow-xl text-white my-4">
      <div className="flex items-center justify-between w-full mb-3 px-2 font-mono text-xs">
        <span className="text-slate-400 font-bold uppercase tracking-wider">🦖 {t("dinoRunnerTitle", lang)}</span>
        <div className="flex items-center gap-4 font-bold">
          <span className="text-slate-400">HI <span className="text-emerald-400">{String(highScore).padStart(5, '0')}</span></span>
          <span className="text-white">SCORE <span className="text-amber-400">{String(score).padStart(5, '0')}</span></span>
        </div>
      </div>

      <div
        className="relative w-full bg-slate-900 rounded-xl overflow-hidden border border-slate-700/60 cursor-pointer touch-none"
        onClick={jump}
      >
        <canvas
          ref={canvasRef}
          width={500}
          height={170}
          className="w-full h-auto block"
        />

        {!isPlaying && !gameOver && (
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px] flex flex-col items-center justify-center p-4">
            <button
              onClick={startGame}
              className="px-5 py-2.5 bg-[#65A30D] hover:bg-[#52840a] text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg flex items-center gap-2 transition-transform active:scale-95"
            >
              <Play size={16} fill="currentColor" />
              <span>{t("tapToPlayDino", lang)}</span>
            </button>
            <span className="text-[10px] text-slate-400 font-medium mt-2">{t("dinoGameSubtitle", lang)}</span>
          </div>
        )}

        {gameOver && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-[2px] flex flex-col items-center justify-center p-4">
            <span className="text-rose-400 font-black text-sm uppercase tracking-widest mb-1">{t("gameOver", lang)}</span>
            <span className="text-xs font-mono text-slate-300 mb-3">Score: {score}</span>
            <button
              onClick={startGame}
              className="px-5 py-2 bg-[#65A30D] hover:bg-[#52840a] text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg flex items-center gap-2 transition-transform active:scale-95"
            >
              <RotateCcw size={15} />
              <span>{t("playAgain", lang)}</span>
            </button>
          </div>
        )}
      </div>

      <div className="w-full text-center mt-2">
        <span className="text-[10px] text-slate-400 font-medium">{t("dinoControls", lang)}</span>
      </div>
    </div>
  );
}
