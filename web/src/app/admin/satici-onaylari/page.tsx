import type { Metadata } from "next";
import { SellerApprovalPanel } from "./seller-approval-panel";

export const metadata: Metadata = {
  title: "Satıcı Onayları — alıcam.net Yönetim",
  description: "Hizmet veren başvurularını inceleme ve onaylama ekranı.",
};

export default function SellerApprovalsPage() {
  return <SellerApprovalPanel />;
}
