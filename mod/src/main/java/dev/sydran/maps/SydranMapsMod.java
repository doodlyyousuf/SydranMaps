package dev.sydran.maps;

import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import dev.sydran.maps.command.SydranCommand;

public class SydranMapsMod implements ModInitializer {
    public static final String MOD_ID = "sydranmaps";
    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);
    private static SydranConfig config;

    @Override
    public void onInitialize() {
        config = SydranConfig.load();
        LOGGER.info("[Sydran Maps] Initialized. API URL: {}", config.getApiUrl());
        CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) -> {
            SydranCommand.register(dispatcher, config);
        });
    }

    public static SydranConfig getConfig() {
        return config;
    }
}
