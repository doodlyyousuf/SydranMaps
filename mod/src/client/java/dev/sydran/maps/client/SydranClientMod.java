package dev.sydran.maps.client;

import net.fabricmc.api.ClientModInitializer;
import dev.sydran.maps.SydranMapsMod;

public class SydranClientMod implements ClientModInitializer {
    @Override
    public void onInitializeClient() {
        SydranMapsMod.LOGGER.info("[Sydran Maps] Client initialized.");
        HighlightBridge.register();
    }
}
