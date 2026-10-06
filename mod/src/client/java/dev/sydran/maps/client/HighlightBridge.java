package dev.sydran.maps.client;

import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.minecraft.client.MinecraftClient;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
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
                        if (count > 0) client.player.sendMessage(Text.literal("\u2713 " + count + " maps highlighted for " + orderCode).formatted(Formatting.GREEN), false);
                        else client.player.sendMessage(Text.literal("\u26A0 No maps found. Run /sydran rescan " + orderCode).formatted(Formatting.YELLOW), false);
                    }
                } catch (Exception e) {
                    if (client.player != null) client.player.sendMessage(Text.literal("\u2717 Highlight failed: " + e.getMessage()).formatted(Formatting.RED), false);
                }
            }
        });
    }
}
