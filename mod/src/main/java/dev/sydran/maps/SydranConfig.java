package dev.sydran.maps;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.fabricmc.loader.api.FabricLoader;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

public class SydranConfig {
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Path CONFIG_FILE = FabricLoader.getInstance().getConfigDir().resolve("sydran-maps.json");

    private String apiUrl = "http://localhost:3000";
    private String adminPin = "";
    private int price = 50000;
    private String category = "general";
    private int mapWidth = 1;
    private int mapHeight = 1;
    private boolean duplicateCheck = true;

    public static SydranConfig load() {
        try {
            if (Files.exists(CONFIG_FILE)) {
                String json = Files.readString(CONFIG_FILE);
                SydranConfig cfg = GSON.fromJson(json, SydranConfig.class);
                if (cfg != null) return cfg;
            }
        } catch (Exception e) {
            SydranMapsMod.LOGGER.warn("[Sydran Maps] Failed to load config: {}", e.getMessage());
        }
        return new SydranConfig();
    }

    public void save() {
        try {
            Files.writeString(CONFIG_FILE, GSON.toJson(this));
        } catch (IOException e) {
            SydranMapsMod.LOGGER.error("[Sydran Maps] Failed to save config: {}", e.getMessage());
        }
    }

    public String getApiUrl() { return apiUrl; }
    public void setApiUrl(String apiUrl) { this.apiUrl = apiUrl; save(); }
    public String getAdminPin() { return adminPin; }
    public void setAdminPin(String pin) { this.adminPin = pin; save(); }
    public int getPrice() { return price; }
    public void setPrice(int price) { this.price = price; save(); }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; save(); }
    public int getMapWidth() { return mapWidth; }
    public int getMapHeight() { return mapHeight; }
    public void setMapSize(int w, int h) { this.mapWidth = w; this.mapHeight = h; save(); }
    public boolean isDuplicateCheck() { return duplicateCheck; }
    public void setDuplicateCheck(boolean on) { this.duplicateCheck = on; save(); }
    public int getTotalTiles() { return mapWidth * mapHeight; }
}
