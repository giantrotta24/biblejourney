import type { Metadata } from "next";
import { ACCOUNT_HEADING_ID, AccountPanel } from "@/components/account-panel";

export const metadata: Metadata = { title: "Account" };

export default function AccountPage() {
  return (
    <>
      <h1 id={ACCOUNT_HEADING_ID} tabIndex={-1} className="m-0 text-[1.75rem] leading-tight">
        Account
      </h1>
      <AccountPanel />
    </>
  );
}
