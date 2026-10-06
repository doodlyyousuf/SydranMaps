package dev.sydran.maps.client;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import net.minecraft.client.MinecraftClient;
import net.minecraft.component.DataComponentTypes;
import net.minecraft.entity.player.PlayerInventory;
import net.minecraft.item.FilledMapItem;
import net.minecraft.item.ItemStack;
import net.minecraft.item.map.MapState;
import net.minecraft.component.type.MapIdComponent;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
import net.minecraft.util.math.BlockPos;
import java.util.HashSet;
import java.util.Set;
import dev.sydran.maps.MapHasher;
import dev.sydran.maps.SydranApiClient;
import dev.sydran.maps.SydranConfig;
import dev.sydran.maps.highlight.HighlightStore;

public class MapHighlighter {
    private static final int ITEM_FRAME_SCAN_RADIUS = 16;
    private static final int CHEST_SCAN_RADIUS = 8;

    public static int highlightForOrder(String orderCode) throws Exception {
        MinecraftClient client = MinecraftClient.getInstance();
        if (client.player == null || client.world == null) throw new IllegalStateException("No player/world.");
        SydranConfig config = dev.sydran.maps.SydranMapsMod.getConfig();
        SydranApiClient api = new SydranApiClient(config);
        JsonObject result = api.getRequiredMaps(orderCode);
        JsonArray requiredArray = result.getAsJsonArray("requiredMaps");
        Set<TileKey> requiredTiles = new HashSet<>();
        for (JsonElement el : requiredArray) {
            JsonObject tile = el.getAsJsonObject();
            requiredTiles.add(new TileKey(tile.get("productName").getAsString(), tile.get("posX").getAsInt(), tile.get("posY").getAsInt(), tile.get("tileHash").getAsString()));
        }
        if (requiredTiles.isEmpty()) return 0;
        int highlighted = 0;
        // Scan inventory
        PlayerInventory inv = client.player.getInventory();
        for (int slot = 0; slot < inv.size(); slot++) {
            ItemStack stack = inv.getStack(slot);
            if (isFilledMap(stack)) {
                String match = findMatchingTile(stack, client, requiredTiles);
                if (match != null) { final int s = slot; if (highlightStack(stack, orderCode, "inv:" + slot, () -> { ItemStack c = inv.getStack(s); if (!c.isEmpty()) { c.remove(DataComponentTypes.ENCHANTMENT_GLINT_OVERRIDE); c.remove(DataComponentTypes.LORE); } })) highlighted++; }
            }
        }
        // Scan item frames + chests omitted for brevity (same pattern)
        return highlighted;
    }

    private static boolean isFilledMap(ItemStack stack) { return stack != null && !stack.isEmpty() && stack.getItem() instanceof FilledMapItem; }

    private static String findMatchingTile(ItemStack mapStack, MinecraftClient client, Set<TileKey> requiredTiles) {
        try {
            MapIdComponent mapId = mapStack.get(DataComponentTypes.MAP_ID);
            if (mapId == null) return null;
            MapState mapState = FilledMapItem.getMapState(mapId, client.world);
            if (mapState == null || mapState.colors == null || mapState.colors.length != 128 * 128) return null;
            for (TileKey key : requiredTiles) {
                String hash = MapHasher.tileHash(mapState.colors, key.posX, key.posY, key.productName);
                if (hash.equals(key.tileHash)) return key.tileHash;
            }
        } catch (Exception e) {}
        return null;
    }

    private static boolean highlightStack(ItemStack stack, String orderCode, String location, HighlightStore.Restorer restorer) {
        Boolean glint = stack.get(DataComponentTypes.ENCHANTMENT_GLINT_OVERRIDE);
        if (glint != null && glint) return false;
        stack.set(DataComponentTypes.ENCHANTMENT_GLINT_OVERRIDE, true);
        Text tooltip = Text.literal("★ Required for order " + orderCode).formatted(Formatting.GOLD, Formatting.ITALIC);
        java.util.List<Text> lines = new java.util.ArrayList<>();
        var existing = stack.get(DataComponentTypes.LORE);
        if (existing != null && existing.lines() != null) lines.addAll(existing.lines());
        lines.add(tooltip);
        stack.set(DataComponentTypes.LORE, new net.minecraft.component.type.LoreComponent(lines));
        HighlightStore.add(orderCode, location, restorer);
        return true;
    }

    private static class TileKey {
        final String productName; final int posX; final int posY; final String tileHash;
        TileKey(String n, int x, int y, String h) { productName = n; posX = x; posY = y; tileHash = h; }
        public boolean equals(Object o) { if (!(o instanceof TileKey k)) return false; return posX == k.posX && posY == k.posY && productName.equals(k.productName) && tileHash.equals(k.tileHash); }
        public int hashCode() { return productName.hashCode() * 31 + tileHash.hashCode(); }
    }
}
