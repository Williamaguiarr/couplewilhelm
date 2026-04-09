import { motion } from "framer-motion";
import React from "react";

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

const pageTransition = {
  type: "spring" as const,
  stiffness: 260,
  damping: 30,
  mass: 0.8,
};

const PageTransition: React.FC<PageTransitionProps> = ({ children, className }) => (
  <motion.div
    variants={pageVariants}
    initial="initial"
    animate="animate"
    exit="exit"
    transition={pageTransition}
    className={className}
  >
    {children}
  </motion.div>
);

export default PageTransition;
