package dev.sydran.maps.client;

import net.minecraft.client.Minecraft;
import net.minecraft.core.component.DataComponents;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.MapItem;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.saveddata.maps.MapId;
import net.minecraft.world.level.saveddata.maps.MapItemSavedData;

import java.util.ArrayList;
import java.util.List;

public class MapDataReader {

    public static List<byte[]> collectMaps(int needed) {
        Minecraft client = Minecraft.getInstance();
        if (client.player == null) throw new IllegalStateException("No player context.");
        Inventory inv = client.player.getInventory();
        List<byte[]> maps = new ArrayList<>();
        for (int slot = 0; slot < inv.getContainerSize() && maps.size() < needed; slot++) {
            ItemStack stack = inv.getItem(slot);
            if (stack.isEmpty() || !(stack.getItem() instanceof MapItem)) continue;
            int count = stack.getCount();
            for (int i = 0; i < count && maps.size() < needed; i++) {
                byte[] colors = readMapColors(stack, client);
                if (colors != null) maps.add(colors);
            }
        }
        if (maps.size() < needed) throw new IllegalStateException("Missing " + (needed - maps.size()) + " tiles. Expected " + needed + ", found " + maps.size() + ".");
        return maps;
    }

    /**
     * Read the map currently in the player's main hand.
     * Used by /sydran multimap tile:X-Y to add one map at a time.
     *
     * @return the 128x128 colour array, or null if no filled map is held.
     */
    public static byte[] readMainHandMap() {
        Minecraft client = Minecraft.getInstance();
        if (client.player == null) return null;
        ItemStack stack = client.player.getMainHandItem();
        if (stack.isEmpty() || !(stack.getItem() instanceof MapItem)) return null;
        return readMapColors(stack, client);
    }

    private static byte[] readMapColors(ItemStack mapStack, Minecraft client) {
        try {
            MapId mapId = mapStack.get(DataComponents.MAP_ID);
            if (mapId == null) return null;
            Level level = client.level;
            if (level == null) return null;
            MapItemSavedData mapData = MapItem.getSavedData(mapId, level);
            if (mapData == null || mapData.colors == null || mapData.colors.length != 128 * 128) return null;
            byte[] copy = new byte[mapData.colors.length];
            System.arraycopy(mapData.colors, 0, copy, 0, mapData.colors.length);
            return copy;
        } catch (Exception e) {
            return null;
        }
    }
}
