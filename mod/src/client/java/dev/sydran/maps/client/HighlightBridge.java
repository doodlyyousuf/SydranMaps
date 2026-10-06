package dev.sydran.maps.client;

import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.minecraft.client.Minecraft;
import net.minecraft.network.chat.Component;
import net.minecraft.ChatFormatting;
import dev.sydran.maps.highlight.HighlightStore;

/**
 * Bridge between server-side command code and client-side map
 * highlighting. Polls HighlightStore for pending highlight requests
 * every client tick and runs MapHighlighter on the client thread.
 */
public class HighlightBridge {

    public static void register() {
        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            String code;
            while ((code = HighlightStore.pollPendingHighlight()) != null) {
                final String orderCode = code;
                try {
                    int count = MapHighlighter.highlightForOrder(orderCode);
                    if (client.player != null) {
                        if (count > 0) {
                            client.player.sendSystemMessage(
                                Component.literal("\u2713 " + count + " map" + (count == 1 ? "" : "s") +
                                    " highlighted for order " + orderCode)
                                    .withStyle(ChatFormatting.GREEN)
                            );
                            client.player.sendSystemMessage(
                                Component.literal("  Glowing maps are required for this order.")
                                    .withStyle(ChatFormatting.GRAY)
                            );
                        } else {
                            client.player.sendSystemMessage(
                                Component.literal("\u26A0 No required maps found nearby for order " + orderCode +
                                    ". Move near your maps and run /sydran rescan " + orderCode)
                                    .withStyle(ChatFormatting.YELLOW)
                            );
                        }
                    }
                } catch (Exception e) {
                    if (client.player != null) {
                        client.player.sendSystemMessage(
                            Component.literal("\u2717 Failed to highlight maps: " + e.getMessage())
                                .withStyle(ChatFormatting.RED)
                        );
                    }
                }
            }
        });
    }
}
