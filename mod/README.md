# Sydran Maps Fabric Mod

In-game integration for the Sydran Maps store. Upload maps, check for
duplicates, view/claim orders, highlight required maps, and deliver —
all from Minecraft chat.

## Build

### Default (Minecraft 1.21.x)

```bash
cd mod/
./gradlew build
# Output: build/libs/sydran-maps-1.0.0.jar
```

### For Minecraft 26.1.x

When Minecraft 26.1.2 is released, get the exact version numbers from
https://fabricmc.net/develop/ and either:

**Option A — edit `gradle.properties`:**
```properties
minecraft_version=26.1.2
yarn_mappings=26.1.2+build.1
loader_version=0.17.0
fabric_version=0.110.0+26.1.2
```
Then build:
```bash
./gradlew build
```

**Option B — pass on command line (no file edit needed):**
```bash
./gradlew build \
  -PmcVersion=26.1.2 \
  -PyarnVersion=26.1.2+build.1 \
  -PloaderVer=0.17.0 \
  -PfabricVer=0.110.0+26.1.2
```

The build will print which MC version it's compiling for:
```
Building sydran-maps for Minecraft 26.1.2
  Yarn:       26.1.2+build.1
  Loader:     0.17.0
  Fabric API: 0.110.0+26.1.2
```

### Requirements

- Java 21+
- Internet access (Gradle downloads MC + Fabric dependencies)
- The `minecraft_version`, `yarn_mappings`, `loader_version`, and
  `fabric_version` must all be compatible — check fabricmc.net/develop

## Install

1. Install [Fabric Loader](https://fabricmc.net/use/installer/)
2. Install [Fabric API](https://modrinth.com/mod/fabric-api) — drop the JAR in `.minecraft/mods/`
3. Drop `sydran-maps-1.0.0.jar` in `.minecraft/mods/`
4. Launch Minecraft
5. In chat, run:
   ```
   /sydran config url https://sydran-maps.asifent.com
   /sydran config pin <your-admin-pin>
   ```
6. Verify: `/sydran status` should print "API: Connected ✓"

## Commands

| Command | Description |
|---|---|
| `/sydran status` | Show current config |
| `/sydran setprice <amount>` | Set upload price (150k, 1.5m, etc.) |
| `/sydran setcategory <name>` | Set category |
| `/sydran setsize <WxH>` | Set map dimensions (10x6, 2x2, 1x1) |
| `/sydran setduplicate <on\|off>` | Toggle duplicate detection |
| `/sydran add [name]` | Collect tiles + upload |
| `/sydran openorders` | List claimable orders with clickable buttons |
| `/sydran claim <code> <username>` | Claim order + highlight maps |
| `/sydran deliver <code> <username>` | Mark delivered + clear highlights |
| `/sydran rescan <code>` | Re-scan for required maps |
| `/sydran clearhighlights` | Clear all highlights |
| `/sydran config url <url>` | Set API URL |
| `/sydran config pin <pin>` | Set admin PIN |

## In-game order workflow

1. `/sydran openorders` — see all paid orders with clickable buttons
2. Click **[Open Order]** → runs `/order <playername>` in-game
3. Click **[Claim Order]** → claims the order + auto-highlights required maps
4. Glowing maps (enchantment shimmer + tooltip) show which maps to deliver
5. `/sydran deliver <code> <your-username>` → marks delivered + clears highlights

## Compatibility

The mod uses `minecraft: ">=1.21"` in `fabric.mod.json`, so it loads
on any Minecraft 1.21+ version. The Java code uses only stable Fabric
APIs (commands, item components, map state) that are unlikely to break
between minor versions.

If a new MC version changes an API the mod uses, update the yarn
mappings + rebuild — the code itself shouldn't need changes.

## Config file

Stored at `.minecraft/config/sydran-maps.json`:
```json
{
  "apiUrl": "https://sydran-maps.asifent.com",
  "adminPin": "your-pin",
  "price": 50000,
  "category": "general",
  "mapWidth": 1,
  "mapHeight": 1,
  "duplicateCheck": true
}
```
