import type { Metadata } from "next";
import { SettingsView } from "@/components/settings-view";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <h1 className="m-0 text-[1.75rem] leading-tight">Settings</h1>
      <SettingsView />
    </>
  );
}
