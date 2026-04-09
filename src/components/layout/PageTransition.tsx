import React from "react";
import MotionPage from "@/components/motion/MotionPage";

interface PageTransitionProps {
  children: React.ReactNode;
}

const PageTransition: React.FC<PageTransitionProps> = ({ children }) => {
  return <MotionPage>{children}</MotionPage>;
};

export default PageTransition;
