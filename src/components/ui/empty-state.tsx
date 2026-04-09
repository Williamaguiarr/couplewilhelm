import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { FileX, Inbox, Search } from "lucide-react";

type EmptyIcon = "inbox" | "search" | "file";

interface EmptyStateProps {
  icon?: EmptyIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

const iconMap = {
  inbox: Inbox,
  search: Search,
  file: FileX,
};

const EmptyState: React.FC<EmptyStateProps> = ({
  icon = "inbox",
  title,
  description,
  action,
  className,
}) => {
  const Icon = iconMap[icon];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      className={cn(
        "flex flex-col items-center justify-center py-12 px-6 text-center",
        className
      )}
    >
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.1 }}
        className="mb-4 rounded-full bg-muted p-4"
      >
        <Icon className="h-8 w-8 text-muted-foreground/60" />
      </motion.div>
      <h3 className="text-base font-semibold text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-xs">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </motion.div>
  );
};

export default EmptyState;
