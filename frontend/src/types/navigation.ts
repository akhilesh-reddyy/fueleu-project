import type { ReactNode } from "react";

export interface NavItem {
  id:          string;
  label:       string;
  shortLabel:  string;
  description: string;
  icon:        ReactNode;
}
