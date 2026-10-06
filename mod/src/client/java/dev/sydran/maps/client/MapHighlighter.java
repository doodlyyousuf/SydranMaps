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

/**
 * Finds and highlights the exact filled maps required to fulfil a
 * claimed order. Uses Mojang official mappings (MC 26.x).
 */
public class MapHighlighter {

    private static final int ITEM_FRAME_SCAN_RADIUS = 16;
    private static final int CHEST_SCAN_RADIUS = 8;

    public static int highlightForOrder(String orderCode) throws Exception {
        Minecraft client = Minecraft.getInstance();
        if (client.player == null || client.level == null) {
            throw new IllegalStateException("No player/world context.");
        }

        SydranConfig config = dev.sydran.maps.SydranMapsMod.getConfig();
        SydranApiClient api = new SydranApiClient(config);

        JsonObject result = api.getRequiredMaps(orderCode);
        JsonArray requiredArray = result.getAsJsonArray("requiredMaps");

        Set<TileKey> requiredTiles = new HashSet<>();
        for (JsonElement el : requiredArray) {
            JsonObject tile = el.getAsJsonObject();
            requiredTiles.add(new TileKey(
                tile.get("productName").getAsString(),
                tile.get("posX").getAsInt(),
                tile.get("posY").getAsInt(),
                tile.get("tileHash").getAsString()
            ));
        }

        if (requiredTiles.isEmpty()) return 0;

        int highlighted = 0;

        // ── 1. Scan player inventory ───────────────────────────────
        var inv = client.player.getInventory();
        for (int slot = 0; slot < inv.getContainerSize(); slot++) {
            ItemStack stack = inv.getItem(slot);
            if (isFilledMap(stack)) {
                String match = findMatchingTile(stack, client, requiredTiles);
                if (match != null) {
                    final int s = slot;
                    if (highlightStack(stack, orderCode, "inv:" + slot, () -> {
                        ItemStack current = inv.getItem(s);
                        if (!current.isEmpty()) {
                            current.remove(DataComponents.ENCHANTMENT_GLINT_OVERRIDE);
                            current.remove(DataComponents.LORE);
                        }
                    })) {
                        highlighted++;
                    }
                }
            }
        }

        // ── 2. Scan nearby item frames ──────────────────────────────
        BlockPos playerPos = client.player.blockPosition();
        AABB scanBox = new AABB(
            playerPos.getX() - ITEM_FRAME_SCAN_RADIUS,
            playerPos.getY() - ITEM_FRAME_SCAN_RADIUS,
            playerPos.getZ() - ITEM_FRAME_SCAN_RADIUS,
            playerPos.getX() + ITEM_FRAME_SCAN_RADIUS,
            playerPos.getY() + ITEM_FRAME_SCAN_RADIUS,
            playerPos.getZ() + ITEM_FRAME_SCAN_RADIUS
        );

        List<ItemFrame> frames = client.level.getEntitiesOfClass(ItemFrame.class, scanBox, frame -> true);
        for (ItemFrame frame : frames) {
            ItemStack stack = frame.getItem();
            if (isFilledMap(stack)) {
                String match = findMatchingTile(stack, client, requiredTiles);
                if (match != null) {
                    BlockPos framePos = frame.blockPosition();
                    String location = "frame@" + framePos.getX() + "," + framePos.getY() + "," + framePos.getZ();
                    if (highlightStack(stack, orderCode, location, () -> {
                        ItemStack current = frame.getItem();
                        if (!current.isEmpty()) {
                            current.remove(DataComponents.ENCHANTMENT_GLINT_OVERRIDE);
                            current.remove(DataComponents.LORE);
                        }
                    })) {
                        highlighted++;
                    }
                }
            }
        }

        // ── 3. Scan nearby chests / barrels / shulkers ───────────────
        for (BlockPos pos : BlockPos.betweenClosed(
            playerPos.offset(-CHEST_SCAN_RADIUS, -CHEST_SCAN_RADIUS, -CHEST_SCAN_RADIUS),
            playerPos.offset(CHEST_SCAN_RADIUS, CHEST_SCAN_RADIUS, CHEST_SCAN_RADIUS)
        )) {
            var blockEntity = client.level.getBlockEntity(pos);
            if (blockEntity instanceof Container container) {
                for (int slot = 0; slot < container.getContainerSize(); slot++) {
                    ItemStack stack = container.getItem(slot);
                    if (isFilledMap(stack)) {
                        String match = findMatchingTile(stack, client, requiredTiles);
                        if (match != null) {
                            String location = "chest@" + pos.getX() + "," + pos.getY() + "," + pos.getZ() + ":" + slot;
                            final int slotFinal = slot;
                            final BlockPos bePos = pos.immutable();
                            if (highlightStack(stack, orderCode, location, () -> {
                                var be = client.level.getBlockEntity(bePos);
                                if (be instanceof Container cont) {
                                    ItemStack current = cont.getItem(slotFinal);
                                    if (!current.isEmpty()) {
                                        current.remove(DataComponents.ENCHANTMENT_GLINT_OVERRIDE);
                                        current.remove(DataComponents.LORE);
                                    }
                                }
                            })) {
                                highlighted++;
                            }
                        }
                    }
                }
            }
        }

        return highlighted;
    }

    public static void clearForOrder(String orderCode) {
        HighlightStore.clearForOrder(orderCode);
    }

    public static void clearAll() {
        HighlightStore.clearAll();
    }

    // ── Helpers ──────────────────────────────────────────────────────

    private static boolean isFilledMap(ItemStack stack) {
        return stack != null && !stack.isEmpty() && stack.getItem() instanceof MapItem;
    }

    private static String findMatchingTile(ItemStack mapStack, Minecraft client, Set<TileKey> requiredTiles) {
        try {
            MapId mapId = mapStack.get(DataComponents.MAP_ID);
            if (mapId == null) return null;

            MapItemSavedData mapData = MapItem.getSavedData(mapId, client.level);
            if (mapData == null || mapData.colors == null) return null;
            if (mapData.colors.length != 128 * 128) return null;

            for (TileKey key : requiredTiles) {
                String hash = MapHasher.tileHash(mapData.colors, key.posX, key.posY, key.productName);
                if (hash.equals(key.tileHash)) {
                    return key.tileHash;
                }
            }
        } catch (Exception e) {
            // Skip this map on any error.
        }
        return null;
    }

    private static boolean highlightStack(ItemStack stack, String orderCode, String location,
                                          HighlightStore.Restorer restorer) {
        Boolean currentGlint = stack.get(DataComponents.ENCHANTMENT_GLINT_OVERRIDE);
        if (currentGlint != null && currentGlint) {
            return false;
        }

        stack.set(DataComponents.ENCHANTMENT_GLINT_OVERRIDE, true);

        Component tooltipLine = Component.literal("\u2605 Required for order " + orderCode)
            .withStyle(ChatFormatting.GOLD, ChatFormatting.ITALIC);

        ItemLore existingLore = stack.get(DataComponents.LORE);
        List<Component> lines = new ArrayList<>();
        if (existingLore != null && existingLore.lines() != null) {
            lines.addAll(existingLore.lines());
        }
        lines.add(tooltipLine);
        stack.set(DataComponents.LORE, new ItemLore(lines));

        HighlightStore.add(orderCode, location, restorer);
        return true;
    }

    private static class TileKey {
        final String productName;
        final int posX;
        final int posY;
        final String tileHash;

        TileKey(String productName, int posX, int posY, String tileHash) {
            this.productName = productName;
            this.posX = posX;
            this.posY = posY;
            this.tileHash = tileHash;
        }

        @Override
        public boolean equals(Object o) {
            if (!(o instanceof TileKey k)) return false;
            return posX == k.posX && posY == k.posY
                && productName.equals(k.productName)
                && tileHash.equals(k.tileHash);
        }

        @Override
        public int hashCode() {
            return productName.hashCode() * 31 + tileHash.hashCode();
        }
    }
}
