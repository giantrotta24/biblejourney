import type { Metadata } from "next";
import { AccountPanel } from "@/components/account-panel";

export const metadata: Metadata = { title: "Account" };

export default function AccountPage() {
  return (
    <>
      <h1 className="m-0 text-[1.75rem] leading-tight">Account</h1>
      <AccountPanel />
    </>
  );
}
