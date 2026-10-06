package dev.sydran.maps.command;

import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.StringArgumentType;
import com.mojang.brigadier.context.CommandContext;
import com.mojang.brigadier.exceptions.CommandSyntaxException;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.network.chat.ClickEvent;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.HoverEvent;
import net.minecraft.ChatFormatting;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import static net.minecraft.commands.Commands.argument;
import static net.minecraft.commands.Commands.literal;
import dev.sydran.maps.SydranApiClient;
import dev.sydran.maps.SydranConfig;
import dev.sydran.maps.SydranMapsMod;
import dev.sydran.maps.client.MapUploader;
import dev.sydran.maps.highlight.HighlightStore;

/**
 * All /sydran commands — rewritten for Mojang official mappings (MC 26.x).
 *
 * Key Yarn→Mojang changes:
 *   ServerCommandSource → CommandSourceStack
 *   Text                → Component
 *   Formatting           → ChatFormatting
 *   CommandManager       → Commands
 *   sendFeedback()       → sendSuccess()
 *   Text.literal("x").formatted(F.GREEN) → Component.literal("x").withStyle(ChatFormatting.GREEN)
 */
public class SydranCommand {
    private static final List<String> VALID_CATEGORIES = List.of(
        "anime", "castle", "nature", "abstract", "logo", "portrait"
    );

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher, SydranConfig config) {
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
    private static int status(CommandContext<CommandSourceStack> ctx, SydranConfig config) {
        final CommandSourceStack source = ctx.getSource();
        source.sendSuccess(() -> Component.literal("Fetching Sydran Maps status...").withStyle(ChatFormatting.YELLOW), false);
        CompletableFuture.runAsync(() -> {
            try {
                SydranApiClient api = new SydranApiClient(config);
                var json = api.getStatus();
                String text = json.get("text").getAsString();
                for (String line : text.split("\n")) {
                    source.sendSuccess(() -> Component.literal(line).withStyle(ChatFormatting.GRAY), false);
                }
            } catch (Exception e) {
                source.sendSuccess(() -> Component.literal("\u2717 Failed: " + e.getMessage()).withStyle(ChatFormatting.RED), false);
            }
        });
        return 1;
    }

    // ── /sydran setprice ────────────────────────────────────────────
    private static int setPrice(CommandContext<CommandSourceStack> ctx, SydranConfig config) throws CommandSyntaxException {
        String input = StringArgumentType.getString(ctx, "amount");
        int price = parsePrice(input);
        if (price < 0) {
            ctx.getSource().sendSuccess(() -> Component.literal("\u2717 Invalid price: " + input).withStyle(ChatFormatting.RED), false);
            return 0;
        }
        config.setPrice(price);
        pushConfigAsync(ctx.getSource(), config, "price", price);
        ctx.getSource().sendSuccess(() -> Component.literal("\u2713 Price set to " + formatPrice(price)).withStyle(ChatFormatting.GREEN), false);
        return 1;
    }

    // ── /sydran setcategory ────────────────────────────────────────
    private static int setCategory(CommandContext<CommandSourceStack> ctx, SydranConfig config) throws CommandSyntaxException {
        String category = StringArgumentType.getString(ctx, "category").toLowerCase();
        if (!VALID_CATEGORIES.contains(category)) {
            ctx.getSource().sendSuccess(() -> Component.literal("\u2717 Invalid category. Valid: " + String.join(", ", VALID_CATEGORIES)).withStyle(ChatFormatting.RED), false);
            return 0;
        }
        config.setCategory(category);
        pushConfigAsync(ctx.getSource(), config, "category", category);
        ctx.getSource().sendSuccess(() -> Component.literal("\u2713 Category set to " + category).withStyle(ChatFormatting.GREEN), false);
        return 1;
    }

    // ── /sydran setsize ─────────────────────────────────────────────
    private static int setSize(CommandContext<CommandSourceStack> ctx, SydranConfig config) throws CommandSyntaxException {
        String input = StringArgumentType.getString(ctx, "size").toLowerCase();
        String[] parts = input.split("x");
        if (parts.length != 2) {
            ctx.getSource().sendSuccess(() -> Component.literal("\u2717 Use format like 10x6, 2x2, 1x1").withStyle(ChatFormatting.RED), false);
            return 0;
        }
        try {
            int w = Integer.parseInt(parts[0]);
            int h = Integer.parseInt(parts[1]);
            if (w < 1 || h < 1 || w > 32 || h > 32) {
                ctx.getSource().sendSuccess(() -> Component.literal("\u2717 Size out of range (1\u201332).").withStyle(ChatFormatting.RED), false);
                return 0;
            }
            config.setMapSize(w, h);
            pushConfigAsync(ctx.getSource(), config, "size", w + "x" + h);
            ctx.getSource().sendSuccess(() -> Component.literal("\u2713 Map size set to " + w + "x" + h + " (" + (w * h) + " tiles)").withStyle(ChatFormatting.GREEN), false);
        } catch (NumberFormatException e) {
            ctx.getSource().sendSuccess(() -> Component.literal("\u2717 Invalid size: " + input).withStyle(ChatFormatting.RED), false);
        }
        return 1;
    }

    // ── /sydran setduplicate ────────────────────────────────────────
    private static int setDuplicate(CommandContext<CommandSourceStack> ctx, SydranConfig config) throws CommandSyntaxException {
        String input = StringArgumentType.getString(ctx, "state").toLowerCase();
        boolean on;
        if (input.equals("on") || input.equals("true") || input.equals("1")) on = true;
        else if (input.equals("off") || input.equals("false") || input.equals("0")) on = false;
        else {
            ctx.getSource().sendSuccess(() -> Component.literal("\u2717 Use 'on' or 'off'.").withStyle(ChatFormatting.RED), false);
            return 0;
        }
        config.setDuplicateCheck(on);
        pushConfigAsync(ctx.getSource(), config, "duplicateCheck", on);
        ctx.getSource().sendSuccess(() -> Component.literal("\u2713 Duplicate detection " + (on ? "ON" : "OFF")).withStyle(ChatFormatting.GREEN), false);
        return 1;
    }

    // ── /sydran add ─────────────────────────────────────────────────
    private static int add(CommandContext<CommandSourceStack> ctx, SydranConfig config) throws CommandSyntaxException {
        String name;
        try { name = StringArgumentType.getString(ctx, "name"); }
        catch (IllegalArgumentException e) { name = "Untitled Map"; }
        final String productName = name;
        final CommandSourceStack source = ctx.getSource();
        source.sendSuccess(() -> Component.literal("Collecting " + config.getTotalTiles() + " tiles...").withStyle(ChatFormatting.YELLOW), false);
        CompletableFuture.runAsync(() -> {
            try {
                new MapUploader(config).upload(productName, source);
            } catch (Exception e) {
                source.sendSuccess(() -> Component.literal("\u2717 Upload failed: " + e.getMessage()).withStyle(ChatFormatting.RED), false);
            }
        });
        return 1;
    }

    // ── /sydran config ──────────────────────────────────────────────
    private static int showConfig(CommandContext<CommandSourceStack> ctx, SydranConfig config) {
        ctx.getSource().sendSuccess(() -> Component.literal("Sydran Maps config:").withStyle(ChatFormatting.GOLD), false);
        ctx.getSource().sendSuccess(() -> Component.literal("  API: " + config.getApiUrl()).withStyle(ChatFormatting.GRAY), false);
        ctx.getSource().sendSuccess(() -> Component.literal("  PIN: " + (config.getAdminPin().isEmpty() ? "(not set)" : "********")).withStyle(ChatFormatting.GRAY), false);
        return 1;
    }

    private static int setApiUrl(CommandContext<CommandSourceStack> ctx, SydranConfig config) throws CommandSyntaxException {
        String url = StringArgumentType.getString(ctx, "url").replaceAll("/+$", "");
        config.setApiUrl(url);
        ctx.getSource().sendSuccess(() -> Component.literal("\u2713 API URL set to " + url).withStyle(ChatFormatting.GREEN), false);
        return 1;
    }

    private static int setPin(CommandContext<CommandSourceStack> ctx, SydranConfig config) throws CommandSyntaxException {
        config.setAdminPin(StringArgumentType.getString(ctx, "pin"));
        ctx.getSource().sendSuccess(() -> Component.literal("\u2713 Admin PIN set").withStyle(ChatFormatting.GREEN), false);
        return 1;
    }

    // ── /sydran openorders ──────────────────────────────────────────
    private static int listOrders(CommandContext<CommandSourceStack> ctx, SydranConfig config) {
        final CommandSourceStack source = ctx.getSource();
        source.sendSuccess(() -> Component.literal("Fetching claimable orders...").withStyle(ChatFormatting.YELLOW), false);
        CompletableFuture.runAsync(() -> {
            try {
                SydranApiClient api = new SydranApiClient(config);
                var orders = api.getClaimableOrders().getAsJsonArray("orders");
                if (orders.size() == 0) {
                    source.sendSuccess(() -> Component.literal("No claimable orders.").withStyle(ChatFormatting.GRAY), false);
                    return;
                }
                source.sendSuccess(() -> Component.literal("Claimable orders (" + orders.size() + ")").withStyle(ChatFormatting.GOLD), false);
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
                        ).withHoverEvent(
                            new HoverEvent(HoverEvent.Action.SHOW_TEXT,
                                Component.literal("Run /order " + player + " in-game"))
                        ));

                    // [Claim Order] → runs /sydran claim <code> <username>
                    String claimerName = source.getTextName();
                    Component claimButton = Component.literal("[Claim Order]")
                        .withStyle(ChatFormatting.GREEN, ChatFormatting.UNDERLINE)
                        .withStyle(s -> s.withClickEvent(
                            new ClickEvent(ClickEvent.Action.RUN_COMMAND,
                                "/sydran claim " + code + " " + claimerName)
                        ).withHoverEvent(
                            new HoverEvent(HoverEvent.Action.SHOW_TEXT,
                                Component.literal("Claim " + code + " as " + claimerName))
                        ));

                    // Order header line
                    source.sendSuccess(() -> Component.literal("")
                        .append(Component.literal("\uD83D\uDCB0 ").withStyle(ChatFormatting.GOLD))
                        .append(Component.literal(code).withStyle(ChatFormatting.WHITE))
                        .append(Component.literal(" \u00B7 ").withStyle(ChatFormatting.DARK_GRAY))
                        .append(Component.literal(player).withStyle(ChatFormatting.AQUA))
                        .append(Component.literal(" \u00B7 ").withStyle(ChatFormatting.DARK_GRAY))
                        .append(Component.literal(formatPrice(amount)).withStyle(ChatFormatting.GREEN))
                        .append(Component.literal(" \u00B7 ").withStyle(ChatFormatting.DARK_GRAY))
                        .append(Component.literal(maps + " maps").withStyle(ChatFormatting.LIGHT_PURPLE)), false);

                    // Buttons line
                    source.sendSuccess(() -> Component.literal("  ")
                        .append(openButton)
                        .append(Component.literal("  "))
                        .append(claimButton), false);
                }
            } catch (Exception e) {
                source.sendSuccess(() -> Component.literal("\u2717 Failed: " + e.getMessage()).withStyle(ChatFormatting.RED), false);
            }
        });
        return 1;
    }

    // ── /sydran claim ───────────────────────────────────────────────
    private static int claimOrder(CommandContext<CommandSourceStack> ctx, SydranConfig config) throws CommandSyntaxException {
        String code = StringArgumentType.getString(ctx, "code").toUpperCase();
        String username = StringArgumentType.getString(ctx, "username");
        final CommandSourceStack source = ctx.getSource();
        source.sendSuccess(() -> Component.literal("Claiming " + code + "...").withStyle(ChatFormatting.YELLOW), false);
        CompletableFuture.runAsync(() -> {
            try {
                SydranApiClient api = new SydranApiClient(config);
                var result = api.claimOrder(code, username);
                source.sendSuccess(() -> Component.literal("\u2713 Order " + code + " claimed by " + username + "!").withStyle(ChatFormatting.GREEN), false);
                source.sendSuccess(() -> Component.literal("  Highlighting required maps...").withStyle(ChatFormatting.YELLOW), false);
                HighlightStore.requestHighlight(code);
            } catch (SydranApiClient.ApiException e) {
                if (e.getStatusCode() == 409) {
                    source.sendSuccess(() -> Component.literal("\u2717 Order " + code + " is not in 'paid' status (already claimed?)").withStyle(ChatFormatting.RED), false);
                } else {
                    source.sendSuccess(() -> Component.literal("\u2717 Claim failed: " + e.getMessage()).withStyle(ChatFormatting.RED), false);
                }
            } catch (Exception e) {
                source.sendSuccess(() -> Component.literal("\u2717 Claim failed: " + e.getMessage()).withStyle(ChatFormatting.RED), false);
            }
        });
        return 1;
    }

    // ── /sydran deliver ────────────────────────────────────────────
    private static int deliverOrder(CommandContext<CommandSourceStack> ctx, SydranConfig config) throws CommandSyntaxException {
        String code = StringArgumentType.getString(ctx, "code").toUpperCase();
        String username = StringArgumentType.getString(ctx, "username");
        final CommandSourceStack source = ctx.getSource();
        source.sendSuccess(() -> Component.literal("Marking " + code + " as delivered...").withStyle(ChatFormatting.YELLOW), false);
        CompletableFuture.runAsync(() -> {
            try {
                SydranApiClient api = new SydranApiClient(config);
                api.markDelivered(code, username);
                int cleared = HighlightStore.countForOrder(code);
                HighlightStore.clearForOrder(code);
                String msg = "\u2713 Order " + code + " delivered!" + (cleared > 0 ? " Cleared " + cleared + " highlights." : "");
                source.sendSuccess(() -> Component.literal(msg).withStyle(ChatFormatting.GREEN), false);
            } catch (SydranApiClient.ApiException e) {
                if (e.getStatusCode() == 409) {
                    source.sendSuccess(() -> Component.literal("\u2717 Order " + code + " is not in 'claimed' status").withStyle(ChatFormatting.RED), false);
                } else {
                    source.sendSuccess(() -> Component.literal("\u2717 Deliver failed: " + e.getMessage()).withStyle(ChatFormatting.RED), false);
                }
            } catch (Exception e) {
                source.sendSuccess(() -> Component.literal("\u2717 Deliver failed: " + e.getMessage()).withStyle(ChatFormatting.RED), false);
            }
        });
        return 1;
    }

    // ── /sydran clearhighlights ─────────────────────────────────────
    private static int clearHighlights(CommandContext<CommandSourceStack> ctx) {
        HighlightStore.clearAll();
        ctx.getSource().sendSuccess(() -> Component.literal("\u2713 All highlights cleared.").withStyle(ChatFormatting.GREEN), false);
        return 1;
    }

    // ── /sydran rescan ─────────────────────────────────────────────
    private static int rescanOrder(CommandContext<CommandSourceStack> ctx) throws CommandSyntaxException {
        String code = StringArgumentType.getString(ctx, "code").toUpperCase();
        HighlightStore.clearForOrder(code);
        HighlightStore.requestHighlight(code);
        ctx.getSource().sendSuccess(() -> Component.literal("Re-scanning for " + code + "...").withStyle(ChatFormatting.YELLOW), false);
        return 1;
    }

    // ── Helpers ─────────────────────────────────────────────────────
    private static void pushConfigAsync(CommandSourceStack source, SydranConfig config, String key, Object value) {
        CompletableFuture.runAsync(() -> {
            try {
                new SydranApiClient(config).updateConfig(Map.of(key, value));
            } catch (Exception e) {
                source.sendSuccess(() -> Component.literal("\u26A0 Could not sync to server").withStyle(ChatFormatting.YELLOW), false);
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
