import type { Metadata } from "next";
import { DispatchBoard } from "@/components/DispatchBoard";

export const metadata: Metadata = {
  title: "Dispatch board | Intake Desk (fictional data)",
};

export default function DispatchPage() {
  return <DispatchBoard />;
}
