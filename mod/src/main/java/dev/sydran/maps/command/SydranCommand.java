package dev.sydran.maps.command;

import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.StringArgumentType;
import com.mojang.brigadier.context.CommandContext;
import com.mojang.brigadier.exceptions.CommandSyntaxException;
import net.minecraft.server.command.ServerCommandSource;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import static net.minecraft.server.command.CommandManager.argument;
import static net.minecraft.server.command.CommandManager.literal;
import dev.sydran.maps.SydranApiClient;
import dev.sydran.maps.SydranConfig;
import dev.sydran.maps.SydranMapsMod;
import dev.sydran.maps.client.MapUploader;

public class SydranCommand {
    private static final List<String> VALID_CATEGORIES = List.of("anime", "castle", "nature", "abstract", "logo", "portrait");

    public static void register(CommandDispatcher<ServerCommandSource> dispatcher, SydranConfig config) {
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

    private static int status(CommandContext<ServerCommandSource> ctx, SydranConfig config) {
        final ServerCommandSource source = ctx.getSource();
        CompletableFuture.runAsync(() -> {
            try {
                SydranApiClient api = new SydranApiClient(config);
                var json = api.getStatus();
                String text = json.get("text").getAsString();
                for (String line : text.split("\n")) {
                    source.sendFeedback(() -> Text.literal(line).formatted(Formatting.GRAY));
                }
            } catch (Exception e) {
                source.sendFeedback(() -> Text.literal("✗ Failed: " + e.getMessage()).formatted(Formatting.RED));
            }
        });
        source.sendFeedback(() -> Text.literal("Fetching Sydran Maps status...").formatted(Formatting.YELLOW));
        return 1;
    }

    private static int setPrice(CommandContext<ServerCommandSource> ctx, SydranConfig config) throws CommandSyntaxException {
        String input = StringArgumentType.getString(ctx, "amount");
        int price = parsePrice(input);
        if (price < 0) { ctx.getSource().sendFeedback(() -> Text.literal("✗ Invalid price: " + input).formatted(Formatting.RED)); return 0; }
        config.setPrice(price);
        pushConfigAsync(ctx.getSource(), config, "price", price);
        ctx.getSource().sendFeedback(() -> Text.literal("✓ Price set to " + formatPrice(price)).formatted(Formatting.GREEN));
        return 1;
    }

    private static int setCategory(CommandContext<ServerCommandSource> ctx, SydranConfig config) throws CommandSyntaxException {
        String category = StringArgumentType.getString(ctx, "category").toLowerCase();
        if (!VALID_CATEGORIES.contains(category)) { ctx.getSource().sendFeedback(() -> Text.literal("✗ Invalid category. Valid: " + String.join(", ", VALID_CATEGORIES)).formatted(Formatting.RED)); return 0; }
        config.setCategory(category);
        pushConfigAsync(ctx.getSource(), config, "category", category);
        ctx.getSource().sendFeedback(() -> Text.literal("✓ Category set to " + category).formatted(Formatting.GREEN));
        return 1;
    }

    private static int setSize(CommandContext<ServerCommandSource> ctx, SydranConfig config) throws CommandSyntaxException {
        String input = StringArgumentType.getString(ctx, "size").toLowerCase();
        String[] parts = input.split("x");
        if (parts.length != 2) { ctx.getSource().sendFeedback(() -> Text.literal("✗ Use format like 10x6, 2x2, 1x1").formatted(Formatting.RED)); return 0; }
        try {
            int w = Integer.parseInt(parts[0]); int h = Integer.parseInt(parts[1]);
            if (w < 1 || h < 1 || w > 32 || h > 32) { ctx.getSource().sendFeedback(() -> Text.literal("✗ Size out of range (1–32).").formatted(Formatting.RED)); return 0; }
            config.setMapSize(w, h);
            pushConfigAsync(ctx.getSource(), config, "size", w + "x" + h);
            ctx.getSource().sendFeedback(() -> Text.literal("✓ Map size set to " + w + "x" + h + " (" + (w * h) + " tiles)").formatted(Formatting.GREEN));
        } catch (NumberFormatException e) { ctx.getSource().sendFeedback(() -> Text.literal("✗ Invalid size: " + input).formatted(Formatting.RED)); }
        return 1;
    }

    private static int setDuplicate(CommandContext<ServerCommandSource> ctx, SydranConfig config) throws CommandSyntaxException {
        String input = StringArgumentType.getString(ctx, "state").toLowerCase();
        boolean on;
        if (input.equals("on") || input.equals("true") || input.equals("1")) on = true;
        else if (input.equals("off") || input.equals("false") || input.equals("0")) on = false;
        else { ctx.getSource().sendFeedback(() -> Text.literal("✗ Use 'on' or 'off'.").formatted(Formatting.RED)); return 0; }
        config.setDuplicateCheck(on);
        pushConfigAsync(ctx.getSource(), config, "duplicateCheck", on);
        ctx.getSource().sendFeedback(() -> Text.literal("✓ Duplicate detection " + (on ? "ON" : "OFF")).formatted(Formatting.GREEN));
        return 1;
    }

    private static int add(CommandContext<ServerCommandSource> ctx, SydranConfig config) throws CommandSyntaxException {
        String name;
        try { name = StringArgumentType.getString(ctx, "name"); } catch (IllegalArgumentException e) { name = "Untitled Map"; }
        final String productName = name;
        final ServerCommandSource source = ctx.getSource();
        source.sendFeedback(() -> Text.literal("Collecting " + config.getTotalTiles() + " tiles...").formatted(Formatting.YELLOW));
        CompletableFuture.runAsync(() -> {
            try { new MapUploader(config).upload(productName, source); }
            catch (Exception e) { source.sendFeedback(() -> Text.literal("✗ Upload failed: " + e.getMessage()).formatted(Formatting.RED)); }
        });
        return 1;
    }

    private static int showConfig(CommandContext<ServerCommandSource> ctx, SydranConfig config) {
        ctx.getSource().sendFeedback(() -> Text.literal("Sydran Maps config:").formatted(Formatting.GOLD));
        ctx.getSource().sendFeedback(() -> Text.literal("  API: " + config.getApiUrl()).formatted(Formatting.GRAY));
        ctx.getSource().sendFeedback(() -> Text.literal("  PIN: " + (config.getAdminPin().isEmpty() ? "(not set)" : "********")).formatted(Formatting.GRAY));
        return 1;
    }

    private static int setApiUrl(CommandContext<ServerCommandSource> ctx, SydranConfig config) throws CommandSyntaxException {
        String url = StringArgumentType.getString(ctx, "url").replaceAll("/+$", "");
        config.setApiUrl(url);
        ctx.getSource().sendFeedback(() -> Text.literal("✓ API URL set to " + url).formatted(Formatting.GREEN));
        return 1;
    }

    private static int setPin(CommandContext<ServerCommandSource> ctx, SydranConfig config) throws CommandSyntaxException {
        config.setAdminPin(StringArgumentType.getString(ctx, "pin"));
        ctx.getSource().sendFeedback(() -> Text.literal("✓ Admin PIN set").formatted(Formatting.GREEN));
        return 1;
    }

    private static int listOrders(CommandContext<ServerCommandSource> ctx, SydranConfig config) {
        final ServerCommandSource source = ctx.getSource();
        source.sendFeedback(() -> Text.literal("Fetching claimable orders...").formatted(Formatting.YELLOW));
        CompletableFuture.runAsync(() -> {
            try {
                SydranApiClient api = new SydranApiClient(config);
                var orders = api.getClaimableOrders().getAsJsonArray("orders");
                if (orders.size() == 0) { source.sendFeedback(() -> Text.literal("No claimable orders.").formatted(Formatting.GRAY)); return; }
                source.sendFeedback(() -> Text.literal("Claimable orders (" + orders.size() + ")").formatted(Formatting.GOLD));
                for (int i = 0; i < orders.size(); i++) {
                    var order = orders.get(i).getAsJsonObject();
                    String code = order.get("code").getAsString();
                    String player = order.get("player").getAsString();
                    int amount = order.get("totalAmount").getAsInt();
                    int maps = order.get("totalMaps").getAsInt();
                    Text openButton = Text.literal("[Open Order]").formatted(Formatting.BLUE, Formatting.UNDERLINE)
                        .styled(s -> s.withClickEvent(new net.minecraft.text.ClickEvent(net.minecraft.text.ClickEvent.Action.RUN_COMMAND, "/order " + player)));
                    String claimerName = source.getName();
                    Text claimButton = Text.literal("[Claim Order]").formatted(Formatting.GREEN, Formatting.UNDERLINE)
                        .styled(s -> s.withClickEvent(new net.minecraft.text.ClickEvent(net.minecraft.text.ClickEvent.Action.RUN_COMMAND, "/sydran claim " + code + " " + claimerName)));
                    source.sendFeedback(() -> Text.literal("💰 ").formatted(Formatting.GOLD).append(Text.literal(code + " · " + player + " · " + formatPrice(amount) + " · " + maps + " maps")));
                    source.sendFeedback(() -> Text.literal("  ").append(openButton).append(Text.literal("  ")).append(claimButton));
                }
            } catch (Exception e) { source.sendFeedback(() -> Text.literal("✗ Failed: " + e.getMessage()).formatted(Formatting.RED)); }
        });
        return 1;
    }

    private static int claimOrder(CommandContext<ServerCommandSource> ctx, SydranConfig config) throws CommandSyntaxException {
        String code = StringArgumentType.getString(ctx, "code").toUpperCase();
        String username = StringArgumentType.getString(ctx, "username");
        final ServerCommandSource source = ctx.getSource();
        source.sendFeedback(() -> Text.literal("Claiming " + code + "...").formatted(Formatting.YELLOW));
        CompletableFuture.runAsync(() -> {
            try {
                SydranApiClient api = new SydranApiClient(config);
                var result = api.claimOrder(code, username);
                source.sendFeedback(() -> Text.literal("✓ Order " + code + " claimed by " + username + "!").formatted(Formatting.GREEN));
                source.sendFeedback(() -> Text.literal("  Highlighting required maps...").formatted(Formatting.YELLOW));
                dev.sydran.maps.highlight.HighlightStore.requestHighlight(code);
            } catch (Exception e) { source.sendFeedback(() -> Text.literal("✗ Claim failed: " + e.getMessage()).formatted(Formatting.RED)); }
        });
        return 1;
    }

    private static int deliverOrder(CommandContext<ServerCommandSource> ctx, SydranConfig config) throws CommandSyntaxException {
        String code = StringArgumentType.getString(ctx, "code").toUpperCase();
        String username = StringArgumentType.getString(ctx, "username");
        final ServerCommandSource source = ctx.getSource();
        CompletableFuture.runAsync(() -> {
            try {
                SydranApiClient api = new SydranApiClient(config);
                api.markDelivered(code, username);
                int cleared = dev.sydran.maps.highlight.HighlightStore.countForOrder(code);
                dev.sydran.maps.highlight.HighlightStore.clearForOrder(code);
                source.sendFeedback(() -> Text.literal("✓ Order " + code + " delivered!" + (cleared > 0 ? " Cleared " + cleared + " highlights." : "")).formatted(Formatting.GREEN));
            } catch (Exception e) { source.sendFeedback(() -> Text.literal("✗ Deliver failed: " + e.getMessage()).formatted(Formatting.RED)); }
        });
        return 1;
    }

    private static int clearHighlights(CommandContext<ServerCommandSource> ctx) {
        dev.sydran.maps.highlight.HighlightStore.clearAll();
        ctx.getSource().sendFeedback(() -> Text.literal("✓ All highlights cleared.").formatted(Formatting.GREEN));
        return 1;
    }

    private static int rescanOrder(CommandContext<ServerCommandSource> ctx) throws CommandSyntaxException {
        String code = StringArgumentType.getString(ctx, "code").toUpperCase();
        dev.sydran.maps.highlight.HighlightStore.clearForOrder(code);
        dev.sydran.maps.highlight.HighlightStore.requestHighlight(code);
        ctx.getSource().sendFeedback(() -> Text.literal("Re-scanning for " + code + "...").formatted(Formatting.YELLOW));
        return 1;
    }

    private static void pushConfigAsync(ServerCommandSource source, SydranConfig config, String key, Object value) {
        CompletableFuture.runAsync(() -> {
            try { new SydranApiClient(config).updateConfig(Map.of(key, value)); }
            catch (Exception e) { source.sendFeedback(() -> Text.literal("⚠ Could not sync to server").formatted(Formatting.YELLOW)); }
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
        if (coins >= 1_000_000) { double m = coins / 1_000_000.0; return "$" + (m == (int)m ? String.format("%.0f", m) : String.format("%.1f", m).replaceAll("\\.0$", "")) + "M"; }
        if (coins >= 1_000) { double k = coins / 1_000.0; return "$" + (k == (int)k ? String.format("%.0f", k) : String.format("%.1f", k).replaceAll("\\.0$", "")) + "K"; }
        return "$" + coins;
    }
}
