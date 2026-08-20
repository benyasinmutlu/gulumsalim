import type { Metadata } from "next";
import ChannelsPanel from "./channels-panel";

export const metadata: Metadata = { title: "Kanallar | Satıcı Paneli" };

export default function VendorChannelsPage() {
  return <ChannelsPanel />;
}
