import { motion } from "framer-motion";
import React from "react";

interface MotionStaggerProps {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
}

const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.07,
    },
  },
};

export const staggerItemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 24,
    },
  },
};

const MotionStagger: React.FC<MotionStaggerProps> = ({
  children,
  className,
  staggerDelay = 0.07,
}) => (
  <motion.div
    variants={{
      ...containerVariants,
      show: { transition: { staggerChildren: staggerDelay } },
    }}
    initial="hidden"
    animate="show"
    className={className}
  >
    {children}
  </motion.div>
);

export const MotionItem: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <motion.div variants={staggerItemVariants} className={className}>
    {children}
  </motion.div>
);

export default MotionStagger;
