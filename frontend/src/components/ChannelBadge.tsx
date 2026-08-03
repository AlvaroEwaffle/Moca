import { Instagram, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Channel, CHANNEL_LABEL, CHANNEL_BADGE_CLASS, resolveChannel } from "@/utils/channel";

interface ChannelBadgeProps {
  channel?: string | null;
  /** Icon-only, for dense rows where the label would not fit. */
  compact?: boolean;
  className?: string;
}

/**
 * Which network a conversation belongs to.
 *
 * Once two channels share one inbox, the operator has to know where a reply is
 * going before they type it — the rules differ (WhatsApp has a hard 24h window)
 * and so does the tone.
 */
const ChannelBadge = ({ channel, compact = false, className = "" }: ChannelBadgeProps) => {
  const resolved: Channel = resolveChannel(channel);
  const Icon = resolved === 'whatsapp' ? MessageCircle : Instagram;

  return (
    <Badge
      variant="outline"
      className={`${CHANNEL_BADGE_CLASS[resolved]} ${compact ? 'px-1.5' : ''} ${className}`}
      title={CHANNEL_LABEL[resolved]}
    >
      <Icon className="h-3 w-3" />
      {!compact && <span className="ml-1">{CHANNEL_LABEL[resolved]}</span>}
    </Badge>
  );
};

export default ChannelBadge;
