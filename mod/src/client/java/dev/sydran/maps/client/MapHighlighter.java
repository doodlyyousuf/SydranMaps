package dev.sydran.maps.client;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import net.minecraft.ChatFormatting;
import net.minecraft.client.Minecraft;
import net.minecraft.core.BlockPos;
import net.minecraft.core.component.DataComponents;
import net.minecraft.network.chat.Component;
import net.minecraft.world.entity.decoration.ItemFrame;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.MapItem;
import net.minecraft.world.item.component.ItemLore;
import net.minecraft.world.item.component.MapId;
import net.minecraft.world.level.saveddata.maps.MapItemSavedData;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.Container;
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
        Minecraft client = Minecraft.getInstance();
        if (client.player == null || client.level == null) throw new IllegalStateException("No player/world.");
        SydranConfig config = dev.sydran.maps.SydranMapsMod.getConfig();
        SydranApiClient api = new SydranApiClient(config);
        JsonObject result = api.getRequiredMaps(orderCode);
        JsonArray requiredArray = result.getAsJsonArray("requiredMaps");
        Set<TileKey> requiredTiles = new HashSet<>();
        for (JsonElement el : requiredArray) { JsonObject tile = el.getAsJsonObject(); requiredTiles.add(new TileKey(tile.get("productName").getAsString(), tile.get("posX").getAsInt(), tile.get("posY").getAsInt(), tile.get("tileHash").getAsString())); }
        if (requiredTiles.isEmpty()) return 0;
        int highlighted = 0;
        var inv = client.player.getInventory();
        for (int slot = 0; slot < inv.getContainerSize(); slot++) { ItemStack stack = inv.getItem(slot); if (isFilledMap(stack)) { String match = findMatchingTile(stack, client, requiredTiles); if (match != null) { final int s = slot; if (highlightStack(stack, orderCode, "inv:" + slot, () -> { ItemStack c = inv.getItem(s); if (!c.isEmpty()) { c.remove(DataComponents.ENCHANTMENT_GLINT_OVERRIDE); c.remove(DataComponents.LORE); } })) highlighted++; } } }
        BlockPos playerPos = client.player.blockPosition();
        AABB scanBox = new AABB(playerPos.getX()-ITEM_FRAME_SCAN_RADIUS, playerPos.getY()-ITEM_FRAME_SCAN_RADIUS, playerPos.getZ()-ITEM_FRAME_SCAN_RADIUS, playerPos.getX()+ITEM_FRAME_SCAN_RADIUS, playerPos.getY()+ITEM_FRAME_SCAN_RADIUS, playerPos.getZ()+ITEM_FRAME_SCAN_RADIUS);
        List<ItemFrame> frames = client.level.getEntitiesOfClass(ItemFrame.class, scanBox, f -> true);
        for (ItemFrame frame : frames) { ItemStack stack = frame.getItem(); if (isFilledMap(stack)) { String match = findMatchingTile(stack, client, requiredTiles); if (match != null) { BlockPos fp = frame.blockPosition(); if (highlightStack(stack, orderCode, "frame@"+fp.getX()+","+fp.getY()+","+fp.getZ(), () -> { ItemStack c = frame.getItem(); if (!c.isEmpty()) { c.remove(DataComponents.ENCHANTMENT_GLINT_OVERRIDE); c.remove(DataComponents.LORE); } })) highlighted++; } } }
        for (BlockPos pos : BlockPos.betweenClosed(playerPos.offset(-CHEST_SCAN_RADIUS,-CHEST_SCAN_RADIUS,-CHEST_SCAN_RADIUS), playerPos.offset(CHEST_SCAN_RADIUS,CHEST_SCAN_RADIUS,CHEST_SCAN_RADIUS))) { var be = client.level.getBlockEntity(pos); if (be instanceof Container container) { for (int slot = 0; slot < container.getContainerSize(); slot++) { ItemStack stack = container.getItem(slot); if (isFilledMap(stack)) { String match = findMatchingTile(stack, client, requiredTiles); if (match != null) { final int sf = slot; final BlockPos bp = pos.immutable(); if (highlightStack(stack, orderCode, "chest@"+pos.getX()+","+pos.getY()+","+pos.getZ()+":"+slot, () -> { var b = client.level.getBlockEntity(bp); if (b instanceof Container cont) { ItemStack c = cont.getItem(sf); if (!c.isEmpty()) { c.remove(DataComponents.ENCHANTMENT_GLINT_OVERRIDE); c.remove(DataComponents.LORE); } } })) highlighted++; } } } } } }
        return highlighted;
    }
    private static boolean isFilledMap(ItemStack stack) { return stack != null && !stack.isEmpty() && stack.getItem() instanceof MapItem; }
    private static String findMatchingTile(ItemStack mapStack, Minecraft client, Set<TileKey> requiredTiles) {
        try { MapId mapId = mapStack.get(DataComponents.MAP_ID); if (mapId == null) return null; MapItemSavedData mapData = MapItem.getSavedData(mapId, client.level); if (mapData == null || mapData.colors == null || mapData.colors.length != 128*128) return null; for (TileKey key : requiredTiles) { String hash = MapHasher.tileHash(mapData.colors, key.posX, key.posY, key.productName); if (hash.equals(key.tileHash)) return key.tileHash; } } catch (Exception e) {}
        return null;
    }
    private static boolean highlightStack(ItemStack stack, String orderCode, String location, HighlightStore.Restorer restorer) {
        Boolean glint = stack.get(DataComponents.ENCHANTMENT_GLINT_OVERRIDE);
        if (glint != null && glint) return false;
        stack.set(DataComponents.ENCHANTMENT_GLINT_OVERRIDE, true);
        Component tooltip = Component.literal("\u2605 Required for order " + orderCode).withStyle(ChatFormatting.GOLD, ChatFormatting.ITALIC);
        ItemLore existing = stack.get(DataComponents.LORE);
        List<Component> lines = new ArrayList<>();
        if (existing != null && existing.lines() != null) lines.addAll(existing.lines());
        lines.add(tooltip);
        stack.set(DataComponents.LORE, new ItemLore(lines));
        HighlightStore.add(orderCode, location, restorer);
        return true;
    }
    private static class TileKey { final String productName; final int posX; final int posY; final String tileHash; TileKey(String n, int x, int y, String h) { productName=n; posX=x; posY=y; tileHash=h; } public boolean equals(Object o) { if(!(o instanceof TileKey k)) return false; return posX==k.posX&&posY==k.posY&&productName.equals(k.productName)&&tileHash.equals(k.tileHash); } public int hashCode() { return productName.hashCode()*31+tileHash.hashCode(); } }
}
