package dev.sydran.maps.client;

import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import dev.sydran.maps.highlight.HighlightStore;

public class HighlightBridge {
    public static void register() {
        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            String code;
            while ((code = HighlightStore.pollPendingHighlight()) != null) {
                final String orderCode = code;
                try {
                    int count = MapHighlighter.highlightForOrder(orderCode);
                    if (client.player != null) {
                        if (count > 0) client.player.sendMessage(net.minecraft.text.Text.literal("✓ " + count + " maps highlighted for " + orderCode).formatted(net.minecraft.util.Formatting.GREEN), false);
                        else client.player.sendMessage(net.minecraft.text.Text.literal("⚠ No required maps found. Run /sydran rescan " + orderCode).formatted(net.minecraft.util.Formatting.YELLOW), false);
                    }
                } catch (Exception e) {
                    if (client.player != null) client.player.sendMessage(net.minecraft.text.Text.literal("✗ Highlight failed: " + e.getMessage()).formatted(net.minecraft.util.Formatting.RED), false);
                }
            }
        });
    }
}
