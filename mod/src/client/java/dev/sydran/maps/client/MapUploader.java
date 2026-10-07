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

public class MapUploader {
    private final SydranConfig config;
    public MapUploader(SydranConfig config) { this.config = config; }
    public void upload(String productName, CommandSourceStack source) throws Exception {
        int w = config.getMapWidth(); int h = config.getMapHeight(); int total = w * h;
        source.sendSuccess(() -> Component.literal("Collecting " + total + " tiles...").withStyle(ChatFormatting.YELLOW), false);
        List<byte[]> tiles;
        try { tiles = MapDataReader.collectMaps(total); }
        catch (IllegalStateException e) { source.sendSuccess(() -> Component.literal("\u2717 " + e.getMessage()).withStyle(ChatFormatting.RED), false); return; }
        List<Map<String, Object>> tilePayload = new ArrayList<>();
        for (int i = 0; i < tiles.size(); i++) { int posX = i % w; int posY = i / w; String hash = MapHasher.tileHash(tiles.get(i), posX, posY, productName); Map<String, Object> tile = new HashMap<>(); tile.put("posX", posX); tile.put("posY", posY); tile.put("tileHash", hash); tilePayload.add(tile); }
        if (config.isDuplicateCheck()) { source.sendSuccess(() -> Component.literal("Checking for duplicates...").withStyle(ChatFormatting.YELLOW), false); SydranApiClient api = new SydranApiClient(config); var dupResult = api.duplicateCheck(productName, config.getCategory(), w, h); if (dupResult.get("isDuplicate").getAsBoolean()) { var existing = dupResult.getAsJsonObject("existingProduct"); source.sendSuccess(() -> Component.literal("\u2717 Duplicate! " + existing.get("name").getAsString()).withStyle(ChatFormatting.RED), false); return; } }
        source.sendSuccess(() -> Component.literal("Uploading " + total + " tiles...").withStyle(ChatFormatting.YELLOW), false);
        SydranApiClient api = new SydranApiClient(config);
        Map<String, Object> body = new HashMap<>(); body.put("productName", productName); body.put("price", config.getPrice()); body.put("category", config.getCategory()); body.put("width", w); body.put("height", h); body.put("tiles", tilePayload);
        var result = api.addProduct(body);
        String productCode = result.getAsJsonObject("product").get("code").getAsString();
        source.sendSuccess(() -> Component.literal("\u2713 Upload complete! Product " + productCode + " in store.").withStyle(ChatFormatting.GREEN), false);
    }
}
