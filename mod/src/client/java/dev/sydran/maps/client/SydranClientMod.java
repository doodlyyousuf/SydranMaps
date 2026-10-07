package dev.sydran.maps.client;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandRegistrationCallback;
import dev.sydran.maps.SydranMapsMod;
import dev.sydran.maps.SydranConfig;

/**
 * Client-only mod entrypoint.
 *
 * This mod is 100% client-side — no server installation required.
 * The player drops the JAR in .minecraft/mods/ and the /sydran
 * commands work in both singleplayer and multiplayer.
 *
 * The mod talks directly to the Sydran Maps web API over HTTP.
 * It reads the player's filled maps, hashes them, and uploads to
 * the store — all from the client.
 */
public class SydranClientMod implements ClientModInitializer {

    @Override
    public void onInitializeClient() {
        // Load config from disk
        SydranMapsMod.init();

        // Register /sydran client commands (not server commands)
        ClientCommandRegistrationCallback.EVENT.register((dispatcher, registryAccess) -> {
            SydranCommand.registerCommands(dispatcher, SydranMapsMod.getConfig());
        });

        // Register the highlight bridge (server→client tick handler)
        HighlightBridge.register();

        // Register chat payment watcher — auto-verifies players who paid
        ChatPaymentWatcher.register();

        SydranMapsMod.LOGGER.info("[Sydran Maps] Client mod ready. Commands: /sydran <status|openorders|claim|deliver|add|...>");
    }
}
