package dev.sydran.maps.client;

import net.fabricmc.fabric.api.client.command.v2.FabricClientCommandSource;
import net.minecraft.network.chat.Component;
import net.minecraft.ChatFormatting;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import dev.sydran.maps.MapHasher;
import dev.sydran.maps.SydranApiClient;
import dev.sydran.maps.SydranConfig;

/**
 * Orchestrates the full /sydran add upload flow.
 * Client-side only — uses FabricClientCommandSource.
 */
public class MapUploader {

    private final SydranConfig config;

    public MapUploader(SydranConfig config) {
        this.config = config;
    }

    public void upload(String productName, FabricClientCommandSource source) throws Exception {
        int w = config.getMapWidth();
        int h = config.getMapHeight();
        int total = w * h;

        source.sendFeedback(Component.literal("Collecting " + total + " tiles (" + w + "x" + h + ")...")
            .withStyle(ChatFormatting.YELLOW));

        List<byte[]> tiles;
        try {
            tiles = MapDataReader.collectMaps(total);
        } catch (IllegalStateException e) {
            source.sendError(Component.literal("\u2717 " + e.getMessage()).withStyle(ChatFormatting.RED));
            return;
        }

        // Hash each tile
        List<Map<String, Object>> tilePayload = new ArrayList<>();
        for (int i = 0; i < tiles.size(); i++) {
            int posX = i % w;
            int posY = i / w;
            String hash = MapHasher.tileHash(tiles.get(i), posX, posY, productName);
            Map<String, Object> tile = new HashMap<>();
            tile.put("posX", posX);
            tile.put("posY", posY);
            tile.put("tileHash", hash);
            tilePayload.add(tile);
        }

        // Duplicate check
        if (config.isDuplicateCheck()) {
            source.sendFeedback(Component.literal("Checking for duplicates...")
                .withStyle(ChatFormatting.YELLOW));

            SydranApiClient api = new SydranApiClient(config);
            var dupResult = api.duplicateCheck(productName, config.getCategory(), w, h);
            boolean isDup = dupResult.get("isDuplicate").getAsBoolean();

            if (isDup) {
                var existing = dupResult.getAsJsonObject("existingProduct");
                String existingName = existing.get("name").getAsString();
                source.sendError(Component.literal("\u2717 Duplicate map detected! Already exists: " + existingName)
                    .withStyle(ChatFormatting.RED));
                return;
            }
        }

        // Upload
        source.sendFeedback(Component.literal("Uploading " + total + " tiles...")
            .withStyle(ChatFormatting.YELLOW));

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
        source.sendFeedback(Component.literal("\u2713 Upload complete! Product " + productCode + " appears in store.")
            .withStyle(ChatFormatting.GREEN));
    }
}
