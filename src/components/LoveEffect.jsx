import React, { useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Heart } from "lucide-react";

const HEART_COLORS = ["#ff4d6d", "#ff758f", "#e11d48", "#fb7185"];

const LoveEffect = () => {
  const shouldReduceMotion = useReducedMotion();
  const [particles] = useState(() =>
    Array.from({ length: 14 }, (_, index) => ({
      id: index,
      x: Math.round((Math.random() - 0.5) * 150),
      rotation: Math.round((Math.random() - 0.5) * 90),
      size: Math.round(10 + Math.random() * 12),
      scale: 0.7 + Math.random() * 0.7,
      rise: 85 + Math.random() * 75,
      delay: Math.random() * 0.16,
      color: HEART_COLORS[Math.floor(Math.random() * HEART_COLORS.length)],
    }))
  );
  const completedRef = useRef(0);
  const [visible, setVisible] = useState(true);

  if (shouldReduceMotion || !visible) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-visible" aria-hidden="true">
      {particles.map((particle) => (
        <motion.span
          key={particle.id}
          className="absolute"
          style={{ left: "50%", bottom: "32%", color: particle.color }}
          initial={{ x: 0, y: 0, opacity: 0, scale: 0.25, rotate: 0 }}
          animate={{
            x: particle.x,
            y: -particle.rise,
            opacity: [0, 1, 0],
            scale: [0.25, particle.scale, particle.scale * 0.7],
            rotate: particle.rotation,
          }}
          transition={{ duration: 1.9, delay: particle.delay, ease: "easeOut" }}
          onAnimationComplete={() => {
            completedRef.current += 1;
            if (completedRef.current >= particles.length) setVisible(false);
          }}
        >
          <Heart size={particle.size} fill="currentColor" strokeWidth={1.5} />
        </motion.span>
      ))}
    </div>
  );
};

export default LoveEffect;