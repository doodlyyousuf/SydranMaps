package dev.sydran.maps.client;

import net.minecraft.client.MinecraftClient;
import net.minecraft.component.DataComponentTypes;
import net.minecraft.component.type.MapIdComponent;
import net.minecraft.entity.player.PlayerInventory;
import net.minecraft.item.FilledMapItem;
import net.minecraft.item.ItemStack;
import net.minecraft.item.map.MapState;
import java.util.ArrayList;
import java.util.List;

public class MapDataReader {
    public static List<byte[]> collectMaps(int needed) {
        MinecraftClient client = MinecraftClient.getInstance();
        if (client.player == null) throw new IllegalStateException("No player context.");
        PlayerInventory inv = client.player.getInventory();
        List<byte[]> maps = new ArrayList<>();
        for (int slot = 0; slot < inv.size() && maps.size() < needed; slot++) {
            ItemStack stack = inv.getStack(slot);
            if (stack.isEmpty() || !(stack.getItem() instanceof FilledMapItem)) continue;
            int count = stack.getCount();
            for (int i = 0; i < count && maps.size() < needed; i++) {
                byte[] colors = readMapColors(stack, client);
                if (colors != null) maps.add(colors);
            }
        }
        if (maps.size() < needed) throw new IllegalStateException("Missing " + (needed - maps.size()) + " tiles. Expected " + needed + ", found " + maps.size() + ".");
        return maps;
    }

    private static byte[] readMapColors(ItemStack mapStack, MinecraftClient client) {
        try {
            MapIdComponent mapId = mapStack.get(DataComponentTypes.MAP_ID);
            if (mapId == null) return null;
            MapState mapState = FilledMapItem.getMapState(mapId, client.world);
            if (mapState == null || mapState.colors == null) return null;
            if (mapState.colors.length != 128 * 128) return null;
            byte[] copy = new byte[mapState.colors.length];
            System.arraycopy(mapState.colors, 0, copy, 0, mapState.colors.length);
            return copy;
        } catch (Exception e) { return null; }
    }
}
