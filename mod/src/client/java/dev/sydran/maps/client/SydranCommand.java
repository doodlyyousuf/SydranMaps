package dev.sydran.maps.client;

import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.StringArgumentType;
import com.mojang.brigadier.context.CommandContext;
import com.mojang.brigadier.exceptions.CommandSyntaxException;
import dev.sydran.maps.SydranApiClient;
import dev.sydran.maps.SydranConfig;
import dev.sydran.maps.highlight.HighlightStore;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandRegistrationCallback;
import net.fabricmc.fabric.api.client.command.v2.FabricClientCommandSource;
import net.fabricmc.fabric.api.client.command.v2.FabricClientCommandSource;
import net.minecraft.network.chat.ClickEvent;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.HoverEvent;
import net.minecraft.ChatFormatting;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

import static net.fabricmc.fabric.api.client.command.v2.ClientCommandManager.argument;
import static net.fabricmc.fabric.api.client.command.v2.ClientCommandManager.literal;

/**
 * Client-side /sydran commands.
 *
 * Uses Fabric's client command API (not server commands). This means
 * the mod is 100% client-side — no server installation needed.
 * The player installs it in .minecraft/mods/ and the commands work
 * in singleplayer + multiplayer without the server having the mod.
 */
public class SydranCommand {
    private static final List<String> VALID_CATEGORIES = List.of(
        "anime", "castle", "nature", "abstract", "logo", "portrait"
    );

    public static void register(ClientCommandRegistrationCallback callback) {
        // This is called from SydranClientMod
    }

    /**
     * Register all /sydran client commands on the dispatcher.
     */
    public static void registerCommands(CommandDispatcher<FabricClientCommandSource> dispatcher, SydranConfig config) {
        dispatcher.register(literal("sydran")
            .then(literal("status").executes(ctx -> status(ctx, config)))
            .then(literal("setprice").then(argument("amount", StringArgumentType.greedyString()).executes(ctx -> setPrice(ctx, config))))
            .then(literal("setcategory").then(argument("category", StringArgumentType.word()).executes(ctx -> setCategory(ctx, config))))
            .then(literal("setsize").then(argument("size", StringArgumentType.word()).executes(ctx -> setSize(ctx, config))))
            .then(literal("setduplicate").then(argument("state", StringArgumentType.word()).executes(ctx -> setDuplicate(ctx, config))))
            .then(literal("add").then(argument("name", StringArgumentType.greedyString()).executes(ctx -> add(ctx, config))).executes(ctx -> add(ctx, config)))
            .then(literal("config")
                .executes(ctx -> showConfig(ctx, config))
                .then(literal("url").then(argument("url", StringArgumentType.greedyString()).executes(ctx -> setApiUrl(ctx, config))))
                .then(literal("pin").then(argument("pin", StringArgumentType.word()).executes(ctx -> setPin(ctx, config)))))
            .then(literal("openorders").executes(ctx -> listOrders(ctx, config)))
            .then(literal("claim").then(argument("code", StringArgumentType.word()).then(argument("username", StringArgumentType.word()).executes(ctx -> claimOrder(ctx, config)))))
            .then(literal("deliver").then(argument("code", StringArgumentType.word()).then(argument("username", StringArgumentType.word()).executes(ctx -> deliverOrder(ctx, config)))))
            .then(literal("clearhighlights").executes(ctx -> clearHighlights(ctx)))
            .then(literal("rescan").then(argument("code", StringArgumentType.word()).executes(ctx -> rescanOrder(ctx))))
        );
    }

    // ── /sydran status ──────────────────────────────────────────────
    private static int status(CommandContext<FabricClientCommandSource> ctx, SydranConfig config) {
        final FabricClientCommandSource source = ctx.getSource();
        source.sendFeedback(Component.literal("Fetching Sydran Maps status...").withStyle(ChatFormatting.YELLOW));
        CompletableFuture.runAsync(() -> {
            try {
                SydranApiClient api = new SydranApiClient(config);
                var json = api.getStatus();
                String text = json.get("text").getAsString();
                for (String line : text.split("\n")) {
                    source.sendFeedback(Component.literal(line).withStyle(ChatFormatting.GRAY));
                }
            } catch (Exception e) {
                source.sendError(Component.literal("\u2717 Failed: " + e.getMessage()).withStyle(ChatFormatting.RED));
            }
        });
        return 1;
    }

    // ── /sydran setprice ────────────────────────────────────────────
    private static int setPrice(CommandContext<FabricClientCommandSource> ctx, SydranConfig config) throws CommandSyntaxException {
        String input = StringArgumentType.getString(ctx, "amount");
        int price = parsePrice(input);
        if (price < 0) {
            ctx.getSource().sendError(Component.literal("\u2717 Invalid price: " + input).withStyle(ChatFormatting.RED));
            return 0;
        }
        config.setPrice(price);
        pushConfigAsync(ctx.getSource(), config, "price", price);
        ctx.getSource().sendFeedback(Component.literal("\u2713 Price set to " + formatPrice(price)).withStyle(ChatFormatting.GREEN));
        return 1;
    }

    // ── /sydran setcategory ────────────────────────────────────────
    private static int setCategory(CommandContext<FabricClientCommandSource> ctx, SydranConfig config) throws CommandSyntaxException {
        String category = StringArgumentType.getString(ctx, "category").toLowerCase();
        if (!VALID_CATEGORIES.contains(category)) {
            ctx.getSource().sendError(Component.literal("\u2717 Invalid category. Valid: " + String.join(", ", VALID_CATEGORIES)).withStyle(ChatFormatting.RED));
            return 0;
        }
        config.setCategory(category);
        pushConfigAsync(ctx.getSource(), config, "category", category);
        ctx.getSource().sendFeedback(Component.literal("\u2713 Category set to " + category).withStyle(ChatFormatting.GREEN));
        return 1;
    }

    // ── /sydran setsize ─────────────────────────────────────────────
    private static int setSize(CommandContext<FabricClientCommandSource> ctx, SydranConfig config) throws CommandSyntaxException {
        String input = StringArgumentType.getString(ctx, "size").toLowerCase();
        String[] parts = input.split("x");
        if (parts.length != 2) {
            ctx.getSource().sendError(Component.literal("\u2717 Use format like 10x6, 2x2, 1x1").withStyle(ChatFormatting.RED));
            return 0;
        }
        try {
            int w = Integer.parseInt(parts[0]);
            int h = Integer.parseInt(parts[1]);
            if (w < 1 || h < 1 || w > 32 || h > 32) {
                ctx.getSource().sendError(Component.literal("\u2717 Size out of range (1\u201332).").withStyle(ChatFormatting.RED));
                return 0;
            }
            config.setMapSize(w, h);
            pushConfigAsync(ctx.getSource(), config, "size", w + "x" + h);
            ctx.getSource().sendFeedback(Component.literal("\u2713 Map size set to " + w + "x" + h + " (" + (w * h) + " tiles)").withStyle(ChatFormatting.GREEN));
        } catch (NumberFormatException e) {
            ctx.getSource().sendError(Component.literal("\u2717 Invalid size: " + input).withStyle(ChatFormatting.RED));
        }
        return 1;
    }

    // ── /sydran setduplicate ────────────────────────────────────────
    private static int setDuplicate(CommandContext<FabricClientCommandSource> ctx, SydranConfig config) throws CommandSyntaxException {
        String input = StringArgumentType.getString(ctx, "state").toLowerCase();
        boolean on;
        if (input.equals("on") || input.equals("true") || input.equals("1")) on = true;
        else if (input.equals("off") || input.equals("false") || input.equals("0")) on = false;
        else {
            ctx.getSource().sendError(Component.literal("\u2717 Use 'on' or 'off'.").withStyle(ChatFormatting.RED));
            return 0;
        }
        config.setDuplicateCheck(on);
        pushConfigAsync(ctx.getSource(), config, "duplicateCheck", on);
        ctx.getSource().sendFeedback(Component.literal("\u2713 Duplicate detection " + (on ? "ON" : "OFF")).withStyle(ChatFormatting.GREEN));
        return 1;
    }

    // ── /sydran add ─────────────────────────────────────────────────
    private static int add(CommandContext<FabricClientCommandSource> ctx, SydranConfig config) throws CommandSyntaxException {
        String name;
        try { name = StringArgumentType.getString(ctx, "name"); }
        catch (IllegalArgumentException e) { name = "Untitled Map"; }
        final String productName = name;
        final FabricClientCommandSource source = ctx.getSource();
        source.sendFeedback(Component.literal("Collecting " + config.getTotalTiles() + " tiles...").withStyle(ChatFormatting.YELLOW));
        CompletableFuture.runAsync(() -> {
            try {
                new MapUploader(config).upload(productName, source);
            } catch (Exception e) {
                source.sendError(Component.literal("\u2717 Upload failed: " + e.getMessage()).withStyle(ChatFormatting.RED));
            }
        });
        return 1;
    }

    // ── /sydran config ──────────────────────────────────────────────
    private static int showConfig(CommandContext<FabricClientCommandSource> ctx, SydranConfig config) {
        ctx.getSource().sendFeedback(Component.literal("Sydran Maps config:").withStyle(ChatFormatting.GOLD));
        ctx.getSource().sendFeedback(Component.literal("  API: " + config.getApiUrl()).withStyle(ChatFormatting.GRAY));
        ctx.getSource().sendFeedback(Component.literal("  PIN: " + (config.getAdminPin().isEmpty() ? "(not set)" : "********")).withStyle(ChatFormatting.GRAY));
        return 1;
    }

    private static int setApiUrl(CommandContext<FabricClientCommandSource> ctx, SydranConfig config) throws CommandSyntaxException {
        String url = StringArgumentType.getString(ctx, "url").replaceAll("/+$", "");
        config.setApiUrl(url);
        ctx.getSource().sendFeedback(Component.literal("\u2713 API URL set to " + url).withStyle(ChatFormatting.GREEN));
        return 1;
    }

    private static int setPin(CommandContext<FabricClientCommandSource> ctx, SydranConfig config) throws CommandSyntaxException {
        config.setAdminPin(StringArgumentType.getString(ctx, "pin"));
        ctx.getSource().sendFeedback(Component.literal("\u2713 Admin PIN set").withStyle(ChatFormatting.GREEN));
        return 1;
    }

    // ── /sydran openorders ──────────────────────────────────────────
    private static int listOrders(CommandContext<FabricClientCommandSource> ctx, SydranConfig config) {
        final FabricClientCommandSource source = ctx.getSource();
        source.sendFeedback(Component.literal("Fetching claimable orders...").withStyle(ChatFormatting.YELLOW));
        CompletableFuture.runAsync(() -> {
            try {
                SydranApiClient api = new SydranApiClient(config);
                var orders = api.getClaimableOrders().getAsJsonArray("orders");
                if (orders.size() == 0) {
                    source.sendFeedback(Component.literal("No claimable orders.").withStyle(ChatFormatting.GRAY));
                    return;
                }
                source.sendFeedback(Component.literal("Claimable orders (" + orders.size() + ")").withStyle(ChatFormatting.GOLD));
                for (int i = 0; i < orders.size(); i++) {
                    var order = orders.get(i).getAsJsonObject();
                    String code = order.get("code").getAsString();
                    String player = order.get("player").getAsString();
                    int amount = order.get("totalAmount").getAsInt();
                    int maps = order.get("totalMaps").getAsInt();

                    // [Open Order] → runs /order <player> in-game
                    Component openButton = Component.literal("[Open Order]")
                        .withStyle(ChatFormatting.BLUE, ChatFormatting.UNDERLINE)
                        .withStyle(s -> s.withClickEvent(
                            new ClickEvent(ClickEvent.Action.RUN_COMMAND, "/order " + player)
                        ));

                    // [Claim Order] → runs /sydran claim <code> <username>
                    String claimerName = source.getPlayer().getName().getString();
                    Component claimButton = Component.literal("[Claim Order]")
                        .withStyle(ChatFormatting.GREEN, ChatFormatting.UNDERLINE)
                        .withStyle(s -> s.withClickEvent(
                            new ClickEvent(ClickEvent.Action.RUN_COMMAND,
                                "/sydran claim " + code + " " + claimerName)
                        ));

                    source.sendFeedback(Component.literal("")
                        .append(Component.literal("\uD83D\uDCB0 ").withStyle(ChatFormatting.GOLD))
                        .append(Component.literal(code).withStyle(ChatFormatting.WHITE))
                        .append(Component.literal(" \u00B7 ").withStyle(ChatFormatting.DARK_GRAY))
                        .append(Component.literal(player).withStyle(ChatFormatting.AQUA))
                        .append(Component.literal(" \u00B7 ").withStyle(ChatFormatting.DARK_GRAY))
                        .append(Component.literal(formatPrice(amount)).withStyle(ChatFormatting.GREEN))
                        .append(Component.literal(" \u00B7 ").withStyle(ChatFormatting.DARK_GRAY))
                        .append(Component.literal(maps + " maps").withStyle(ChatFormatting.LIGHT_PURPLE)));

                    source.sendFeedback(Component.literal("  ")
                        .append(openButton)
                        .append(Component.literal("  "))
                        .append(claimButton));
                }
            } catch (Exception e) {
                source.sendError(Component.literal("\u2717 Failed: " + e.getMessage()).withStyle(ChatFormatting.RED));
            }
        });
        return 1;
    }

    // ── /sydran claim ───────────────────────────────────────────────
    private static int claimOrder(CommandContext<FabricClientCommandSource> ctx, SydranConfig config) throws CommandSyntaxException {
        String code = StringArgumentType.getString(ctx, "code").toUpperCase();
        String username = StringArgumentType.getString(ctx, "username");
        final FabricClientCommandSource source = ctx.getSource();
        source.sendFeedback(Component.literal("Claiming " + code + "...").withStyle(ChatFormatting.YELLOW));
        CompletableFuture.runAsync(() -> {
            try {
                SydranApiClient api = new SydranApiClient(config);
                api.claimOrder(code, username);
                source.sendFeedback(Component.literal("\u2713 Order " + code + " claimed by " + username + "!").withStyle(ChatFormatting.GREEN));
                source.sendFeedback(Component.literal("  Highlighting required maps...").withStyle(ChatFormatting.YELLOW));
                HighlightStore.requestHighlight(code);
            } catch (SydranApiClient.ApiException e) {
                String msg = e.getStatusCode() == 409 ? "\u2717 Order " + code + " not in 'paid' status" : "\u2717 Claim failed: " + e.getMessage();
                source.sendError(Component.literal(msg).withStyle(ChatFormatting.RED));
            } catch (Exception e) {
                source.sendError(Component.literal("\u2717 Claim failed: " + e.getMessage()).withStyle(ChatFormatting.RED));
            }
        });
        return 1;
    }

    // ── /sydran deliver ────────────────────────────────────────────
    private static int deliverOrder(CommandContext<FabricClientCommandSource> ctx, SydranConfig config) throws CommandSyntaxException {
        String code = StringArgumentType.getString(ctx, "code").toUpperCase();
        String username = StringArgumentType.getString(ctx, "username");
        final FabricClientCommandSource source = ctx.getSource();
        source.sendFeedback(Component.literal("Marking " + code + " as delivered...").withStyle(ChatFormatting.YELLOW));
        CompletableFuture.runAsync(() -> {
            try {
                SydranApiClient api = new SydranApiClient(config);
                api.markDelivered(code, username);
                int cleared = HighlightStore.countForOrder(code);
                HighlightStore.clearForOrder(code);
                String msg = "\u2713 Order " + code + " delivered!" + (cleared > 0 ? " Cleared " + cleared + " highlights." : "");
                source.sendFeedback(Component.literal(msg).withStyle(ChatFormatting.GREEN));
            } catch (SydranApiClient.ApiException e) {
                String msg = e.getStatusCode() == 409 ? "\u2717 Order " + code + " not in 'claimed' status" : "\u2717 Deliver failed: " + e.getMessage();
                source.sendError(Component.literal(msg).withStyle(ChatFormatting.RED));
            } catch (Exception e) {
                source.sendError(Component.literal("\u2717 Deliver failed: " + e.getMessage()).withStyle(ChatFormatting.RED));
            }
        });
        return 1;
    }

    // ── /sydran clearhighlights ─────────────────────────────────────
    private static int clearHighlights(CommandContext<FabricClientCommandSource> ctx) {
        HighlightStore.clearAll();
        ctx.getSource().sendFeedback(Component.literal("\u2713 All highlights cleared.").withStyle(ChatFormatting.GREEN));
        return 1;
    }

    // ── /sydran rescan ─────────────────────────────────────────────
    private static int rescanOrder(CommandContext<FabricClientCommandSource> ctx) throws CommandSyntaxException {
        String code = StringArgumentType.getString(ctx, "code").toUpperCase();
        HighlightStore.clearForOrder(code);
        HighlightStore.requestHighlight(code);
        ctx.getSource().sendFeedback(Component.literal("Re-scanning for " + code + "...").withStyle(ChatFormatting.YELLOW));
        return 1;
    }

    // ── Helpers ─────────────────────────────────────────────────────
    private static void pushConfigAsync(FabricClientCommandSource source, SydranConfig config, String key, Object value) {
        CompletableFuture.runAsync(() -> {
            try {
                new SydranApiClient(config).updateConfig(Map.of(key, value));
            } catch (Exception e) {
                source.sendFeedback(Component.literal("\u26A0 Could not sync to server").withStyle(ChatFormatting.YELLOW));
            }
        });
    }

    public static int parsePrice(String input) {
        String s = input.trim().toLowerCase().replaceAll("[$,]", "");
        if (s.isEmpty()) return -1;
        try {
            if (s.endsWith("k")) return (int)(Double.parseDouble(s.substring(0, s.length()-1)) * 1_000);
            if (s.endsWith("m")) return (int)(Double.parseDouble(s.substring(0, s.length()-1)) * 1_000_000);
            return Integer.parseInt(s);
        } catch (NumberFormatException e) { return -1; }
    }

    public static String formatPrice(int coins) {
        if (coins >= 1_000_000) {
            double m = coins / 1_000_000.0;
            return "$" + (m == (int)m ? String.format("%.0f", m) : String.format("%.1f", m).replaceAll("\\.0$", "")) + "M";
        }
        if (coins >= 1_000) {
            double k = coins / 1_000.0;
            return "$" + (k == (int)k ? String.format("%.0f", k) : String.format("%.1f", k).replaceAll("\\.0$", "")) + "K";
        }
        return "$" + coins;
    }
}
