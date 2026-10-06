package dev.sydran.maps.client;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import net.minecraft.client.MinecraftClient;
import net.minecraft.component.DataComponentTypes;
import net.minecraft.component.type.LoreComponent;
import net.minecraft.component.type.MapIdComponent;
import net.minecraft.entity.player.PlayerInventory;
import net.minecraft.item.FilledMapItem;
import net.minecraft.item.ItemStack;
import net.minecraft.item.map.MapState;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Box;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
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
        PlayerInventory inv = client.player.getInventory();
        for (int slot = 0; slot < inv.size(); slot++) {
            ItemStack stack = inv.getStack(slot);
            if (isFilledMap(stack)) {
                String match = findMatchingTile(stack, client, requiredTiles);
                if (match != null) { final int s = slot; if (highlightStack(stack, orderCode, "inv:" + slot, () -> { ItemStack c = inv.getStack(s); if (!c.isEmpty()) { c.remove(DataComponentTypes.ENCHANTMENT_GLINT_OVERRIDE); c.remove(DataComponentTypes.LORE); } })) highlighted++; }
            }
        }
        BlockPos playerPos = client.player.getBlockPos();
        Iterable<net.minecraft.entity.decoration.ItemFrameEntity> frames = client.world.getEntitiesByClass(net.minecraft.entity.decoration.ItemFrameEntity.class, new Box(playerPos.getX()-ITEM_FRAME_SCAN_RADIUS, playerPos.getY()-ITEM_FRAME_SCAN_RADIUS, playerPos.getZ()-ITEM_FRAME_SCAN_RADIUS, playerPos.getX()+ITEM_FRAME_SCAN_RADIUS, playerPos.getY()+ITEM_FRAME_SCAN_RADIUS, playerPos.getZ()+ITEM_FRAME_SCAN_RADIUS), frame -> true);
        for (net.minecraft.entity.decoration.ItemFrameEntity frame : frames) {
            ItemStack stack = frame.getHeldItemStack();
            if (isFilledMap(stack)) {
                String match = findMatchingTile(stack, client, requiredTiles);
                if (match != null) { BlockPos fp = frame.getBlockPos(); if (highlightStack(stack, orderCode, "frame@"+fp.getX()+","+fp.getY()+","+fp.getZ(), () -> { ItemStack c = frame.getHeldItemStack(); if (!c.isEmpty()) { c.remove(DataComponentTypes.ENCHANTMENT_GLINT_OVERRIDE); c.remove(DataComponentTypes.LORE); } })) highlighted++; }
            }
        }
        for (BlockPos pos : BlockPos.iterate(playerPos.add(-CHEST_SCAN_RADIUS,-CHEST_SCAN_RADIUS,-CHEST_SCAN_RADIUS), playerPos.add(CHEST_SCAN_RADIUS,CHEST_SCAN_RADIUS,CHEST_SCAN_RADIUS))) {
            var be = client.world.getBlockEntity(pos);
            if (be instanceof net.minecraft.inventory.Inventory inventory) {
                for (int slot = 0; slot < inventory.size(); slot++) {
                    ItemStack stack = inventory.getStack(slot);
                    if (isFilledMap(stack)) {
                        String match = findMatchingTile(stack, client, requiredTiles);
                        if (match != null) { final int sf = slot; final BlockPos bp = pos.toImmutable(); if (highlightStack(stack, orderCode, "chest@"+pos.getX()+","+pos.getY()+","+pos.getZ()+":"+slot, () -> { var b = client.world.getBlockEntity(bp); if (b instanceof net.minecraft.inventory.Inventory inv2) { ItemStack c = inv2.getStack(sf); if (!c.isEmpty()) { c.remove(DataComponentTypes.ENCHANTMENT_GLINT_OVERRIDE); c.remove(DataComponentTypes.LORE); } } })) highlighted++; }
                    }
                }
            }
        }
        return highlighted;
    }

    private static boolean isFilledMap(ItemStack stack) { return stack != null && !stack.isEmpty() && stack.getItem() instanceof FilledMapItem; }

    private static String findMatchingTile(ItemStack mapStack, MinecraftClient client, Set<TileKey> requiredTiles) {
        try {
            MapIdComponent mapId = mapStack.get(DataComponentTypes.MAP_ID);
            if (mapId == null) return null;
            MapState mapState = FilledMapItem.getMapState(mapId, client.world);
            if (mapState == null || mapState.colors == null || mapState.colors.length != 128*128) return null;
            for (TileKey key : requiredTiles) { String hash = MapHasher.tileHash(mapState.colors, key.posX, key.posY, key.productName); if (hash.equals(key.tileHash)) return key.tileHash; }
        } catch (Exception e) {}
        return null;
    }

    private static boolean highlightStack(ItemStack stack, String orderCode, String location, HighlightStore.Restorer restorer) {
        Boolean glint = stack.get(DataComponentTypes.ENCHANTMENT_GLINT_OVERRIDE);
        if (glint != null && glint) return false;
        stack.set(DataComponentTypes.ENCHANTMENT_GLINT_OVERRIDE, true);
        Text tooltip = Text.literal("\u2605 Required for order " + orderCode).formatted(Formatting.GOLD, Formatting.ITALIC);
        LoreComponent existing = stack.get(DataComponentTypes.LORE);
        List<Text> lines = new ArrayList<>();
        if (existing != null && existing.lines() != null) lines.addAll(existing.lines());
        lines.add(tooltip);
        stack.set(DataComponentTypes.LORE, new LoreComponent(lines));
        HighlightStore.add(orderCode, location, restorer);
        return true;
    }

    private static class TileKey {
        final String productName; final int posX; final int posY; final String tileHash;
        TileKey(String n, int x, int y, String h) { productName=n; posX=x; posY=y; tileHash=h; }
        public boolean equals(Object o) { if(!(o instanceof TileKey k)) return false; return posX==k.posX&&posY==k.posY&&productName.equals(k.productName)&&tileHash.equals(k.tileHash); }
        public int hashCode() { return productName.hashCode()*31+tileHash.hashCode(); }
    }
}
