import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Check, AlertCircle, Loader2 } from "lucide-react";

type FeedbackStatus = "idle" | "loading" | "success" | "error";

interface StatusFeedbackProps {
  status: FeedbackStatus;
  message?: string;
  className?: string;
}

const StatusFeedback: React.FC<StatusFeedbackProps> = ({
  status,
  message,
  className,
}) => {
  if (status === "idle") return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={status}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "flex items-center gap-2 text-sm",
          status === "loading" && "text-muted-foreground",
          status === "success" && "text-primary",
          status === "error" && "text-destructive",
          className
        )}
      >
        {status === "loading" && (
          <Loader2 className="h-4 w-4 animate-spin" />
        )}
        {status === "success" && (
          <motion.div
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 15 }}
          >
            <Check className="h-4 w-4" />
          </motion.div>
        )}
        {status === "error" && (
          <AlertCircle className="h-4 w-4" />
        )}
        {message && <span>{message}</span>}
      </motion.div>
    </AnimatePresence>
  );
};

export default StatusFeedback;
