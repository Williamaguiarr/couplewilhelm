import { motion } from "framer-motion";
import React from "react";

interface MotionCardProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

const MotionCard: React.FC<MotionCardProps> = ({ children, className, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20, scale: 0.97 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{
      type: "spring",
      stiffness: 300,
      damping: 26,
      delay,
    }}
    whileHover={{ y: -2, transition: { duration: 0.2 } }}
    className={className}
  >
    {children}
  </motion.div>
);

export default MotionCard;
