package dev.sydran.maps.client;

import net.minecraft.server.command.ServerCommandSource;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import dev.sydran.maps.MapHasher;
import dev.sydran.maps.SydranApiClient;
import dev.sydran.maps.SydranConfig;
import dev.sydran.maps.command.SydranCommand;

public class MapUploader {
    private final SydranConfig config;
    public MapUploader(SydranConfig config) { this.config = config; }

    public void upload(String productName, ServerCommandSource source) throws Exception {
        int w = config.getMapWidth(); int h = config.getMapHeight(); int total = w * h;
        source.sendFeedback(() -> Text.literal("Collecting " + total + " tiles (" + w + "x" + h + ")...").formatted(Formatting.YELLOW), false);
        List<byte[]> tiles;
        try { tiles = MapDataReader.collectMaps(total); }
        catch (IllegalStateException e) { source.sendFeedback(() -> Text.literal("\u2717 " + e.getMessage()).formatted(Formatting.RED), false); return; }
        List<String> tileHashes = new ArrayList<>();
        List<Map<String, Object>> tilePayload = new ArrayList<>();
        for (int i = 0; i < tiles.size(); i++) {
            int posX = i % w; int posY = i / w;
            String hash = MapHasher.tileHash(tiles.get(i), posX, posY, productName);
            tileHashes.add(hash);
            Map<String, Object> tile = new HashMap<>();
            tile.put("posX", posX); tile.put("posY", posY); tile.put("tileHash", hash);
            tilePayload.add(tile);
        }
        if (config.isDuplicateCheck()) {
            source.sendFeedback(() -> Text.literal("Checking for duplicates...").formatted(Formatting.YELLOW), false);
            SydranApiClient api = new SydranApiClient(config);
            var dupResult = api.duplicateCheck(productName, config.getCategory(), w, h);
            if (dupResult.get("isDuplicate").getAsBoolean()) {
                var existing = dupResult.getAsJsonObject("existingProduct");
                source.sendFeedback(() -> Text.literal("\u2717 Duplicate! Already exists: " + existing.get("name").getAsString()).formatted(Formatting.RED), false);
                return;
            }
        }
        source.sendFeedback(() -> Text.literal("Uploading " + total + " tiles...").formatted(Formatting.YELLOW), false);
        SydranApiClient api = new SydranApiClient(config);
        Map<String, Object> body = new HashMap<>();
        body.put("productName", productName); body.put("price", config.getPrice());
        body.put("category", config.getCategory()); body.put("width", w); body.put("height", h);
        body.put("tiles", tilePayload);
        var result = api.addProduct(body);
        String productCode = result.getAsJsonObject("product").get("code").getAsString();
        source.sendFeedback(() -> Text.literal("\u2713 Upload complete! Product " + productCode + " in store.").formatted(Formatting.GREEN), false);
    }
}
