import type React from "react";
import { GiftIcon } from "@primer/octicons-react";
import { GamePassBrowser } from "./gamepass/gamepass-browser";
import { GiveawayPanel } from "./isthereanydeal/giveaway-panel";

export interface DealSourceProps {
  onConfigured: () => void;
}

export interface DealSourceConfig {
  id: string;
  labelKey: string;
  icon: React.ReactNode;
  component: React.ComponentType<DealSourceProps>;
  enabled: boolean;
  requiresConfig: boolean;
}

export const DEAL_SOURCES: DealSourceConfig[] = [
  {
    id: "xbox-gamepass",
    labelKey: "xbox_gamepass",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M6.43 9.67C6.24 9.58 5.99 9.57 5.72 9.7L3.33 10.9c-.55.27-.83.8-.83 1.21v.83c0 .13.04.26.12.32l4.28 3.36c.12.09.28.15.46.15.21 0 .42-.08.58-.24l1.62-1.6c.31-.31.37-.81.14-1.16l-3.27-4.1zM20.67 10.9l-2.39-1.2c-.27-.13-.52-.12-.7-.03l-3.27 4.1c-.23.35-.17.85.14 1.16l1.62 1.6c.16.16.36.24.58.24.18 0 .34-.06.46-.15l4.28-3.36c.08-.06.12-.19.12-.32v-.83c0-.41-.28-.94-.84-1.21zM10.77 12.51l-1.96-2.44 3.19-1.58 3.19 1.58-1.96 2.44-.01.01c-.31.39-.91.66-1.22.65-.31 0-.9-.28-1.22-.65l-.01-.01z" />
      </svg>
    ),
    component: GamePassBrowser,
    enabled: true,
    requiresConfig: false,
  },
  {
    id: "isthereanydeal",
    labelKey: "isthereanydeal",
    icon: <GiftIcon size={14} />,
    component: GiveawayPanel,
    enabled: true,
    requiresConfig: false,
  },
];
