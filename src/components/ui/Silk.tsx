import React from 'react';

interface SilkProps {
  speed?: number;
  scale?: number;
  color?: string;
  noiseIntensity?: number;
  rotation?: number;
}

const Silk: React.FC<SilkProps> = ({
  speed = 5,
  scale = 1,
  color = "#4338ca",
  noiseIntensity = 1.5,
  rotation = 0,
}) => {
  const animationDuration = 20 / speed;
  const animationDurationReverse = animationDuration * 1.5;
  const animationDurationTexture = animationDuration * 2;
  
  return (
    <div 
      className="absolute inset-0 overflow-hidden"
      style={{
        background: `linear-gradient(45deg, ${color}22, ${color}44, ${color}66)`,
      }}
    >
      {/* Primary Wave */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background: `
            radial-gradient(circle at 20% 80%, ${color} 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, ${color} 0%, transparent 50%),
            radial-gradient(circle at 40% 40%, ${color}88 0%, transparent 50%)
          `,
          animation: `silk-wave ${animationDuration}s ease-in-out infinite`,
          transform: `scale(${scale}) rotate(${rotation}rad)`,
        }}
      />

      {/* Secondary Wave */}  
      <div
        className="absolute inset-0 opacity-20"
        style={{
          background: `
            conic-gradient(from 0deg at 50% 50%, ${color}44, transparent, ${color}44),
            radial-gradient(ellipse at center, transparent 40%, ${color}22 70%)
          `,
          animation: `silk-wave-reverse ${animationDurationReverse}s ease-in-out infinite`,
          transform: `scale(${scale * 1.1}) rotate(${-rotation}rad)`,
        }}
      />

      {/* Tertiary Layer for Texture */}
      <div
        className="absolute inset-0 opacity-15"
        style={{
          background: `
            repeating-linear-gradient(
              45deg,
              ${color}11 0px,
              transparent 2px,
              transparent 20px,
              ${color}22 22px
            ),
            repeating-linear-gradient(
              -45deg,
              ${color}11 0px,
              transparent 2px,
              transparent 30px,
              ${color}33 32px
            )
          `,
          animation: `silk-texture ${animationDurationTexture}s linear infinite`,
          filter: `blur(${noiseIntensity}px)`,
        }}
      />

      {/* Floating Particles */}
      <div className="absolute inset-0">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full opacity-20"
            style={{
              width: `${Math.random() * 4 + 2}px`,
              height: `${Math.random() * 4 + 2}px`,
              backgroundColor: color,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `silk-float-${i % 3} ${5 + Math.random() * 10}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 5}s`,
            }}
          />
        ))}
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes silk-wave {
          0%, 100% {
            transform: scale(${scale}) rotate(${rotation}rad) translate(0%, 0%);
          }
          25% {
            transform: scale(${scale * 1.05}) rotate(${rotation + 0.1}rad) translate(-2%, 1%);
          }
          50% {
            transform: scale(${scale}) rotate(${rotation}rad) translate(1%, -1%);
          }
          75% {
            transform: scale(${scale * 0.95}) rotate(${rotation - 0.1}rad) translate(-1%, 2%);
          }
        }

        @keyframes silk-wave-reverse {
          0%, 100% {
            transform: scale(${scale * 1.1}) rotate(${-rotation}rad) translate(0%, 0%);
          }
          33% {
            transform: scale(${scale * 1.15}) rotate(${-rotation - 0.15}rad) translate(2%, -1%);
          }
          67% {
            transform: scale(${scale * 1.05}) rotate(${-rotation + 0.1}rad) translate(-1%, 1%);
          }
        }

        @keyframes silk-texture {
          0% {
            transform: translate(0px, 0px);
          }
          100% {
            transform: translate(-50px, -50px);
          }
        }

        @keyframes silk-float-0 {
          0%, 100% {
            transform: translateY(0px) translateX(0px);
            opacity: 0.1;
          }
          50% {
            transform: translateY(-20px) translateX(10px);
            opacity: 0.3;
          }
        }

        @keyframes silk-float-1 {
          0%, 100% {
            transform: translateY(0px) translateX(0px) rotate(0deg);
            opacity: 0.2;
          }
          33% {
            transform: translateY(-15px) translateX(-5px) rotate(120deg);
            opacity: 0.4;
          }
          67% {
            transform: translateY(10px) translateX(15px) rotate(240deg);
            opacity: 0.1;
          }
        }

        @keyframes silk-float-2 {
          0%, 100% {
            transform: scale(1) translateY(0px);
            opacity: 0.15;
          }
          50% {
            transform: scale(1.2) translateY(-25px);
            opacity: 0.25;
          }
        }
      `}</style>
    </div>
  );
};

export default Silk; 