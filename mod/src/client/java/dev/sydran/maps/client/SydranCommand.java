package dev.sydran.maps.client;

import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.StringArgumentType;
import com.mojang.brigadier.context.CommandContext;
import com.mojang.brigadier.exceptions.CommandSyntaxException;
import com.mojang.brigadier.suggestion.Suggestions;
import com.mojang.brigadier.suggestion.SuggestionsBuilder;
import dev.sydran.maps.SydranApiClient;
import dev.sydran.maps.SydranConfig;
import dev.sydran.maps.MapHasher;
import dev.sydran.maps.highlight.HighlightStore;
import net.fabricmc.fabric.api.client.command.v2.FabricClientCommandSource;
import net.minecraft.network.chat.ClickEvent;
import net.minecraft.network.chat.Component;
import net.minecraft.ChatFormatting;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static net.fabricmc.fabric.api.client.command.v2.ClientCommands.argument;
import static net.fabricmc.fabric.api.client.command.v2.ClientCommands.literal;

/**
 * Simplified command structure — everything under /sydran:
 *
 *   /sydran add <name> <price> <category>
 *   /sydran multi <name> <price> <category>
 *   /sydran tile <position>
 *   /sydran done
 *   /sydran cancel
 *   /sydran status
 *
 * No quotes needed for names — the parser treats the last two tokens
 * as price + category, everything before = name.
 */
public class SydranCommand {

    private static final List<String> VALID_CATEGORIES = List.of(
        "anime", "castle", "nature", "abstract", "logo", "portrait", "games"
    );

    private static final List<String> PRICE_SUGGESTIONS = List.of(
        "50k", "100k", "150k", "200k", "500k", "1m", "1.5m", "2m"
    );

    // ── Multi-map session state ─────────────────────────────────────
    private static String multiName;
    private static int multiPrice;
    private static String multiCategory;
    private static int multiMaxX = 0;
    private static int multiMaxY = 0;
    private static List<byte[]> multiTileData = new ArrayList<>();
    private static List<int[]> multiTilePositions = new ArrayList<>();
    private static boolean inMultiSession = false;

    public static void registerCommands(CommandDispatcher<FabricClientCommandSource> dispatcher, SydranConfig config) {
        dispatcher.register(literal("sydran")
            // ── /sydran status ──────────────────────────────────────
            .then(literal("status").executes(ctx -> status(ctx, config)))
            // ── /sydran add <name> <price> <category> ──────────────
            // Greedy string for the full input; parser splits last 2 tokens as price + category
            .then(literal("add")
                .then(argument("input", StringArgumentType.greedyString())
                    .executes(ctx -> addSimple(ctx, config))))
            // ── /sydran multi <name> <price> <category> ────────────
            .then(literal("multi")
                .then(argument("input", StringArgumentType.greedyString())
                    .executes(ctx -> startMultiSimple(ctx, config))))
            // ── /sydran tile <position> ────────────────────────────
            .then(literal("tile")
                .then(argument("position", StringArgumentType.word())
                    .suggests((ctx, builder) -> suggestTilePositions(builder))
                    .executes(ctx -> addTile(ctx))))
            // ── /sydran done ───────────────────────────────────────
            .then(literal("done").executes(ctx -> finishMulti(ctx, config)))
            // ── /sydran cancel ──────────────────────────────────────
            .then(literal("cancel").executes(ctx -> cancelMulti(ctx)))
            // ── /sydran openorders ─────────────────────────────────
            .then(literal("openorders").executes(ctx -> listOrders(ctx, config)))
            // ── /sydran claim <code> <username> ────────────────────
            .then(literal("claim")
                .then(argument("code", StringArgumentType.word())
                    .then(argument("username", StringArgumentType.word())
                        .executes(ctx -> claimOrder(ctx, config)))))
            // ── /sydran deliver <code> <username> ──────────────────
            .then(literal("deliver")
                .then(argument("code", StringArgumentType.word())
                    .then(argument("username", StringArgumentType.word())
                        .executes(ctx -> deliverOrder(ctx, config)))))
            // ── /sydran clearhighlights ────────────────────────────
            .then(literal("clearhighlights").executes(ctx -> clearHighlights(ctx)))
            // ── /sydran rescan <code> ──────────────────────────────
            .then(literal("rescan")
                .then(argument("code", StringArgumentType.word())
                    .executes(ctx -> rescanOrder(ctx))))
            // ── /sydran config ─────────────────────────────────────
            .then(literal("config")
                .executes(ctx -> showConfig(ctx, config))
                .then(literal("url")
                    .then(argument("url", StringArgumentType.greedyString())
                        .executes(ctx -> setApiUrl(ctx, config))))
                .then(literal("pin")
                    .then(argument("pin", StringArgumentType.word())
                        .executes(ctx -> setPin(ctx, config)))))
        );
    }

    // ═════════════════════════════════════════════════════════════════
    //  INPUT PARSER
    //  Splits "Anime Girl 50k anime" → {name:"Anime Girl", price:"50k", category:"anime"}
    //  Last token = category, second-to-last = price, everything else = name
    // ═════════════════════════════════════════════════════════════════

    private static class ParsedInput {
        final String name;
        final String priceStr;
        final String category;
        final String error;

        ParsedInput(String name, String priceStr, String category, String error) {
            this.name = name;
            this.priceStr = priceStr;
            this.category = category;
            this.error = error;
        }
    }

    private static ParsedInput parseNamePriceCategory(String input) {
        if (input == null || input.trim().isEmpty()) {
            return new ParsedInput(null, null, null, "Missing name, price, and category. Usage: /sydran add <name> <price> <category>");
        }

        String trimmed = input.trim();
        String[] tokens = trimmed.split("\\s+");

        if (tokens.length < 3) {
            return new ParsedInput(null, null, null,
                "Need at least 3 words: name price category. Example: /sydran add Anime Girl 50k anime");
        }

        // Last token = category
        String category = tokens[tokens.length - 1].toLowerCase();
        // Second-to-last = price
        String priceStr = tokens[tokens.length - 2];
        // Everything before = name (joined with spaces)
        StringBuilder nameBuilder = new StringBuilder();
        for (int i = 0; i < tokens.length - 2; i++) {
            if (i > 0) nameBuilder.append(" ");
            nameBuilder.append(tokens[i]);
        }
        String name = nameBuilder.toString().trim();

        // Validate
        if (!VALID_CATEGORIES.contains(category)) {
            return new ParsedInput(null, null, null,
                "Invalid category: " + category + ". Valid: " + String.join(", ", VALID_CATEGORIES));
        }

        int price = parsePrice(priceStr);
        if (price < 0) {
            return new ParsedInput(null, null, null,
                "Invalid price: " + priceStr + ". Examples: 50k, 100k, 1m, 1.5m, 2m");
        }

        return new ParsedInput(name, priceStr, category, null);
    }

    // ═════════════════════════════════════════════════════════════════
    //  /sydran add <name> <price> <category>
    //  Single-map upload — greedy string, no quotes needed
    // ═════════════════════════════════════════════════════════════════

    private static int addSimple(CommandContext<FabricClientCommandSource> ctx, SydranConfig config) throws CommandSyntaxException {
        String input = StringArgumentType.getString(ctx, "input");
        ParsedInput parsed = parseNamePriceCategory(input);

        if (parsed.error != null) {
            ctx.getSource().sendError(Component.literal("\u2717 " + parsed.error).withStyle(ChatFormatting.RED));
            return 0;
        }

        int price = parsePrice(parsed.priceStr);
        config.setPrice(price);
        config.setCategory(parsed.category);
        config.setMapSize(1, 1);

        final String productName = parsed.name;
        final FabricClientCommandSource source = ctx.getSource();
        source.sendFeedback(Component.literal("Uploading: " + productName + " | " + formatPrice(price) + " | " + parsed.category)
            .withStyle(ChatFormatting.YELLOW));

        CompletableFuture.runAsync(() -> {
            try {
                new MapUploader(config).upload(productName, source);
            } catch (Exception e) {
                source.sendError(Component.literal("\u2717 Upload failed: " + e.getMessage()).withStyle(ChatFormatting.RED));
            }
        });
        return 1;
    }

    // ═════════════════════════════════════════════════════════════════
    //  /sydran multi <name> <price> <category>
    //  Starts a multi-map session
    // ═════════════════════════════════════════════════════════════════

    private static int startMultiSimple(CommandContext<FabricClientCommandSource> ctx, SydranConfig config) throws CommandSyntaxException {
        if (inMultiSession) {
            ctx.getSource().sendError(Component.literal("\u2717 Already in a multi-map session! Run /sydran done or /sydran cancel first.")
                .withStyle(ChatFormatting.RED));
            return 0;
        }

        String input = StringArgumentType.getString(ctx, "input");
        ParsedInput parsed = parseNamePriceCategory(input);

        if (parsed.error != null) {
            ctx.getSource().sendError(Component.literal("\u2717 " + parsed.error).withStyle(ChatFormatting.RED));
            return 0;
        }

        int price = parsePrice(parsed.priceStr);

        // Start session
        multiName = parsed.name;
        multiPrice = price;
        multiCategory = parsed.category;
        multiTileData.clear();
        multiTilePositions.clear();
        multiMaxX = 0;
        multiMaxY = 0;
        inMultiSession = true;

        ctx.getSource().sendFeedback(Component.literal("=== Multi-map session started ===").withStyle(ChatFormatting.GOLD));
        ctx.getSource().sendFeedback(Component.literal("  Name: " + multiName).withStyle(ChatFormatting.WHITE));
        ctx.getSource().sendFeedback(Component.literal("  Price: " + formatPrice(multiPrice)).withStyle(ChatFormatting.GREEN));
        ctx.getSource().sendFeedback(Component.literal("  Category: " + multiCategory).withStyle(ChatFormatting.AQUA));
        ctx.getSource().sendFeedback(Component.literal("  Tiles collected: 0").withStyle(ChatFormatting.GRAY));
        ctx.getSource().sendFeedback(Component.literal("")
            .append(Component.literal("  Hold a map, then: ").withStyle(ChatFormatting.GRAY))
            .append(Component.literal("/sydran tile 1-1").withStyle(ChatFormatting.YELLOW)));
        ctx.getSource().sendFeedback(Component.literal("")
            .append(Component.literal("  When done: ").withStyle(ChatFormatting.GRAY))
            .append(Component.literal("/sydran done").withStyle(ChatFormatting.YELLOW)));
        ctx.getSource().sendFeedback(Component.literal("")
            .append(Component.literal("  To cancel: ").withStyle(ChatFormatting.GRAY))
            .append(Component.literal("/sydran cancel").withStyle(ChatFormatting.YELLOW)));
        ctx.getSource().sendFeedback(Component.literal("  Positions are row-column: 1-1 is top-left, 2-3 is row 2 col 3")
            .withStyle(ChatFormatting.DARK_GRAY));
        return 1;
    }

    // ═════════════════════════════════════════════════════════════════
    //  /sydran tile <position>
    //  Reads the map in the player's main hand, assigns to position X-Y
    // ═════════════════════════════════════════════════════════════════

    private static int addTile(CommandContext<FabricClientCommandSource> ctx) throws CommandSyntaxException {
        if (!inMultiSession) {
            ctx.getSource().sendError(Component.literal("\u2717 No active multi-map session! Start one with /sydran multi <name> <price> <category>")
                .withStyle(ChatFormatting.RED));
            return 0;
        }

        String posInput = StringArgumentType.getString(ctx, "position");
        String[] parts = posInput.split("-");
        if (parts.length != 2) {
            ctx.getSource().sendError(Component.literal("\u2717 Invalid position! Use format like 1-1, 1-2, 2-1, 2-2")
                .withStyle(ChatFormatting.RED));
            return 0;
        }
        int tileX, tileY;
        try {
            tileX = Integer.parseInt(parts[0]);
            tileY = Integer.parseInt(parts[1]);
        } catch (NumberFormatException e) {
            ctx.getSource().sendError(Component.literal("\u2717 Invalid position: " + posInput).withStyle(ChatFormatting.RED));
            return 0;
        }
        if (tileX < 1 || tileY < 1 || tileX > 32 || tileY > 32) {
            ctx.getSource().sendError(Component.literal("\u2717 Position out of range (1-32)").withStyle(ChatFormatting.RED));
            return 0;
        }

        // Check for duplicate position
        for (int[] pos : multiTilePositions) {
            if (pos[0] == tileX && pos[1] == tileY) {
                ctx.getSource().sendError(Component.literal("\u2717 Position " + tileX + "-" + tileY + " already has a map!")
                    .withStyle(ChatFormatting.RED));
                return 0;
            }
        }

        // Read the map from the player's main hand
        byte[] colors = MapDataReader.readMainHandMap();
        if (colors == null) {
            ctx.getSource().sendError(Component.literal("\u2717 No filled map in your main hand! Hold the map you want to add.")
                .withStyle(ChatFormatting.RED));
            return 0;
        }

        multiTileData.add(colors);
        multiTilePositions.add(new int[]{tileX, tileY});
        if (tileX > multiMaxX) multiMaxX = tileX;
        if (tileY > multiMaxY) multiMaxY = tileY;

        int count = multiTileData.size();
        ctx.getSource().sendFeedback(Component.literal("\u2713 Tile " + tileX + "-" + tileY + " added (" + count + " total)")
            .withStyle(ChatFormatting.GREEN));
        ctx.getSource().sendFeedback(Component.literal("  Grid: " + multiMaxX + "x" + multiMaxY + " = " + (multiMaxX * multiMaxY) + " expected, " + count + " collected")
            .withStyle(ChatFormatting.GRAY));
        if (count < multiMaxX * multiMaxY) {
            ctx.getSource().sendFeedback(Component.literal("  Still need " + (multiMaxX * multiMaxY - count) + " more tiles")
                .withStyle(ChatFormatting.YELLOW));
        } else {
            ctx.getSource().sendFeedback(Component.literal("  All tiles collected! Run /sydran done")
                .withStyle(ChatFormatting.GREEN));
        }
        return 1;
    }

    // ═════════════════════════════════════════════════════════════════
    //  /sydran done
    //  Finalizes and uploads all collected tiles
    // ═════════════════════════════════════════════════════════════════

    private static int finishMulti(CommandContext<FabricClientCommandSource> ctx, SydranConfig config) throws CommandSyntaxException {
        if (!inMultiSession) {
            ctx.getSource().sendError(Component.literal("\u2717 No active multi-map session!").withStyle(ChatFormatting.RED));
            return 0;
        }

        int total = multiTileData.size();
        int expected = multiMaxX * multiMaxY;

        if (total == 0) {
            ctx.getSource().sendError(Component.literal("\u2717 No tiles added! Add tiles with /sydran tile 1-1 first.").withStyle(ChatFormatting.RED));
            return 0;
        }
        if (total < expected) {
            ctx.getSource().sendError(Component.literal("\u2717 Missing " + (expected - total) + " tiles! Expected " + expected + " (" + multiMaxX + "x" + multiMaxY + "), got " + total)
                .withStyle(ChatFormatting.RED));
            return 0;
        }

        final FabricClientCommandSource source = ctx.getSource();
        final String productName = multiName;
        final int width = multiMaxX;
        final int height = multiMaxY;
        final int price = multiPrice;
        final String category = multiCategory;

        source.sendFeedback(Component.literal("Uploading " + total + " tiles (" + width + "x" + height + ")...")
            .withStyle(ChatFormatting.YELLOW));

        CompletableFuture.runAsync(() -> {
            try {
                List<Map<String, Object>> tilePayload = new ArrayList<>();
                for (int i = 0; i < multiTileData.size(); i++) {
                    int posX = multiTilePositions.get(i)[0] - 1;
                    int posY = multiTilePositions.get(i)[1] - 1;
                    byte[] colors = multiTileData.get(i);
                    String hash = MapHasher.tileHash(colors, posX, posY, productName);
                    String colorData = java.util.Base64.getEncoder().encodeToString(colors);
                    Map<String, Object> tile = new HashMap<>();
                    tile.put("posX", posX);
                    tile.put("posY", posY);
                    tile.put("tileHash", hash);
                    tile.put("colorData", colorData);
                    tilePayload.add(tile);
                }

                SydranApiClient api = new SydranApiClient(config);

                // Duplicate check
                if (config.isDuplicateCheck()) {
                    source.sendFeedback(Component.literal("Checking for duplicates...").withStyle(ChatFormatting.YELLOW));
                    var dupResult = api.duplicateCheck(productName, category, width, height);
                    if (dupResult.get("isDuplicate").getAsBoolean()) {
                        var existing = dupResult.getAsJsonObject("existingProduct");
                        source.sendError(Component.literal("\u2717 Duplicate! Already exists: " + existing.get("name").getAsString())
                            .withStyle(ChatFormatting.RED));
                        inMultiSession = false;
                        return;
                    }
                }

                // Upload
                Map<String, Object> body = new HashMap<>();
                body.put("productName", productName);
                body.put("price", price);
                body.put("category", category);
                body.put("width", width);
                body.put("height", height);
                body.put("tiles", tilePayload);

                var result = api.addProduct(body);
                String productCode = result.getAsJsonObject("product").get("code").getAsString();
                source.sendFeedback(Component.literal("\u2713 Upload complete! Product " + productCode + " (" + width + "x" + height + ", " + total + " tiles) appears in store.")
                    .withStyle(ChatFormatting.GREEN));

                inMultiSession = false;
                multiTileData.clear();
                multiTilePositions.clear();
            } catch (Exception e) {
                source.sendError(Component.literal("\u2717 Upload failed: " + e.getMessage()).withStyle(ChatFormatting.RED));
            }
        });
        return 1;
    }

    // ═════════════════════════════════════════════════════════════════
    //  /sydran cancel
    // ═════════════════════════════════════════════════════════════════

    private static int cancelMulti(CommandContext<FabricClientCommandSource> ctx) throws CommandSyntaxException {
        if (!inMultiSession) {
            ctx.getSource().sendError(Component.literal("\u2717 No active multi-map session!").withStyle(ChatFormatting.RED));
            return 0;
        }
        inMultiSession = false;
        multiName = null;
        multiTileData.clear();
        multiTilePositions.clear();
        ctx.getSource().sendFeedback(Component.literal("\u2713 Multi-map session cancelled.").withStyle(ChatFormatting.YELLOW));
        return 1;
    }

    // ═════════════════════════════════════════════════════════════════
    //  AUTOCOMPLETE HELPERS
    // ═════════════════════════════════════════════════════════════════

    private static CompletableFuture<Suggestions> suggestTilePositions(SuggestionsBuilder builder) {
        if (!inMultiSession) {
            // No session — suggest 1-1 as a starting point
            builder.suggest("1-1");
            return builder.buildFuture();
        }

        if (multiMaxX == 0 || multiMaxY == 0) {
            // First tile
            builder.suggest("1-1");
            return builder.buildFuture();
        }

        // Suggest unfilled positions, prioritizing the next expected one
        // (row-by-row, left-to-right)
        for (int y = 1; y <= multiMaxY; y++) {
            for (int x = 1; x <= multiMaxX; x++) {
                boolean filled = false;
                for (int[] pos : multiTilePositions) {
                    if (pos[0] == x && pos[1] == y) {
                        filled = true;
                        break;
                    }
                }
                if (!filled) {
                    builder.suggest(x + "-" + y);
                }
            }
        }
        return builder.buildFuture();
    }

    // ═════════════════════════════════════════════════════════════════
    //  EXISTING COMMANDS (status, orders, claim, deliver, etc.)
    // ═════════════════════════════════════════════════════════════════

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

                    Component openButton = Component.literal("[Open Order]").withStyle(ChatFormatting.BLUE, ChatFormatting.UNDERLINE)
                        .withStyle(s -> s.withClickEvent(new ClickEvent.RunCommand("/order " + player)));
                    String claimerName = source.getPlayer().getName().getString();
                    Component claimButton = Component.literal("[Claim Order]").withStyle(ChatFormatting.GREEN, ChatFormatting.UNDERLINE)
                        .withStyle(s -> s.withClickEvent(new ClickEvent.RunCommand("/sydran claim " + code + " " + claimerName)));

                    source.sendFeedback(Component.literal("")
                        .append(Component.literal("\uD83D\uDCB0 ").withStyle(ChatFormatting.GOLD))
                        .append(Component.literal(code).withStyle(ChatFormatting.WHITE))
                        .append(Component.literal(" \u00B7 ").withStyle(ChatFormatting.DARK_GRAY))
                        .append(Component.literal(player).withStyle(ChatFormatting.AQUA))
                        .append(Component.literal(" \u00B7 ").withStyle(ChatFormatting.DARK_GRAY))
                        .append(Component.literal(formatPrice(amount)).withStyle(ChatFormatting.GREEN))
                        .append(Component.literal(" \u00B7 ").withStyle(ChatFormatting.DARK_GRAY))
                        .append(Component.literal(maps + " maps").withStyle(ChatFormatting.LIGHT_PURPLE)));
                    source.sendFeedback(Component.literal("  ").append(openButton).append(Component.literal("  ")).append(claimButton));
                }
            } catch (Exception e) {
                source.sendError(Component.literal("\u2717 Failed: " + e.getMessage()).withStyle(ChatFormatting.RED));
            }
        });
        return 1;
    }

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

    private static int clearHighlights(CommandContext<FabricClientCommandSource> ctx) {
        HighlightStore.clearAll();
        ctx.getSource().sendFeedback(Component.literal("\u2713 All highlights cleared.").withStyle(ChatFormatting.GREEN));
        return 1;
    }

    private static int rescanOrder(CommandContext<FabricClientCommandSource> ctx) throws CommandSyntaxException {
        String code = StringArgumentType.getString(ctx, "code").toUpperCase();
        HighlightStore.clearForOrder(code);
        HighlightStore.requestHighlight(code);
        ctx.getSource().sendFeedback(Component.literal("Re-scanning for " + code + "...").withStyle(ChatFormatting.YELLOW));
        return 1;
    }

    // ── Helpers ─────────────────────────────────────────────────────
    public static int parsePrice(String input) {
        String s = input.trim().toLowerCase().replaceAll("[$,]", "");
        if (s.isEmpty()) return -1;
        try {
            if (s.endsWith("k")) return (int)(Double.parseDouble(s.substring(0, s.length()-1)) * 1_000);
            if (s.endsWith("m")) return (int)(Double.parseDouble(s.substring(0, s.length()-1)) * 1_000_000);
            if (s.endsWith("b")) return (int)(Double.parseDouble(s.substring(0, s.length()-1)) * 1_000_000_000);
            return Integer.parseInt(s);
        } catch (NumberFormatException e) { return -1; }
    }

    public static String formatPrice(int coins) {
        if (coins >= 1_000_000_000) {
            double b = coins / 1_000_000_000.0;
            return "$" + (b == (int)b ? String.format("%.0f", b) : String.format("%.1f", b).replaceAll("\\.0$", "")) + "B";
        }
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
