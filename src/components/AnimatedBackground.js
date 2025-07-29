import React, { useRef, useEffect } from "react";

function getRandom(min, max) {
  return Math.random() * (max - min) + min;
}

function drawPolygon(ctx, x, y, radius, sides, rotation, color, alpha) {
  if (sides < 3) return;
  const step = (Math.PI * 2) / sides;
  ctx.save();
  ctx.beginPath();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.moveTo(radius, 0);
  for (let i = 1; i < sides; i++) {
    ctx.lineTo(radius * Math.cos(step * i), radius * Math.sin(step * i));
  }
  ctx.closePath();
  ctx.fillStyle = `rgba(${color.r},${color.g},${color.b},${alpha})`;
  ctx.shadowColor = `rgba(${color.r},${color.g},${color.b},${alpha})`;
  ctx.shadowBlur = 15;
  ctx.fill();
  ctx.restore();
}

function drawStar(
  ctx,
  x,
  y,
  outerRadius,
  innerRadius,
  points,
  rotation,
  color,
  alpha
) {
  const step = Math.PI / points;
  ctx.save();
  ctx.beginPath();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.moveTo(outerRadius, 0);
  for (let i = 1; i < 2 * points; i++) {
    const r = i % 2 === 0 ? outerRadius : innerRadius;
    ctx.lineTo(r * Math.cos(step * i), r * Math.sin(step * i));
  }
  ctx.closePath();
  ctx.fillStyle = `rgba(${color.r},${color.g},${color.b},${alpha})`;
  ctx.shadowColor = `rgba(${color.r},${color.g},${color.b},${alpha})`;
  ctx.shadowBlur = 15;
  ctx.fill();
  ctx.restore();
}

const COLORS = [
  { r: 255, g: 165, b: 0 }, // Оранжевый #ffa500
  { r: 255, g: 200, b: 50 },
  { r: 255, g: 140, b: 0 },
];

function AnimatedBackground() {
  const canvasRef = useRef(null);
  const animationFrameId = useRef(null);
  const particles = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    const PARTICLE_COUNT = 40;

    function createParticle() {
      const shapeType = Math.random() < 0.5 ? "polygon" : "star";
      return {
        x: getRandom(0, width),
        y: getRandom(0, height),
        size: getRandom(20, 60),
        shape: shapeType,
        sides: Math.floor(getRandom(5, 8)), // для многоугольника
        points: Math.floor(getRandom(4, 7)), // для звезды
        rotation: getRandom(0, Math.PI * 2),
        rotationSpeed: getRandom(-0.02, 0.02),
        speedX: getRandom(-0.4, 0.4),
        speedY: getRandom(-0.3, 0.3),
        color: COLORS[Math.floor(getRandom(0, COLORS.length))],
        alpha: getRandom(0.1, 0.3),
        alphaDirection: Math.random() < 0.5 ? 1 : -1,
      };
    }

    particles.current = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.current.push(createParticle());
    }

    function updateParticle(p) {
      p.x += p.speedX;
      p.y += p.speedY;
      p.rotation += p.rotationSpeed;

      // Плавное изменение прозрачности (мерцание)
      p.alpha += 0.005 * p.alphaDirection;
      if (p.alpha >= 0.35) p.alphaDirection = -1;
      else if (p.alpha <= 0.1) p.alphaDirection = 1;

      // Обход границ
      if (p.x < -100) p.x = width + 100;
      else if (p.x > width + 100) p.x = -100;
      if (p.y < -100) p.y = height + 100;
      else if (p.y > height + 100) p.y = -100;
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);

      // Заливка фона тёмным цветом с лёгкой прозрачностью, чтобы создавать эффект слоев при анимации
      ctx.fillStyle = "rgba(30,30,30,0.4)";
      ctx.fillRect(0, 0, width, height);

      particles.current.forEach((p) => {
        updateParticle(p);
        if (p.shape === "polygon") {
          drawPolygon(
            ctx,
            p.x,
            p.y,
            p.size / 2,
            p.sides,
            p.rotation,
            p.color,
            p.alpha
          );
        } else {
          drawStar(
            ctx,
            p.x,
            p.y,
            p.size / 2,
            p.size / 4,
            p.points,
            p.rotation,
            p.color,
            p.alpha
          );
        }
      });

      animationFrameId.current = requestAnimationFrame(draw);
    }

    draw();

    function handleResize() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    }
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 0,
        pointerEvents: "none",
        width: "100%",
        height: "100%",
      }}
    />
  );
}

export default AnimatedBackground;
