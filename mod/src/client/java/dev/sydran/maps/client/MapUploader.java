package dev.sydran.maps.client;

import net.minecraft.commands.CommandSourceStack;
import net.minecraft.network.chat.Component;
import net.minecraft.ChatFormatting;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import dev.sydran.maps.MapHasher;
import dev.sydran.maps.SydranApiClient;
import dev.sydran.maps.SydranConfig;
import dev.sydran.maps.command.SydranCommand;

/**
 * Orchestrates the full /sydran add upload flow.
 * Uses Mojang official mappings (MC 26.x).
 */
public class MapUploader {

    private final SydranConfig config;

    public MapUploader(SydranConfig config) {
        this.config = config;
    }

    public void upload(String productName, CommandSourceStack source) throws Exception {
        int w = config.getMapWidth();
        int h = config.getMapHeight();
        int total = w * h;

        source.sendSuccess(() -> Component.literal("Collecting " + total + " tiles (" + w + "x" + h + ")...")
            .withStyle(ChatFormatting.YELLOW), false);

        List<byte[]> tiles;
        try {
            tiles = MapDataReader.collectMaps(total);
        } catch (IllegalStateException e) {
            source.sendSuccess(() -> Component.literal("\u2717 " + e.getMessage())
                .withStyle(ChatFormatting.RED), false);
            return;
        }

        // Hash each tile
        List<String> tileHashes = new ArrayList<>();
        List<Map<String, Object>> tilePayload = new ArrayList<>();

        for (int i = 0; i < tiles.size(); i++) {
            int posX = i % w;
            int posY = i / w;
            byte[] colors = tiles.get(i);
            String hash = MapHasher.tileHash(colors, posX, posY, productName);
            tileHashes.add(hash);

            Map<String, Object> tile = new HashMap<>();
            tile.put("posX", posX);
            tile.put("posY", posY);
            tile.put("tileHash", hash);
            tilePayload.add(tile);
        }

        // Duplicate check
        if (config.isDuplicateCheck()) {
            source.sendSuccess(() -> Component.literal("Checking for duplicates...")
                .withStyle(ChatFormatting.YELLOW), false);

            SydranApiClient api = new SydranApiClient(config);
            var dupResult = api.duplicateCheck(productName, config.getCategory(), w, h);
            boolean isDup = dupResult.get("isDuplicate").getAsBoolean();

            if (isDup) {
                var existing = dupResult.getAsJsonObject("existingProduct");
                String existingName = existing.get("name").getAsString();
                String existingId = existing.get("id").getAsString();
                source.sendSuccess(() -> Component.literal("\u2717 Duplicate map detected!")
                    .withStyle(ChatFormatting.RED), false);
                source.sendSuccess(() -> Component.literal("  This map already exists: " + existingName + " (ID: " + existingId + ")")
                    .withStyle(ChatFormatting.RED), false);
                source.sendSuccess(() -> Component.literal("  Upload aborted.")
                    .withStyle(ChatFormatting.RED), false);
                return;
            }
        }

        // Upload
        source.sendSuccess(() -> Component.literal("Uploading " + total + " tiles...")
            .withStyle(ChatFormatting.YELLOW), false);

        SydranApiClient api = new SydranApiClient(config);

        Map<String, Object> body = new HashMap<>();
        body.put("productName", productName);
        body.put("price", config.getPrice());
        body.put("category", config.getCategory());
        body.put("width", w);
        body.put("height", h);
        body.put("tiles", tilePayload);

        var result = api.addProduct(body);

        String productCode = result.getAsJsonObject("product").get("code").getAsString();
        source.sendSuccess(() -> Component.literal("\u2713 Upload complete! Product " + productCode + " appears in store.")
            .withStyle(ChatFormatting.GREEN), false);
    }
}
