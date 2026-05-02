import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  Building2,
  CalendarDays,
  TrendingUp,
  DollarSign,
  Percent,
  UserCheck,
  Plus,
  Trash2,
  Receipt,
  AlertTriangle,
  ArrowRight,
  Filter,
  ChevronLeft,
  ChevronRight,
  FileDown,
  Clock,
  Sparkles,
} from "lucide-react";
import PageTransition from "@/components/layout/PageTransition";
import OccupancyComparison from "@/components/dashboard/OccupancyComparison";
import FinancialYearComparison from "@/components/dashboard/FinancialYearComparison";
import GanhosExtrasDialog from "@/components/reservas/GanhosExtrasDialog";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import autoTable from "jspdf-autotable";
import { useTheme } from "@/contexts/ThemeContext";
import { useToast } from "@/hooks/use-toast";
import {
  createPdfDoc, drawHeader, drawSummaryCards, drawSectionTitle,
  drawFooterAllPages, premiumTableStyles, fmtBRL, genTimestamp,
} from "@/lib/pdf/builder";
