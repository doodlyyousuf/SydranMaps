package dev.sydran.maps.client;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.sydran.maps.MapHasher;
import dev.sydran.maps.SydranApiClient;
import dev.sydran.maps.SydranConfig;
import dev.sydran.maps.highlight.HighlightStore;
import net.fabricmc.fabric.api.client.command.v2.FabricClientCommandSource;
import net.minecraft.network.chat.ClickEvent;
import net.minecraft.network.chat.Component;
import net.minecraft.ChatFormatting;

import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.StringArgumentType;
import com.mojang.brigadier.context.CommandContext;
import com.mojang.brigadier.exceptions.CommandSyntaxException;

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
 * All /sydran client-side commands.
 *
 * Single-map upload (one command):
 *   /sydran add name:"Anime Girl" price:50k category:anime
 *
 * Multi-map upload (big maps, tile by tile):
 *   /sydran addmulti name:"Anime Castle" price:1.5m category:castle
 *   /sydran multimap tile:1-1
 *   /sydran multimap tile:1-2
 *   /sydran multimap tile:2-1
 *   /sydran multimap tile:2-2
 *   /sydran multimap done
 *
 * The old setprice/setcategory/setsize commands still work for
 * backward compatibility, but are no longer needed for add/addmulti.
 */
public class SydranCommand {

    private static final List<String> VALID_CATEGORIES = List.of(
        "anime", "castle", "nature", "abstract", "logo", "portrait"
    );

    // ── Multi-map session state (client-side, per player) ──────────
    private static String multiName;
    private static int multiPrice;
    private static String multiCategory;
    private static int multiMaxX = 0;
    private static int multiMaxY = 0;
    private static List<byte[]> multiTileData = new ArrayList<>();
    private static List<int[]> multiTilePositions = new ArrayList<>(); // [x, y] 1-indexed
    private static boolean inMultiSession = false;

    public static void registerCommands(CommandDispatcher<FabricClientCommandSource> dispatcher, SydranConfig config) {
        dispatcher.register(literal("sydran")
            .then(literal("status").executes(ctx -> status(ctx, config)))
            .then(literal("setprice").then(argument("amount", StringArgumentType.greedyString()).executes(ctx -> setPrice(ctx, config))))
            .then(literal("setcategory").then(argument("category", StringArgumentType.word()).executes(ctx -> setCategory(ctx, config))))
            .then(literal("setsize").then(argument("size", StringArgumentType.word()).executes(ctx -> setSize(ctx, config))))
            .then(literal("setduplicate").then(argument("state", StringArgumentType.word()).executes(ctx -> setDuplicate(ctx, config))))
            // ── Single-map upload (one command) ───────────────────────
            .then(literal("add").then(argument("params", StringArgumentType.greedyString()).executes(ctx -> addWithParams(ctx, config))))
            // ── Multi-map upload session ──────────────────────────────
            .then(literal("addmulti").then(argument("params", StringArgumentType.greedyString()).executes(ctx -> startMulti(ctx, config))))
            .then(literal("multimap")
                .then(literal("tile").then(argument("pos", StringArgumentType.word()).executes(ctx -> addMultiTile(ctx))))
                .then(literal("done").executes(ctx -> finishMulti(ctx, config)))
                .then(literal("cancel").executes(ctx -> cancelMulti(ctx)))
                .then(literal("status").executes(ctx -> multiStatus(ctx)))
            )
            // ── Config ─────────────────────────────────────────────────
            .then(literal("config")
                .executes(ctx -> showConfig(ctx, config))
                .then(literal("url").then(argument("url", StringArgumentType.greedyString()).executes(ctx -> setApiUrl(ctx, config))))
                .then(literal("pin").then(argument("pin", StringArgumentType.word()).executes(ctx -> setPin(ctx, config)))))
            // ── Order management ──────────────────────────────────────
            .then(literal("openorders").executes(ctx -> listOrders(ctx, config)))
            .then(literal("claim").then(argument("code", StringArgumentType.word()).then(argument("username", StringArgumentType.word()).executes(ctx -> claimOrder(ctx, config)))))
            .then(literal("deliver").then(argument("code", StringArgumentType.word()).then(argument("username", StringArgumentType.word()).executes(ctx -> deliverOrder(ctx, config)))))
            .then(literal("clearhighlights").executes(ctx -> clearHighlights(ctx)))
            .then(literal("rescan").then(argument("code", StringArgumentType.word()).executes(ctx -> rescanOrder(ctx))))
        );
    }

    // ═════════════════════════════════════════════════════════════════
    //  PARAM PARSER — extracts name:/price:/category: from a string
    // ═════════════════════════════════════════════════════════════════

    private static Map<String, String> parseParams(String input) {
        Map<String, String> params = new HashMap<>();
        // Regex: key:"quoted value with spaces" OR key:single_word
        Pattern p = Pattern.compile("(name|price|category):(?:\"([^\"]+)\"|([^\\s]+))");
        Matcher m = p.matcher(input);
        while (m.find()) {
            String key = m.group(1);
            String value = m.group(2) != null ? m.group(2) : m.group(3);
            params.put(key, value);
        }
        return params;
    }

    // ═════════════════════════════════════════════════════════════════
    //  /sydran add name:"Anime Girl" price:50k category:anime
    //  Single-map upload — one command does everything
    // ═════════════════════════════════════════════════════════════════

    private static int addWithParams(CommandContext<FabricClientCommandSource> ctx, SydranConfig config) throws CommandSyntaxException {
        String input = StringArgumentType.getString(ctx, "params");
        Map<String, String> params = parseParams(input);

        String name = params.get("name");
        String priceStr = params.get("price");
        String category = params.getOrDefault("category", config.getCategory());

        if (name == null || name.isEmpty()) {
            ctx.getSource().sendError(Component.literal("\u2717 Missing name! Usage: /sydran add name:\"My Map\" price:50k category:anime")
                .withStyle(ChatFormatting.RED));
            return 0;
        }
        if (priceStr == null || priceStr.isEmpty()) {
            ctx.getSource().sendError(Component.literal("\u2717 Missing price! Usage: /sydran add name:\"My Map\" price:50k category:anime")
                .withStyle(ChatFormatting.RED));
            return 0;
        }

        int price = parsePrice(priceStr);
        if (price < 0) {
            ctx.getSource().sendError(Component.literal("\u2717 Invalid price: " + priceStr)
                .withStyle(ChatFormatting.RED));
            return 0;
        }
        if (!VALID_CATEGORIES.contains(category.toLowerCase())) {
            ctx.getSource().sendError(Component.literal("\u2717 Invalid category: " + category + ". Valid: " + String.join(", ", VALID_CATEGORIES))
                .withStyle(ChatFormatting.RED));
            return 0;
        }

        // Temporarily set config for this upload
        config.setPrice(price);
        config.setCategory(category.toLowerCase());
        config.setMapSize(1, 1);

        final String productName = name;
        final FabricClientCommandSource source = ctx.getSource();
        source.sendFeedback(Component.literal("Uploading: " + productName + " | " + formatPrice(price) + " | " + category)
            .withStyle(ChatFormatting.YELLOW));

        CompletableFuture.runAsync(() -> {
            try {
                new MapUploader(config).upload(productName, source);
            } catch (Exception e) {
                source.sendError(Component.literal("\u2717 Upload failed: " + e.getMessage())
                    .withStyle(ChatFormatting.RED));
            }
        });
        return 1;
    }

    // ═════════════════════════════════════════════════════════════════
    //  /sydran addmulti name:"Anime Castle" price:1.5m category:castle
    //  Starts a multi-map upload session
    // ═════════════════════════════════════════════════════════════════

    private static int startMulti(CommandContext<FabricClientCommandSource> ctx, SydranConfig config) throws CommandSyntaxException {
        if (inMultiSession) {
            ctx.getSource().sendError(Component.literal("\u2717 Already in a multi-map session! Run /sydran multimap done or /sydran multimap cancel first.")
                .withStyle(ChatFormatting.RED));
            return 0;
        }

        String input = StringArgumentType.getString(ctx, "params");
        Map<String, String> params = parseParams(input);

        String name = params.get("name");
        String priceStr = params.get("price");
        String category = params.getOrDefault("category", config.getCategory());

        if (name == null || name.isEmpty()) {
            ctx.getSource().sendError(Component.literal("\u2717 Missing name! Usage: /sydran addmulti name:\"Anime Castle\" price:1.5m category:castle")
                .withStyle(ChatFormatting.RED));
            return 0;
        }
        if (priceStr == null || priceStr.isEmpty()) {
            ctx.getSource().sendError(Component.literal("\u2717 Missing price! Usage: /sydran addmulti name:\"Anime Castle\" price:1.5m category:castle")
                .withStyle(ChatFormatting.RED));
            return 0;
        }

        int price = parsePrice(priceStr);
        if (price < 0) {
            ctx.getSource().sendError(Component.literal("\u2717 Invalid price: " + priceStr)
                .withStyle(ChatFormatting.RED));
            return 0;
        }
        if (!VALID_CATEGORIES.contains(category.toLowerCase())) {
            ctx.getSource().sendError(Component.literal("\u2717 Invalid category: " + category)
                .withStyle(ChatFormatting.RED));
            return 0;
        }

        // Start session
        multiName = name;
        multiPrice = price;
        multiCategory = category.toLowerCase();
        multiTileData.clear();
        multiTilePositions.clear();
        multiMaxX = 0;
        multiMaxY = 0;
        inMultiSession = true;

        ctx.getSource().sendFeedback(Component.literal("=== Multi-map session started ===")
            .withStyle(ChatFormatting.GOLD));
        ctx.getSource().sendFeedback(Component.literal("  Name: " + multiName)
            .withStyle(ChatFormatting.WHITE));
        ctx.getSource().sendFeedback(Component.literal("  Price: " + formatPrice(multiPrice))
            .withStyle(ChatFormatting.GREEN));
        ctx.getSource().sendFeedback(Component.literal("  Category: " + multiCategory)
            .withStyle(ChatFormatting.AQUA));
        ctx.getSource().sendFeedback(Component.literal("  Tiles collected: 0")
            .withStyle(ChatFormatting.GRAY));
        ctx.getSource().sendFeedback(Component.literal("")
            .append(Component.literal("  Add tiles with: ").withStyle(ChatFormatting.GRAY))
            .append(Component.literal("/sydran multimap tile:1-1").withStyle(ChatFormatting.YELLOW)));
        ctx.getSource().sendFeedback(Component.literal("")
            .append(Component.literal("  When done: ").withStyle(ChatFormatting.GRAY))
            .append(Component.literal("/sydran multimap done").withStyle(ChatFormatting.YELLOW)));
        ctx.getSource().sendFeedback(Component.literal("")
            .append(Component.literal("  To cancel: ").withStyle(ChatFormatting.GRAY))
            .append(Component.literal("/sydran multimap cancel").withStyle(ChatFormatting.YELLOW)));
        ctx.getSource().sendFeedback(Component.literal("  Tile positions are 1-indexed: row-column (e.g. 1-1 is top-left, 2-3 is row 2 col 3)")
            .withStyle(ChatFormatting.DARK_GRAY));
        return 1;
    }

    // ═════════════════════════════════════════════════════════════════
    //  /sydran multimap tile:1-1
    //  Reads the map in the player's main hand and assigns it to position X-Y
    // ═════════════════════════════════════════════════════════════════

    private static int addMultiTile(CommandContext<FabricClientCommandSource> ctx) throws CommandSyntaxException {
        if (!inMultiSession) {
            ctx.getSource().sendError(Component.literal("\u2717 No active multi-map session! Start one with /sydran addmulti name:\"...\" price:... category:...")
                .withStyle(ChatFormatting.RED));
            return 0;
        }

        String posInput = StringArgumentType.getString(ctx, "pos");
        // Parse "1-1", "2-3", etc. → x=col, y=row (1-indexed)
        String[] parts = posInput.split("-");
        if (parts.length != 2) {
            ctx.getSource().sendError(Component.literal("\u2717 Invalid tile position! Use format like 1-1, 1-2, 2-1, 2-2")
                .withStyle(ChatFormatting.RED));
            return 0;
        }
        int tileX, tileY;
        try {
            tileX = Integer.parseInt(parts[0]);
            tileY = Integer.parseInt(parts[1]);
        } catch (NumberFormatException e) {
            ctx.getSource().sendError(Component.literal("\u2717 Invalid tile position: " + posInput + ". Use numbers like 1-1, 2-3")
                .withStyle(ChatFormatting.RED));
            return 0;
        }
        if (tileX < 1 || tileY < 1 || tileX > 32 || tileY > 32) {
            ctx.getSource().sendError(Component.literal("\u2717 Tile position out of range (1-32)")
                .withStyle(ChatFormatting.RED));
            return 0;
        }

        // Check for duplicate position
        for (int[] pos : multiTilePositions) {
            if (pos[0] == tileX && pos[1] == tileY) {
                ctx.getSource().sendError(Component.literal("\u2717 Position " + tileX + "-" + tileY + " already has a map! Use /sydran multimap cancel and restart if you need to change it.")
                    .withStyle(ChatFormatting.RED));
                return 0;
            }
        }

        // Read the map from the player's main hand
        byte[] colors = MapDataReader.readMainHandMap();
        if (colors == null) {
            ctx.getSource().sendError(Component.literal("\u2717 No filled map in your main hand! Hold the map you want to add, then run the command.")
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
        ctx.getSource().sendFeedback(Component.literal("  Current grid: " + multiMaxX + "x" + multiMaxY + " = " + (multiMaxX * multiMaxY) + " expected, " + count + " collected")
            .withStyle(ChatFormatting.GRAY));
        if (count < multiMaxX * multiMaxY) {
            ctx.getSource().sendFeedback(Component.literal("  Still need " + (multiMaxX * multiMaxY - count) + " more tiles")
                .withStyle(ChatFormatting.YELLOW));
        } else {
            ctx.getSource().sendFeedback(Component.literal("  All tiles collected! Run /sydran multimap done to upload")
                .withStyle(ChatFormatting.GREEN));
        }
        return 1;
    }

    // ═════════════════════════════════════════════════════════════════
    //  /sydran multimap done
    //  Finalizes and uploads all collected tiles
    // ═════════════════════════════════════════════════════════════════

    private static int finishMulti(CommandContext<FabricClientCommandSource> ctx, SydranConfig config) throws CommandSyntaxException {
        if (!inMultiSession) {
            ctx.getSource().sendError(Component.literal("\u2717 No active multi-map session!")
                .withStyle(ChatFormatting.RED));
            return 0;
        }

        int total = multiTileData.size();
        int expected = multiMaxX * multiMaxY;

        if (total == 0) {
            ctx.getSource().sendError(Component.literal("\u2717 No tiles added! Add tiles with /sydran multimap tile:1-1 first.")
                .withStyle(ChatFormatting.RED));
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
                // Hash each tile
                List<Map<String, Object>> tilePayload = new ArrayList<>();
                for (int i = 0; i < multiTileData.size(); i++) {
                    int posX = multiTilePositions.get(i)[0] - 1; // convert to 0-indexed
                    int posY = multiTilePositions.get(i)[1] - 1;
                    String hash = MapHasher.tileHash(multiTileData.get(i), posX, posY, productName);
                    Map<String, Object> tile = new HashMap<>();
                    tile.put("posX", posX);
                    tile.put("posY", posY);
                    tile.put("tileHash", hash);
                    tilePayload.add(tile);
                }

                // Duplicate check
                SydranApiClient api = new SydranApiClient(config);
                if (config.isDuplicateCheck()) {
                    source.sendFeedback(Component.literal("Checking for duplicates...")
                        .withStyle(ChatFormatting.YELLOW));
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

                // Reset session
                inMultiSession = false;
                multiTileData.clear();
                multiTilePositions.clear();
            } catch (Exception e) {
                source.sendError(Component.literal("\u2717 Upload failed: " + e.getMessage())
                    .withStyle(ChatFormatting.RED));
            }
        });
        return 1;
    }

    // ═════════════════════════════════════════════════════════════════
    //  /sydran multimap cancel
    //  Abandons the current multi session
    // ═════════════════════════════════════════════════════════════════

    private static int cancelMulti(CommandContext<FabricClientCommandSource> ctx) throws CommandSyntaxException {
        if (!inMultiSession) {
            ctx.getSource().sendError(Component.literal("\u2717 No active multi-map session!")
                .withStyle(ChatFormatting.RED));
            return 0;
        }
        inMultiSession = false;
        multiName = null;
        multiTileData.clear();
        multiTilePositions.clear();
        ctx.getSource().sendFeedback(Component.literal("\u2713 Multi-map session cancelled.")
            .withStyle(ChatFormatting.YELLOW));
        return 1;
    }

    // ═════════════════════════════════════════════════════════════════
    //  /sydran multimap status
    //  Shows current session state
    // ═════════════════════════════════════════════════════════════════

    private static int multiStatus(CommandContext<FabricClientCommandSource> ctx) throws CommandSyntaxException {
        if (!inMultiSession) {
            ctx.getSource().sendError(Component.literal("\u2717 No active multi-map session!")
                .withStyle(ChatFormatting.RED));
            return 0;
        }
        ctx.getSource().sendFeedback(Component.literal("=== Multi-map session ===").withStyle(ChatFormatting.GOLD));
        ctx.getSource().sendFeedback(Component.literal("  Name: " + multiName).withStyle(ChatFormatting.WHITE));
        ctx.getSource().sendFeedback(Component.literal("  Price: " + formatPrice(multiPrice)).withStyle(ChatFormatting.GREEN));
        ctx.getSource().sendFeedback(Component.literal("  Category: " + multiCategory).withStyle(ChatFormatting.AQUA));
        ctx.getSource().sendFeedback(Component.literal("  Grid: " + multiMaxX + "x" + multiMaxY).withStyle(ChatFormatting.GRAY));
        ctx.getSource().sendFeedback(Component.literal("  Tiles collected: " + multiTileData.size() + " / " + (multiMaxX * multiMaxY)).withStyle(ChatFormatting.YELLOW));
        for (int i = 0; i < multiTilePositions.size(); i++) {
            int[] pos = multiTilePositions.get(i);
            ctx.getSource().sendFeedback(Component.literal("    " + pos[0] + "-" + pos[1] + " \u2713").withStyle(ChatFormatting.DARK_GRAY));
        }
        return 1;
    }

    // ═════════════════════════════════════════════════════════════════
    //  EXISTING COMMANDS (status, setprice, setcategory, etc.)
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

    private static int setPrice(CommandContext<FabricClientCommandSource> ctx, SydranConfig config) throws CommandSyntaxException {
        String input = StringArgumentType.getString(ctx, "amount");
        int price = parsePrice(input);
        if (price < 0) { ctx.getSource().sendError(Component.literal("\u2717 Invalid price: " + input).withStyle(ChatFormatting.RED)); return 0; }
        config.setPrice(price);
        pushConfigAsync(ctx.getSource(), config, "price", price);
        ctx.getSource().sendFeedback(Component.literal("\u2713 Price set to " + formatPrice(price)).withStyle(ChatFormatting.GREEN));
        return 1;
    }

    private static int setCategory(CommandContext<FabricClientCommandSource> ctx, SydranConfig config) throws CommandSyntaxException {
        String category = StringArgumentType.getString(ctx, "category").toLowerCase();
        if (!VALID_CATEGORIES.contains(category)) { ctx.getSource().sendError(Component.literal("\u2717 Invalid category. Valid: " + String.join(", ", VALID_CATEGORIES)).withStyle(ChatFormatting.RED)); return 0; }
        config.setCategory(category);
        pushConfigAsync(ctx.getSource(), config, "category", category);
        ctx.getSource().sendFeedback(Component.literal("\u2713 Category set to " + category).withStyle(ChatFormatting.GREEN));
        return 1;
    }

    private static int setSize(CommandContext<FabricClientCommandSource> ctx, SydranConfig config) throws CommandSyntaxException {
        String input = StringArgumentType.getString(ctx, "size").toLowerCase();
        String[] parts = input.split("x");
        if (parts.length != 2) { ctx.getSource().sendError(Component.literal("\u2717 Use format like 10x6, 2x2, 1x1").withStyle(ChatFormatting.RED)); return 0; }
        try {
            int w = Integer.parseInt(parts[0]); int h = Integer.parseInt(parts[1]);
            if (w < 1 || h < 1 || w > 32 || h > 32) { ctx.getSource().sendError(Component.literal("\u2717 Size out of range (1\u201332).").withStyle(ChatFormatting.RED)); return 0; }
            config.setMapSize(w, h);
            pushConfigAsync(ctx.getSource(), config, "size", w + "x" + h);
            ctx.getSource().sendFeedback(Component.literal("\u2713 Map size set to " + w + "x" + h + " (" + (w * h) + " tiles)").withStyle(ChatFormatting.GREEN));
        } catch (NumberFormatException e) { ctx.getSource().sendError(Component.literal("\u2717 Invalid size: " + input).withStyle(ChatFormatting.RED)); }
        return 1;
    }

    private static int setDuplicate(CommandContext<FabricClientCommandSource> ctx, SydranConfig config) throws CommandSyntaxException {
        String input = StringArgumentType.getString(ctx, "state").toLowerCase();
        boolean on;
        if (input.equals("on") || input.equals("true") || input.equals("1")) on = true;
        else if (input.equals("off") || input.equals("false") || input.equals("0")) on = false;
        else { ctx.getSource().sendError(Component.literal("\u2717 Use 'on' or 'off'.").withStyle(ChatFormatting.RED)); return 0; }
        config.setDuplicateCheck(on);
        pushConfigAsync(ctx.getSource(), config, "duplicateCheck", on);
        ctx.getSource().sendFeedback(Component.literal("\u2713 Duplicate detection " + (on ? "ON" : "OFF")).withStyle(ChatFormatting.GREEN));
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
                if (orders.size() == 0) { source.sendFeedback(Component.literal("No claimable orders.").withStyle(ChatFormatting.GRAY)); return; }
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
                    source.sendFeedback(Component.literal("").append(Component.literal("\uD83D\uDCB0 ").withStyle(ChatFormatting.GOLD)).append(Component.literal(code).withStyle(ChatFormatting.WHITE)).append(Component.literal(" \u00B7 ").withStyle(ChatFormatting.DARK_GRAY)).append(Component.literal(player).withStyle(ChatFormatting.AQUA)).append(Component.literal(" \u00B7 ").withStyle(ChatFormatting.DARK_GRAY)).append(Component.literal(formatPrice(amount)).withStyle(ChatFormatting.GREEN)).append(Component.literal(" \u00B7 ").withStyle(ChatFormatting.DARK_GRAY)).append(Component.literal(maps + " maps").withStyle(ChatFormatting.LIGHT_PURPLE)));
                    source.sendFeedback(Component.literal("  ").append(openButton).append(Component.literal("  ")).append(claimButton));
                }
            } catch (Exception e) { source.sendError(Component.literal("\u2717 Failed: " + e.getMessage()).withStyle(ChatFormatting.RED)); }
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
            } catch (Exception e) { source.sendError(Component.literal("\u2717 Claim failed: " + e.getMessage()).withStyle(ChatFormatting.RED)); }
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
            } catch (Exception e) { source.sendError(Component.literal("\u2717 Deliver failed: " + e.getMessage()).withStyle(ChatFormatting.RED)); }
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
    private static void pushConfigAsync(FabricClientCommandSource source, SydranConfig config, String key, Object value) {
        CompletableFuture.runAsync(() -> {
            try { new SydranApiClient(config).updateConfig(Map.of(key, value)); }
            catch (Exception e) { source.sendFeedback(Component.literal("\u26A0 Could not sync to server").withStyle(ChatFormatting.YELLOW)); }
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
