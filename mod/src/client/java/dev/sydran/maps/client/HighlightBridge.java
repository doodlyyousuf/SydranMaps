package dev.sydran.maps.client;

import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.minecraft.client.Minecraft;
import net.minecraft.network.chat.Component;
import net.minecraft.ChatFormatting;
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
                        if (count > 0) client.player.sendSystemMessage(Component.literal("\u2713 " + count + " maps highlighted for " + orderCode).withStyle(ChatFormatting.GREEN));
                        else client.player.sendSystemMessage(Component.literal("\u26A0 No maps found. Run /sydran rescan " + orderCode).withStyle(ChatFormatting.YELLOW));
                    }
                } catch (Exception e) {
                    if (client.player != null) client.player.sendSystemMessage(Component.literal("\u2717 Highlight failed: " + e.getMessage()).withStyle(ChatFormatting.RED));
                }
            }
        });
    }
}
