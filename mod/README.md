# Sydran Maps Fabric Mod

In-game integration for the Sydran Maps store. Upload maps, check for
duplicates, view/claim orders, highlight required maps, and deliver —
all from Minecraft chat.

## Build

### Requirements

- **JDK 25** (Minecraft 26.x requires Java 25)
- **Gradle 8.11.1+** (Gradle 8.x crashes on JDK 25 with older versions)

### Build for Minecraft 26.1.2

```bash
cd mod/
./gradlew build
# Output: build/libs/sydran-maps-1.0.0.jar
```

The build will print:
```
Building sydran-maps for Minecraft 26.1.2
  Loader:       0.19.5
  Fabric API:   0.155.3+26.1.2
  Mappings:     Mojang official (no Yarn)
  Java target:  25
```

### Key changes from 1.21.x → 26.1.x

| What | 1.21.x | 26.1.x |
|------|--------|--------|
| Gradle | 8.8 | 8.11.1 |
| fabric-loom | `fabric-loom` 1.7-SNAPSHOT | `net.fabricmc.fabric-loom` 1.18.2 |
| Mappings | Yarn | Mojang official (Yarn doesn't exist for 26.x) |
| Java target | 21 | 25 |
| Fabric Loader | 0.16.5 | 0.19.5 |
| Fabric API | 0.102.0+1.21.1 | 0.155.3+26.1.2 |

### To target a different MC version

Edit `gradle.properties` and update the three version properties:
```properties
minecraft_version=26.1.2
loader_version=0.19.5
fabric_version=0.155.3+26.1.2
```

Version numbers for any MC version: https://fabricmc.net/develop/

## Install

1. Install [Fabric Loader](https://fabricmc.net/use/installer/) for MC 26.1.2
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
