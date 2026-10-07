package dev.sydran.maps;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Static config holder — NOT a ModInitializer.
 *
 * This mod is entirely client-side. The config is loaded by
 * SydranClientMod.onInitializeClient() and stored here for
 * access by other classes. No server-side entrypoint exists.
 */
public class SydranMapsMod {
    public static final String MOD_ID = "sydranmaps";
    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);
    private static SydranConfig config;

    /** Called once by SydranClientMod during client init. */
    public static void init() {
        config = SydranConfig.load();
        LOGGER.info("[Sydran Maps] Client mod initialized. API URL: {}", config.getApiUrl());
    }

    public static SydranConfig getConfig() {
        return config;
    }
}
