package dev.sydran.maps.client;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import dev.sydran.maps.SydranApiClient;
import dev.sydran.maps.SydranConfig;
import dev.sydran.maps.SydranMapsMod;
import net.fabricmc.fabric.api.client.message.v1.ClientReceiveMessageEvents;
import net.minecraft.network.chat.Component;
import net.minecraft.ChatFormatting;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Reads in-game chat messages and auto-verifies players who paid.
 *
 * When DonutSMP sends a payment confirmation message like:
 *   "Doodly_yousuf paid doodly_yousuf 545 coins"
 *   or "doodly_yousuf received 545 from Doodly_yousuf"
 *   or the /pay output containing the player's IGN + the exact verify amount,
 *
 * the mod:
 *   1. Extracts the sender IGN + amount from the chat message
 *   2. Checks if any unverified user has that IGN + that verify amount
 *   3. If match found → calls /api/user/verify → user is verified
 *
 * This is fully automatic — no manual admin action needed.
 */
public class ChatPaymentWatcher {

    // Match patterns like:
    //   "PlayerName paid doodly_yousuf 545"
    //   "doodly_yousuf received 545 from PlayerName"
    //   "PlayerName → doodly_yousuf: 545"
    private static final Pattern PAY_PATTERN_1 = Pattern.compile(
        "(\\w+)\\s+(?:paid|sent|gave)\\s+doodly_yousuf\\s+(\\d+)",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern PAY_PATTERN_2 = Pattern.compile(
        "doodly_yousuf\\s+(?:received|got)\\s+(\\d+)\\s+from\\s+(\\w+)",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern PAY_PATTERN_3 = Pattern.compile(
        "(\\w+)\\s*(?:→|->)\\s*doodly_yousuf\\s*:?\\s*(\\d+)",
        Pattern.CASE_INSENSITIVE
    );

    public static void register() {
        ClientReceiveMessageEvents.GAME.register((message, overlay) -> {
            try {
                String text = message.getString();
                processChatMessage(text);
            } catch (Exception e) {
                // Silently ignore — don't crash on chat parsing
            }
        });

        // Also listen for system messages (payment confirmations are often system messages)
        ClientReceiveMessageEvents.SYSTEM.register((message, overlay) -> {
            try {
                String text = message.getString();
                processChatMessage(text);
            } catch (Exception e) {
                // Silently ignore
            }
        });

        SydranMapsMod.LOGGER.info("[Sydran Maps] Chat payment watcher registered");
    }

    private static void processChatMessage(String text) {
        if (text == null || text.isEmpty()) return;

        // Don't process our own command echoes
        if (text.startsWith("Sydran Maps") || text.startsWith("\u2713") || text.startsWith("\u2717")) return;

        String playerIgn = null;
        String amountStr = null;

        // Try pattern 1: "PlayerName paid doodly_yousuf 545"
        Matcher m1 = PAY_PATTERN_1.matcher(text);
        if (m1.find()) {
            playerIgn = m1.group(1);
            amountStr = m1.group(2);
        }

        // Try pattern 2: "doodly_yousuf received 545 from PlayerName"
        if (playerIgn == null) {
            Matcher m2 = PAY_PATTERN_2.matcher(text);
            if (m2.find()) {
                amountStr = m2.group(1);
                playerIgn = m2.group(2);
            }
        }

        // Try pattern 3: "PlayerName → doodly_yousuf: 545"
        if (playerIgn == null) {
            Matcher m3 = PAY_PATTERN_3.matcher(text);
            if (m3.find()) {
                playerIgn = m3.group(1);
                amountStr = m3.group(2);
            }
        }

        if (playerIgn == null || amountStr == null) return;

        // Found a payment message — try to auto-verify
        int amount = Integer.parseInt(amountStr);
        SydranMapsMod.LOGGER.info("[Sydran Maps] Detected payment: {} paid doodly_yousuf {}", playerIgn, amount);

        // Run verification in background
        final String ign = playerIgn;
        final int paidAmount = amount;

        java.util.concurrent.CompletableFuture.runAsync(() -> {
            try {
                SydranConfig config = SydranMapsMod.getConfig();
                SydranApiClient api = new SydranApiClient(config);

                // Check if there's an unverified user with this IGN + amount
                // by calling the unverified endpoint and matching
                JsonObject result = api.getRaw("/api/user/unverified");
                var users = result.getAsJsonArray("users");

                for (int i = 0; i < users.size(); i++) {
                    var user = users.get(i).getAsJsonObject();
                    String userIgn = user.get("minecraftIgn").getAsString();
                    int verifyAmount = user.get("verifyAmount").getAsInt();
                    String username = user.get("username").getAsString();

                    if (userIgn.equalsIgnoreCase(ign) && verifyAmount == paidAmount) {
                        // Match found — verify this user
                        SydranMapsMod.LOGGER.info("[Sydran Maps] Auto-verifying {} ({})", ign, username);

                        JsonObject verifyResult = api.post("/api/user/verify",
                            java.util.Map.of("username", username));

                        boolean verified = verifyResult.getAsJsonObject("user").get("verified").getAsBoolean();
                        if (verified) {
                            // Send confirmation to the player in-game
                            var client = net.minecraft.client.Minecraft.getInstance();
                            if (client.player != null) {
                                client.player.sendSystemMessage(
                                    net.minecraft.network.chat.Component.literal(
                                        "\u2713 [Sydran Maps] " + ign + " verified! They can now log in at sydran-maps.asifent.com"
                                    ).withStyle(ChatFormatting.GREEN)
                                );
                            }
                        }
                        return;
                    }
                }

                // No match found — the payment might be for something else
                SydranMapsMod.LOGGER.info("[Sydran Maps] Payment from {} ({} dollars) — no matching unverified user", ign, paidAmount);

            } catch (Exception e) {
                SydranMapsMod.LOGGER.warn("[Sydran Maps] Auto-verify failed: {}", e.getMessage());
            }
        });
    }
}
